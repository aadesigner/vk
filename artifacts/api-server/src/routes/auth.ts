import { Router } from "express";
import { db, usersTable, passwordResetTokensTable, systemSettingsTable, loginAttemptsTable } from "@workspace/db";
import { eq, lt, desc, and, gte, count, or } from "drizzle-orm";
import { signJwt, verifyJwt, setAuthCookie, clearAuthCookie, hashPassword, verifyPassword, revokeToken, isTokenRevoked, clampSessionDays, getConfiguredSessionDays, refreshSessionIfNeeded, COOKIE_NAME, requireAuth } from "../lib/auth.js";
import { clearAdminUnlockCookie } from "../lib/adminAreaUnlock.js";
import { validatePassword } from "../lib/passwordPolicy.js";
import { logger } from "../lib/logger.js";
import { isRecaptchaRelaxedForRequest } from "../lib/allowedOrigins.js";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { sendEmail, buildPasswordResetEmail, buildWelcomeEmail, isSmtpConfigured } from "../lib/emailService.js";
import crypto from "crypto";
import { getSettings } from "../lib/settingsCache.js";
import { shouldBootstrapAdmin } from "../lib/adminBootstrap.js";
import { clientIpKey } from "../lib/trustedClient.js";
import { oauthInitLimiter, presenceHeartbeatLimiter } from "../lib/expensiveEndpointLimiter.js";
import { getEffectiveSystemSettings } from "../lib/systemSettings.js";
import {
  isFacebookOAuthConfigured,
  isGoogleOAuthConfigured,
} from "../lib/oauthSettings.js";
import { touchUserPresence } from "../lib/userPresence.js";
import { trackUserSessionAccess } from "../lib/userAccessTracking.js";
import {
  authSessionUserSelect,
  oauthUserSelect,
  toPublicUser,
  type AuthSessionUser,
} from "../lib/authUserSelect.js";
import { resolveRequestCountryCode, resolveRequestCountryCodeAsync } from "../lib/geoCountry.js";
import { parseUserCountryCode } from "../lib/userCountry.js";
import {
  ACQUISITION_COOKIE,
  resolveAcquisitionForSignup,
  type AcquisitionUserFields,
} from "../lib/acquisition.js";

const router = Router();

function clearAcquisitionCookie(res: import("express").Response): void {
  res.clearCookie(ACQUISITION_COOKIE, { path: "/" });
}

function acquisitionFromRequest(req: import("express").Request, body?: unknown): AcquisitionUserFields | null {
  const cookieRaw = typeof req.cookies?.[ACQUISITION_COOKIE] === "string"
    ? req.cookies[ACQUISITION_COOKIE]
    : undefined;
  return resolveAcquisitionForSignup(body ?? req.body, cookieRaw);
}
const OAUTH_LANGS = new Set(["en", "es", "ar", "uk", "ru", "ro", "pl", "ka", "sq"]);
const OAUTH_LANG_COOKIE = "km_oauth_lang";

function resolveOAuthLang(req: { query: Record<string, unknown>; cookies?: Record<string, string> }): string {
  const q = req.query.lang;
  if (typeof q === "string" && OAUTH_LANGS.has(q)) return q;
  const c = req.cookies?.[OAUTH_LANG_COOKIE];
  if (typeof c === "string" && OAUTH_LANGS.has(c)) return c;
  return "en";
}

function isPgUniqueViolation(err: unknown): boolean {
  return !!(err && typeof err === "object" && "code" in err && (err as { code: string }).code === "23505");
}

function setOAuthLangCookie(res: import("express").Response, lang: string, secure: boolean): void {
  res.cookie(OAUTH_LANG_COOKIE, lang, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    maxAge: 10 * 60 * 1000,
    path: "/",
  });
}

function clearOAuthLangCookie(res: import("express").Response): void {
  res.clearCookie(OAUTH_LANG_COOKIE, { path: "/" });
}

/** Profile country from request IP. Albania (AL) and Kosovo (XK) stay separate. Informational only. */
function countryFromRequest(req: import("express").Request): string | null {
  return parseUserCountryCode(resolveRequestCountryCode(req));
}

async function countryFromRequestAsync(req: import("express").Request): Promise<string | null> {
  return parseUserCountryCode(await resolveRequestCountryCodeAsync(req));
}

function oauthSignInRedirect(frontendBase: string, lang: string, error: string): string {
  return `${frontendBase}/${lang}/sign-in?${new URLSearchParams({ error }).toString()}`;
}

function oauthDashboardRedirect(frontendBase: string, lang: string): string {
  return `${frontendBase}/${lang}/dashboard`;
}

function oauthSetPasswordRedirect(frontendBase: string, lang: string): string {
  return `${frontendBase}/${lang}/set-password`;
}

function oauthSuccessRedirect(
  frontendBase: string,
  lang: string,
  user: { passwordHash: string | null },
): string {
  if (!user.passwordHash) {
    return oauthSetPasswordRedirect(frontendBase, lang);
  }
  return oauthDashboardRedirect(frontendBase, lang);
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many login attempts. Please try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => clientIpKey(req),
  validate: { ip: false },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: async () => {
    const s = await getSettings();
    const v = s.registerMaxPerHour;
    if (v <= 0) {
      return process.env.NODE_ENV === "production" ? 5 : 0;
    }
    return v;
  },
  message: { error: "Too many registration attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: async () => {
    if (process.env.NODE_ENV === "production") return false;
    const s = await getSettings();
    return s.registerMaxPerHour <= 0;
  },
});

// Limit by IP: 3 forgot-password requests per hour
const forgotPasswordIpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: "Too many password reset requests. Please try again in an hour." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Limit by email: 3 forgot-password requests per hour per address
const forgotPasswordEmailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: "Too many password reset requests for this email. Please try again in an hour." },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = req.body?.email;
    return typeof email === "string" ? email.trim().toLowerCase() : "unknown";
  },
});

const resetPasswordIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Too many password reset attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const resetPasswordTokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many attempts for this reset link. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const token = req.method === "GET"
      ? req.query.token
      : (req.body as { token?: string } | undefined)?.token;
    return typeof token === "string" && token ? token.slice(0, 40) : ipKeyGenerator(req.ip ?? "unknown");
  },
});

// ── reCAPTCHA v3 verification ─────────────────────────────────────────────────

async function verifyRecaptchaToken(
  token: string,
  secretKey: string,
  minScore: number,
  opts?: { acceptSuccessOnly?: boolean },
): Promise<{ ok: boolean; score: number; outage: boolean; errorCodes?: string[] }> {
  try {
    const body = new URLSearchParams({ secret: secretKey, response: token });
    const resp = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: AbortSignal.timeout(5000),
    });
    const data = await resp.json() as {
      success: boolean;
      score?: number;
      "error-codes"?: string[];
    };
    const score = data.score ?? 1;
    const errorCodes = data["error-codes"];
    const ok = opts?.acceptSuccessOnly
      ? data.success
      : data.success && score >= minScore;
    return {
      ok,
      score,
      outage: false,
      errorCodes,
    };
  } catch (err) {
    logger.warn({ err }, "reCAPTCHA siteverify unreachable — allowing request through");
    return { ok: true, score: -1, outage: true };
  }
}

const AUTH_RECAPTCHA_MIN_SCORE = 0.3;
const AUTH_RECAPTCHA_OPTS = { minScore: AUTH_RECAPTCHA_MIN_SCORE, acceptSuccessOnly: true } as const;

async function checkRecaptcha(
  token: string | undefined,
  req?: { headers?: { host?: string } },
  opts?: { minScore?: number; acceptSuccessOnly?: boolean },
): Promise<{ blocked: boolean; reason?: string }> {
  try {
    const [settings] = await db
      .select({
        recaptchaEnabled: systemSettingsTable.recaptchaEnabled,
        recaptchaSecretKey: systemSettingsTable.recaptchaSecretKey,
        recaptchaMinScore: systemSettingsTable.recaptchaMinScore,
      })
      .from(systemSettingsTable)
      .orderBy(desc(systemSettingsTable.id))
      .limit(1);

    if (!settings?.recaptchaEnabled || !settings.recaptchaSecretKey) {
      return { blocked: false };
    }
    if (isRecaptchaRelaxedForRequest(req)) {
      return { blocked: false };
    }
    if (!token) {
      return { blocked: true, reason: "Security verification is required. Please reload the page and try again." };
    }

    const minScore = opts?.minScore ?? settings.recaptchaMinScore ?? 0.5;
    const result = await verifyRecaptchaToken(
      token,
      settings.recaptchaSecretKey,
      minScore,
      { acceptSuccessOnly: opts?.acceptSuccessOnly },
    );
    if (result.outage) {
      return { blocked: false };
    }
    if (!result.ok) {
      logger.warn({
        minScore,
        score: result.score,
        errorCodes: result.errorCodes,
      }, "reCAPTCHA verification failed for auth request");
      return { blocked: true, reason: "Security check failed. Please try again." };
    }
    return { blocked: false };
  } catch (err) {
    logger.warn({ err }, "reCAPTCHA check failed — allowing auth request through");
    return { blocked: false };
  }
}

type PublicUserSource = AuthSessionUser;

function getPublicUser(user: PublicUserSource) {
  return toPublicUser(user);
}

async function syncUserAdminFlag(user: AuthSessionUser): Promise<AuthSessionUser> {
  return user;
}

// GET /auth/geo-country — IP country for registration prefill (no language / redirect rules)
router.get("/auth/geo-country", async (req, res) => {
  const countryCode = await countryFromRequestAsync(req);
  res.setHeader("Cache-Control", "private, no-store");
  res.json({ countryCode });
});

// POST /auth/register
router.post("/auth/register", registerLimiter, async (req, res) => {
  const { email, password, name, countryCode: rawCountry, recaptchaToken } = req.body as {
    email?: string;
    password?: string;
    name?: string;
    countryCode?: string;
    recaptchaToken?: string;
  };

  const captcha = await checkRecaptcha(recaptchaToken, req, AUTH_RECAPTCHA_OPTS);
  if (captcha.blocked) {
    res.status(403).json({ error: captcha.reason ?? "Security check failed", code: "RECAPTCHA_FAILED" });
    return;
  }

  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "Email is required" });
    return;
  }
  if (!password || typeof password !== "string") {
    res.status(400).json({ error: "Password is required" });
    return;
  }

  const countryCode = parseUserCountryCode(rawCountry);
  if (!countryCode) {
    res.status(400).json({ error: "Country is required", code: "COUNTRY_REQUIRED" });
    return;
  }

  const passwordCheck = validatePassword(password);
  if (!passwordCheck.ok) {
    res.status(400).json({ error: passwordCheck.error, code: passwordCheck.code });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    res.status(400).json({ error: "Invalid email address" });
    return;
  }

  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, normalizedEmail))
    .limit(1);
  if (existing) {
    res.status(409).json({ error: "An account with this email already exists" });
    return;
  }

  const isAdmin = await shouldBootstrapAdmin(normalizedEmail);
  const passwordHash = await hashPassword(password);
  const id = crypto.randomUUID();
  const signupIp = clientIpKey(req);
  const acquisition = acquisitionFromRequest(req, req.body);

  const [user] = await db.insert(usersTable).values({
    id,
    email: normalizedEmail,
    name: name?.trim() || undefined,
    passwordHash,
    isAdmin,
    countryCode,
    lastLoginAt: new Date(),
    lastLoginIp: signupIp !== "unknown" ? signupIp : undefined,
    signupIp: signupIp !== "unknown" ? signupIp : undefined,
    ...(acquisition ?? {}),
  }).returning(authSessionUserSelect);

  if (!user) {
    res.status(500).json({ error: "Failed to create account" });
    return;
  }

  clearAcquisitionCookie(res);

  const [regSettings] = await db
    .select({ sessionDays: systemSettingsTable.sessionDays })
    .from(systemSettingsTable)
    .orderBy(desc(systemSettingsTable.id))
    .limit(1);
  const regSessionDays = clampSessionDays(regSettings?.sessionDays);

  const token = await signJwt(user.id, regSessionDays);
  setAuthCookie(res, token, regSessionDays);
  await trackUserSessionAccess(req, res, user.id, { isNewAccount: true });

  logger.info({ msg: "auth_register", userId: user.id, email: normalizedEmail, isAdmin });

  res.status(201).json({ user: getPublicUser(user) });

  try {
    const [settings] = await db
      .select({
        emailSendWelcome: systemSettingsTable.emailSendWelcome,
        siteUrl: systemSettingsTable.siteUrl,
        emailTemplates: systemSettingsTable.emailTemplates,
      })
      .from(systemSettingsTable)
      .orderBy(desc(systemSettingsTable.id))
      .limit(1);
    if (settings?.emailSendWelcome !== false) {
      const displayName = (name?.trim() || normalizedEmail.split("@")[0]);
      const siteUrl = settings?.siteUrl?.replace(/\/$/, "") ?? "https://verifykm.com";
      const templates = (settings?.emailTemplates ?? {}) as import("@workspace/db").EmailTemplatesConfig;
      const { subject, html } = buildWelcomeEmail(displayName, siteUrl, templates.welcome);
      void sendEmail({ to: normalizedEmail, subject, html, logType: "welcome" });
    }
  } catch (err) {
    logger.warn({ err }, "Welcome email failed to send after registration");
  }
});

// POST /auth/login
router.post("/auth/login", loginLimiter, async (req, res) => {
  try {
  const { email, password, recaptchaToken } = req.body as {
    email?: string;
    password?: string;
    recaptchaToken?: string;
  };

  const captcha = await checkRecaptcha(recaptchaToken, req, AUTH_RECAPTCHA_OPTS);
  if (captcha.blocked) {
    res.status(403).json({ error: captcha.reason ?? "Security check failed", code: "RECAPTCHA_FAILED" });
    return;
  }

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const clientIp = clientIpKey(req);

  // Determine if this is an admin login attempt (separate lockout bucket)
  const adminEnvEmail = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  const loginContext = (adminEnvEmail && normalizedEmail === adminEnvEmail) ? "admin" : "user";

  // Fetch security settings
  const [settings] = await db
    .select({
      maxFailedLogins: systemSettingsTable.maxFailedLogins,
      lockoutMinutes: systemSettingsTable.lockoutMinutes,
      adminMaxFailedLogins: systemSettingsTable.adminMaxFailedLogins,
      adminLockoutMinutes: systemSettingsTable.adminLockoutMinutes,
      sessionDays: systemSettingsTable.sessionDays,
    })
    .from(systemSettingsTable)
    .orderBy(desc(systemSettingsTable.id))
    .limit(1);

  const maxFailed = loginContext === "admin"
    ? (settings?.adminMaxFailedLogins ?? 3)
    : (settings?.maxFailedLogins ?? 5);
  const lockoutMins = loginContext === "admin"
    ? (settings?.adminLockoutMinutes ?? 30)
    : (settings?.lockoutMinutes ?? 30);
  const sessionDays = clampSessionDays(settings?.sessionDays);
  const lockoutSince = new Date(Date.now() - lockoutMins * 60 * 1000);

  // Clean up expired records for this context
  await db.delete(loginAttemptsTable).where(
    and(lt(loginAttemptsTable.attemptedAt, lockoutSince), eq(loginAttemptsTable.context, loginContext)),
  );

  // Check failed login lockout per (email, IP, context)
  const failRows = await db
    .select({ failCount: count() })
    .from(loginAttemptsTable)
    .where(and(
      eq(loginAttemptsTable.email, normalizedEmail),
      eq(loginAttemptsTable.ip, clientIp),
      eq(loginAttemptsTable.context, loginContext),
      gte(loginAttemptsTable.attemptedAt, lockoutSince),
    ));
  const failCount = failRows[0]?.failCount ?? 0;

  if (Number(failCount) >= maxFailed) {
    logger.warn({ msg: "auth_login_lockout", email: normalizedEmail, ip: clientIp, context: loginContext, failCount: Number(failCount) });
    res.status(429).json({ error: `Too many failed login attempts. Please try again in ${lockoutMins} minutes.` });
    return;
  }

  // Keep login independent of optional profile/presence columns so additive
  // schema rollouts cannot break authentication.
  const [user] = await db
    .select(authSessionUserSelect)
    .from(usersTable)
    .where(eq(usersTable.email, normalizedEmail))
    .limit(1);

  if (!user || !user.passwordHash) {
    await db.insert(loginAttemptsTable).values({ email: normalizedEmail, ip: clientIp, context: loginContext });
    logger.warn({ msg: "auth_login_failed", reason: "user_not_found", email: normalizedEmail, ip: clientIp, context: loginContext });
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    await db.insert(loginAttemptsTable).values({ email: normalizedEmail, ip: clientIp, context: loginContext });
    logger.warn({ msg: "auth_login_failed", reason: "wrong_password", userId: user.id, email: normalizedEmail, ip: clientIp, context: loginContext });
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  if (user.isBanned) {
    logger.warn({ msg: "auth_login_banned", userId: user.id, email: normalizedEmail, ip: clientIp });
    res.status(403).json({ error: "Your account has been suspended.", code: "banned" });
    return;
  }

  // Successful login — clear failed attempts for this context only
  await db.delete(loginAttemptsTable).where(
    and(eq(loginAttemptsTable.email, normalizedEmail), eq(loginAttemptsTable.context, loginContext)),
  );

  let token: string;
  try {
    token = await signJwt(user.id, sessionDays);
  } catch (err) {
    logger.error({ err, userId: user.id }, "auth_login_jwt_failed");
    res.status(503).json({ error: "Login is temporarily unavailable. Please try again." });
    return;
  }
  setAuthCookie(res, token, sessionDays);
  await trackUserSessionAccess(req, res, user.id);

  logger.info({ msg: "auth_login", userId: user.id, email: normalizedEmail });

  res.json({ user: getPublicUser(user) });
  } catch (err) {
    logger.error({ err, msg: "auth_login_unhandled" }, "Login handler error");
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

// POST /auth/forgot-password
const FORGOT_PASSWORD_LANGS = new Set(["en", "es", "sq", "ro", "pl", "ka", "ar", "uk", "ru"]);

router.post("/auth/forgot-password", forgotPasswordIpLimiter, forgotPasswordEmailLimiter, async (req, res) => {
  const { email, recaptchaToken, lang: rawLang } = req.body as {
    email?: string;
    recaptchaToken?: string;
    lang?: string;
  };

  const captcha = await checkRecaptcha(recaptchaToken, req, AUTH_RECAPTCHA_OPTS);
  if (captcha.blocked) {
    res.status(403).json({ error: captcha.reason ?? "Security check failed", code: "RECAPTCHA_FAILED" });
    return;
  }

  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "Email is required" });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    res.status(400).json({ error: "Invalid email address" });
    return;
  }

  const lang = typeof rawLang === "string" && FORGOT_PASSWORD_LANGS.has(rawLang) ? rawLang : "en";

  // Always respond 200 after validation to avoid user enumeration
  res.json({ ok: true });

  try {
    const [user] = await db
      .select({ id: usersTable.id, passwordHash: usersTable.passwordHash })
      .from(usersTable)
      .where(eq(usersTable.email, normalizedEmail))
      .limit(1);
    // OAuth-only accounts have no local password to reset
    if (!user || !user.passwordHash) return;

    // Delete any existing tokens for this user
    await db.delete(passwordResetTokensTable).where(eq(passwordResetTokensTable.userId, user.id));

    const id = crypto.randomUUID();
    const rawVerifier = crypto.randomBytes(32).toString("hex");
    const tokenHash = await hashPassword(rawVerifier);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.insert(passwordResetTokensTable).values({ id, tokenHash, userId: user.id, expiresAt });

    const [settings] = await db
      .select({
        siteUrl: systemSettingsTable.siteUrl,
        emailSendPasswordReset: systemSettingsTable.emailSendPasswordReset,
        emailTemplates: systemSettingsTable.emailTemplates,
      })
      .from(systemSettingsTable)
      .orderBy(desc(systemSettingsTable.id))
      .limit(1);
    if (settings?.emailSendPasswordReset === false) {
      logger.info({ msg: "auth_forgot_password_skipped", userId: user.id, reason: "email_disabled" });
      return;
    }

    const siteUrl = settings?.siteUrl?.replace(/\/$/, "") ?? process.env.SITE_URL?.replace(/\/$/, "") ?? "https://verifykm.com";
    const resetUrl = `${siteUrl}/${lang}/reset-password?token=${id}.${rawVerifier}`;
    const templates = (settings?.emailTemplates ?? {}) as import("@workspace/db").EmailTemplatesConfig;
    const { subject, html } = buildPasswordResetEmail(resetUrl, siteUrl, templates.reset);

    if (!(await isSmtpConfigured())) {
      logger.error({ msg: "auth_forgot_password_email_failed", userId: user.id, error: "SMTP not configured or not enabled" });
      return;
    }

    const emailResult = await sendEmail({
      to: normalizedEmail,
      subject,
      html,
      logType: "reset",
      logMeta: { userId: user.id },
    });
    if (!emailResult.ok) {
      logger.error({ msg: "auth_forgot_password_email_failed", userId: user.id, error: emailResult.error });
      return;
    }

    logger.info({ msg: "auth_forgot_password", userId: user.id });
  } catch (err) {
    logger.error({ msg: "auth_forgot_password_error", error: String(err) });
  }
});

async function resolveResetToken(token: string): Promise<
  | { ok: true; record: typeof passwordResetTokensTable.$inferSelect }
  | { ok: false; expired: boolean }
> {
  const dotIdx = token.indexOf(".");
  if (dotIdx === -1) return { ok: false, expired: false };

  const id = token.slice(0, dotIdx);
  const rawVerifier = token.slice(dotIdx + 1);
  if (!id || !rawVerifier) return { ok: false, expired: false };

  const [record] = await db
    .select()
    .from(passwordResetTokensTable)
    .where(eq(passwordResetTokensTable.id, id))
    .limit(1);

  if (!record) return { ok: false, expired: false };

  if (record.expiresAt < new Date()) {
    await db.delete(passwordResetTokensTable).where(eq(passwordResetTokensTable.id, id));
    return { ok: false, expired: true };
  }

  const valid = await verifyPassword(rawVerifier, record.tokenHash);
  if (!valid) return { ok: false, expired: false };

  return { ok: true, record };
}

// GET /auth/reset-password?token=... — validate token without consuming it
router.get("/auth/reset-password", resetPasswordIpLimiter, resetPasswordTokenLimiter, async (req, res) => {
  const token = req.query.token;
  if (!token || typeof token !== "string") {
    res.status(400).json({ valid: false, expired: false, error: "Token is required" });
    return;
  }

  const result = await resolveResetToken(token);
  if (!result.ok) {
    res.status(400).json({ valid: false, expired: result.expired });
    return;
  }

  res.json({ valid: true });
});

// POST /auth/reset-password
router.post("/auth/reset-password", resetPasswordIpLimiter, resetPasswordTokenLimiter, async (req, res) => {
  const { token, password } = req.body as { token?: string; password?: string };

  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "Reset token is required" });
    return;
  }
  if (!password || typeof password !== "string") {
    res.status(400).json({ error: "Password is required" });
    return;
  }

  const passwordCheck = validatePassword(password);
  if (!passwordCheck.ok) {
    res.status(400).json({ error: passwordCheck.error, code: passwordCheck.code });
    return;
  }

  const result = await resolveResetToken(token);
  if (!result.ok) {
    const msg = result.expired
      ? "This reset link has expired. Please request a new one."
      : "Invalid or expired reset link. Please request a new one.";
    res.status(400).json({ error: msg });
    return;
  }

  const { record } = result;
  const passwordHash = await hashPassword(password);

  await db.update(usersTable).set({ passwordHash, updatedAt: new Date() }).where(eq(usersTable.id, record.userId));
  await db.delete(passwordResetTokensTable).where(eq(passwordResetTokensTable.id, record.id));

  // Opportunistically clean up other expired tokens
  await db.delete(passwordResetTokensTable).where(lt(passwordResetTokensTable.expiresAt, new Date()));

  logger.info({ msg: "auth_reset_password", userId: record.userId });

  res.json({ ok: true });
});

// ── Facebook OAuth ────────────────────────────────────────────────────────────

// GET /auth/facebook — initiate OAuth
router.get("/auth/facebook", oauthInitLimiter, async (req, res) => {
  const settings = await getEffectiveSystemSettings();
  if (!isFacebookOAuthConfigured(settings)) {
    res.status(503).json({ error: "Facebook sign-in is not configured" });
    return;
  }

  const appId = settings!.facebookAppId!.trim();

  const proto = (req.headers["x-forwarded-proto"] as string | undefined) ?? req.protocol;
  const host = (req.headers["x-forwarded-host"] as string | undefined) ?? req.headers.host ?? "localhost";
  const redirectUri = `${proto}://${host}/api/auth/facebook/callback`;

  setOAuthLangCookie(res, resolveOAuthLang(req), proto === "https");

  const state = crypto.randomBytes(16).toString("hex");
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "email,public_profile",
    state,
  });

  res.cookie("fb_oauth_state", state, {
    httpOnly: true,
    secure: proto === "https",
    sameSite: "lax",
    maxAge: 10 * 60 * 1000,
    path: "/",
  });

  res.redirect(`https://www.facebook.com/v19.0/dialog/oauth?${params}`);
});

// GET /auth/facebook/callback
router.get("/auth/facebook/callback", async (req, res) => {
  const { code, state, error: oauthError } = req.query as Record<string, string | undefined>;

  const proto = (req.headers["x-forwarded-proto"] as string | undefined) ?? req.protocol;
  const host = (req.headers["x-forwarded-host"] as string | undefined) ?? req.headers.host ?? "localhost";
  const frontendBase = `${proto}://${host}`;
  const lang = resolveOAuthLang(req);
  clearOAuthLangCookie(res);
  const errorRedirect = oauthSignInRedirect(frontendBase, lang, "facebook_failed");

  if (oauthError || !code || !state) {
    res.redirect(errorRedirect);
    return;
  }

  const storedState = req.cookies?.["fb_oauth_state"] as string | undefined;
  res.clearCookie("fb_oauth_state", { path: "/" });
  if (!storedState || storedState !== state) {
    logger.warn({ msg: "facebook_oauth_state_mismatch" });
    res.redirect(errorRedirect);
    return;
  }

  const settings = await getEffectiveSystemSettings();
  if (!isFacebookOAuthConfigured(settings)) {
    res.redirect(errorRedirect);
    return;
  }

  const appId = settings!.facebookAppId!.trim();
  const appSecret = settings!.facebookAppSecret!.trim();

  const redirectUri = `${proto}://${host}/api/auth/facebook/callback`;

  // Exchange code for access token
  let accessToken: string;
  try {
    const tokenRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?${new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        redirect_uri: redirectUri,
        code,
      })}`,
      { signal: AbortSignal.timeout(10000) },
    );
    if (!tokenRes.ok) {
      const txt = await tokenRes.text();
      logger.warn({ msg: "facebook_oauth_token_error", response: txt.slice(0, 200) });
      res.redirect(errorRedirect);
      return;
    }
    const tokenData = await tokenRes.json() as { access_token?: string };
    if (!tokenData.access_token) {
      logger.warn({ msg: "facebook_oauth_no_access_token" });
      res.redirect(errorRedirect);
      return;
    }
    accessToken = tokenData.access_token;
  } catch (err) {
    logger.error({ msg: "facebook_oauth_token_fetch_error", err });
    res.redirect(errorRedirect);
    return;
  }

  // Get user info from Facebook Graph API
  let facebookId: string;
  let email: string | undefined;
  let name: string | undefined;
  let picture: string | undefined;
  try {
    const meRes = await fetch(
      `https://graph.facebook.com/v19.0/me?fields=id,name,email,picture.type(large)&access_token=${encodeURIComponent(accessToken)}`,
      { signal: AbortSignal.timeout(10000) },
    );
    if (!meRes.ok) {
      logger.warn({ msg: "facebook_oauth_me_failed", status: meRes.status });
      res.redirect(errorRedirect);
      return;
    }
    const info = await meRes.json() as {
      id?: string; name?: string; email?: string;
      picture?: { data?: { url?: string } };
    };
    if (!info.id) {
      res.redirect(errorRedirect);
      return;
    }
    facebookId = info.id;
    email = info.email?.toLowerCase().trim();
    name = info.name;
    picture = info.picture?.data?.url;
  } catch (err) {
    logger.error({ msg: "facebook_oauth_me_error", err });
    res.redirect(errorRedirect);
    return;
  }

  // Facebook often omits email (declined permission, phone-only account, or app
  // lacks Advanced Access on the email permission). Returning users can still
  // sign in by facebookId; new accounts still need an email.
  if (!email) {
    const [existingByFacebook] = await db
      .select(oauthUserSelect)
      .from(usersTable)
      .where(eq(usersTable.facebookId, facebookId))
      .limit(1);

    if (!existingByFacebook) {
      logger.warn({ msg: "facebook_oauth_no_email", facebookId });
      res.redirect(oauthSignInRedirect(frontendBase, lang, "facebook_no_email"));
      return;
    }

    if (existingByFacebook.isBanned) {
      res.redirect(oauthSignInRedirect(frontendBase, lang, "banned"));
      return;
    }

    const sessionDays = clampSessionDays(settings.sessionDays);
    const oauthIp = clientIpKey(req);
    const user = await syncUserAdminFlag(existingByFacebook);
    await db.update(usersTable)
      .set({
        avatarUrl: existingByFacebook.avatarUrl ?? picture ?? undefined,
        lastLoginAt: new Date(),
        lastLoginIp: oauthIp,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, user.id));

    logger.info({ msg: "facebook_oauth_login_no_email", userId: user.id, facebookId });
    const token = await signJwt(user.id, sessionDays);
    setAuthCookie(res, token, sessionDays);
    await trackUserSessionAccess(req, res, user.id);
    res.redirect(oauthSuccessRedirect(frontendBase, lang, user));
    return;
  }

  const sessionDays = clampSessionDays(settings.sessionDays);
  const oauthIp = clientIpKey(req);
  let oauthIsNewAccount = false;

  // Find or create user
  let [user] = await db.select(oauthUserSelect).from(usersTable).where(eq(usersTable.facebookId, facebookId)).limit(1);

  if (!user) {
    const [existingByEmail] = await db.select(oauthUserSelect).from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (existingByEmail) {
      const [updated] = await db.update(usersTable)
        .set({
          facebookId,
          avatarUrl: existingByEmail.avatarUrl ?? picture ?? undefined,
          lastLoginAt: new Date(),
          lastLoginIp: oauthIp,
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, existingByEmail.id))
        .returning(oauthUserSelect);
      user = updated;
      logger.info({ msg: "facebook_oauth_link", userId: existingByEmail.id, email });
    }
  }

  if (!user) {
    const isAdmin = await shouldBootstrapAdmin(email);
    const id = crypto.randomUUID();
    const acquisition = acquisitionFromRequest(req);
    try {
      const [created] = await db.insert(usersTable).values({
        id,
        email,
        name: name ?? undefined,
        avatarUrl: picture ?? undefined,
        facebookId,
        authProvider: "facebook",
        isAdmin,
        // Country left unset — user picks it on Account (offers / coupons emails).
        lastLoginAt: new Date(),
        lastLoginIp: oauthIp !== "unknown" ? oauthIp : undefined,
        signupIp: oauthIp !== "unknown" ? oauthIp : undefined,
        ...(acquisition ?? {}),
      }).returning(authSessionUserSelect);
      user = created;
      oauthIsNewAccount = true;
      clearAcquisitionCookie(res);
      logger.info({ msg: "facebook_oauth_register", userId: id, email });
    } catch (err) {
      if (!isPgUniqueViolation(err)) throw err;
      const [existing] = await db.select(oauthUserSelect).from(usersTable)
        .where(or(eq(usersTable.facebookId, facebookId), eq(usersTable.email, email)))
        .limit(1);
      user = existing;
    }
  } else {
    user = await syncUserAdminFlag(user);
    await db.update(usersTable)
      .set({ lastLoginAt: new Date(), lastLoginIp: oauthIp, updatedAt: new Date() })
      .where(eq(usersTable.id, user.id));
    logger.info({ msg: "facebook_oauth_login", userId: user.id, email });
  }

  if (!user) {
    res.redirect(errorRedirect);
    return;
  }

  if (user.isBanned) {
    res.redirect(oauthSignInRedirect(frontendBase, lang, "banned"));
    return;
  }

  const token = await signJwt(user.id, sessionDays);
  setAuthCookie(res, token, sessionDays);
  await trackUserSessionAccess(req, res, user.id, { isNewAccount: oauthIsNewAccount });

  res.redirect(oauthSuccessRedirect(frontendBase, lang, user));
});

// ── Google OAuth ──────────────────────────────────────────────────────────────

// GET /auth/google — initiate OAuth
router.get("/auth/google", oauthInitLimiter, async (req, res) => {
  const settings = await getEffectiveSystemSettings();
  if (!isGoogleOAuthConfigured(settings)) {
    res.status(503).json({ error: "Google sign-in is not configured" });
    return;
  }

  const clientId = settings!.googleClientId!.trim();

  const proto = (req.headers["x-forwarded-proto"] as string | undefined) ?? req.protocol;
  const host = (req.headers["x-forwarded-host"] as string | undefined) ?? req.headers.host ?? "localhost";
  const redirectUri = `${proto}://${host}/api/auth/google/callback`;

  setOAuthLangCookie(res, resolveOAuthLang(req), proto === "https");

  const state = crypto.randomBytes(16).toString("hex");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });

  res.cookie("google_oauth_state", state, {
    httpOnly: true,
    secure: proto === "https",
    sameSite: "lax",
    maxAge: 10 * 60 * 1000,
    path: "/",
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

// GET /auth/google/callback
router.get("/auth/google/callback", async (req, res) => {
  const { code, state, error: oauthError } = req.query as Record<string, string | undefined>;

  const proto = (req.headers["x-forwarded-proto"] as string | undefined) ?? req.protocol;
  const host = (req.headers["x-forwarded-host"] as string | undefined) ?? req.headers.host ?? "localhost";
  const frontendBase = `${proto}://${host}`;
  const lang = resolveOAuthLang(req);
  clearOAuthLangCookie(res);
  const errorRedirect = oauthSignInRedirect(frontendBase, lang, "google_failed");

  if (oauthError || !code || !state) {
    res.redirect(errorRedirect);
    return;
  }

  const storedState = req.cookies?.["google_oauth_state"] as string | undefined;
  res.clearCookie("google_oauth_state", { path: "/" });
  if (!storedState || storedState !== state) {
    logger.warn({ msg: "google_oauth_state_mismatch" });
    res.redirect(errorRedirect);
    return;
  }

  const settings = await getEffectiveSystemSettings();
  if (!isGoogleOAuthConfigured(settings)) {
    res.redirect(errorRedirect);
    return;
  }

  const clientId = settings!.googleClientId!.trim();
  const clientSecret = settings!.googleClientSecret!.trim();

  const redirectUri = `${proto}://${host}/api/auth/google/callback`;

  // Exchange code for tokens
  let idToken: string;
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }).toString(),
      signal: AbortSignal.timeout(10000),
    });
    if (!tokenRes.ok) {
      const txt = await tokenRes.text();
      logger.warn({ msg: "google_oauth_token_error", response: txt.slice(0, 200) });
      res.redirect(errorRedirect);
      return;
    }
    const tokenData = await tokenRes.json() as { id_token?: string };
    if (!tokenData.id_token) {
      logger.warn({ msg: "google_oauth_no_id_token" });
      res.redirect(errorRedirect);
      return;
    }
    idToken = tokenData.id_token;
  } catch (err) {
    logger.error({ msg: "google_oauth_token_fetch_error", err });
    res.redirect(errorRedirect);
    return;
  }

  // Validate id_token via Google tokeninfo endpoint
  let googleSub: string;
  let email: string;
  let name: string | undefined;
  let picture: string | undefined;
  try {
    const infoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!infoRes.ok) {
      logger.warn({ msg: "google_oauth_tokeninfo_failed", status: infoRes.status });
      res.redirect(errorRedirect);
      return;
    }
    const info = await infoRes.json() as {
      sub?: string; email?: string; name?: string; picture?: string;
      email_verified?: string; aud?: string;
    };
    if (!info.sub || !info.email) {
      res.redirect(errorRedirect);
      return;
    }
    if (info.aud !== clientId) {
      logger.warn({ msg: "google_oauth_aud_mismatch", aud: info.aud });
      res.redirect(errorRedirect);
      return;
    }
    if (info.email_verified !== "true") {
      res.redirect(oauthSignInRedirect(frontendBase, lang, "google_unverified"));
      return;
    }
    googleSub = info.sub;
    email = info.email.toLowerCase().trim();
    name = info.name;
    picture = info.picture;
  } catch (err) {
    logger.error({ msg: "google_oauth_tokeninfo_error", err });
    res.redirect(errorRedirect);
    return;
  }

  const sessionDays = clampSessionDays(settings.sessionDays);
  const oauthIp = clientIpKey(req);
  let oauthIsNewAccount = false;

  // Find or create user
  let [user] = await db.select(oauthUserSelect).from(usersTable).where(eq(usersTable.googleId, googleSub)).limit(1);

  if (!user) {
    // Try linking by email
    const [existingByEmail] = await db.select(oauthUserSelect).from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (existingByEmail) {
      const [updated] = await db.update(usersTable)
        .set({
          googleId: googleSub,
          authProvider: "google",
          avatarUrl: existingByEmail.avatarUrl ?? picture ?? undefined,
          lastLoginAt: new Date(),
          lastLoginIp: oauthIp,
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, existingByEmail.id))
        .returning(oauthUserSelect);
      user = updated;
      logger.info({ msg: "google_oauth_link", userId: existingByEmail.id, email });
    }
  }

  if (!user) {
    const isAdmin = await shouldBootstrapAdmin(email);
    const id = crypto.randomUUID();
    const acquisition = acquisitionFromRequest(req);
    try {
      const [created] = await db.insert(usersTable).values({
        id,
        email,
        name: name ?? undefined,
        avatarUrl: picture ?? undefined,
        googleId: googleSub,
        authProvider: "google",
        isAdmin,
        // Country left unset — user picks it on Account (offers / coupons emails).
        lastLoginAt: new Date(),
        lastLoginIp: oauthIp !== "unknown" ? oauthIp : undefined,
        signupIp: oauthIp !== "unknown" ? oauthIp : undefined,
        ...(acquisition ?? {}),
      }).returning(authSessionUserSelect);
      user = created;
      oauthIsNewAccount = true;
      clearAcquisitionCookie(res);
      logger.info({ msg: "google_oauth_register", userId: id, email });
    } catch (err) {
      if (!isPgUniqueViolation(err)) throw err;
      const [existing] = await db.select(oauthUserSelect).from(usersTable)
        .where(or(eq(usersTable.googleId, googleSub), eq(usersTable.email, email)))
        .limit(1);
      user = existing;
    }
  } else {
    user = await syncUserAdminFlag(user);
    await db.update(usersTable)
      .set({ lastLoginAt: new Date(), lastLoginIp: oauthIp, updatedAt: new Date() })
      .where(eq(usersTable.id, user.id));
    logger.info({ msg: "google_oauth_login", userId: user.id, email });
  }

  if (!user) {
    res.redirect(errorRedirect);
    return;
  }

  if (user.isBanned) {
    res.redirect(oauthSignInRedirect(frontendBase, lang, "banned"));
    return;
  }

  const token = await signJwt(user.id, sessionDays);
  setAuthCookie(res, token, sessionDays);
  await trackUserSessionAccess(req, res, user.id, { isNewAccount: oauthIsNewAccount });

  res.redirect(oauthSuccessRedirect(frontendBase, lang, user));
});


// POST /auth/set-password — OAuth-only accounts set a local password (authenticated)
router.post("/auth/set-password", requireAuth, async (req, res) => {
  const { password } = req.body as { password?: string };
  const userId = req.userId!;

  if (!password || typeof password !== "string") {
    res.status(400).json({ error: "Password is required" });
    return;
  }

  const passwordCheck = validatePassword(password);
  if (!passwordCheck.ok) {
    res.status(400).json({ error: passwordCheck.error, code: passwordCheck.code });
    return;
  }

  const [user] = await db.select(authSessionUserSelect).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (user.passwordHash) {
    res.status(400).json({ error: "Password is already set for this account", code: "PASSWORD_ALREADY_SET" });
    return;
  }

  const passwordHash = await hashPassword(password);
  const [updated] = await db.update(usersTable)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(usersTable.id, userId))
    .returning(authSessionUserSelect);

  if (!updated) {
    res.status(500).json({ error: "Failed to set password" });
    return;
  }

  logger.info({ msg: "auth_set_password", userId });

  res.json({ ok: true, user: getPublicUser(updated) });
});

// POST /auth/logout
router.post("/auth/logout", async (req, res) => {
  const token: string | undefined = req.cookies?.[COOKIE_NAME];
  if (token) {
    try {
      const { jti, exp } = await verifyJwt(token);
      if (jti) await revokeToken(jti, new Date(exp * 1000));
    } catch {
      // Token invalid/expired — nothing to revoke
    }
  }
  clearAuthCookie(res);
  clearAdminUnlockCookie(res);
  logger.info({ msg: "auth_logout" });
  res.json({ ok: true });
});

// GET /auth/me
router.get("/auth/me", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const token: string | undefined = req.cookies?.[COOKIE_NAME];
  if (!token) {
    res.json({ user: null });
    return;
  }

  let sub: string;
  let jti: string | undefined;
  try {
    const payload = await verifyJwt(token);
    sub = payload.sub;
    jti = payload.jti;
  } catch {
    clearAuthCookie(res);
    res.json({ user: null });
    return;
  }

  if (jti && await isTokenRevoked(jti)) {
    clearAuthCookie(res);
    res.json({ user: null });
    return;
  }

  try {
    const [user] = await db
      .select(authSessionUserSelect)
      .from(usersTable)
      .where(eq(usersTable.id, sub))
      .limit(1);
    if (!user) {
      clearAuthCookie(res);
      res.json({ user: null });
      return;
    }

    const synced = await syncUserAdminFlag(user);

    if (synced.isBanned) {
      clearAuthCookie(res);
      res.json({ user: null, banned: true });
      return;
    }

    const configuredDays = await getConfiguredSessionDays();
    const { expiresAt } = await refreshSessionIfNeeded(res, synced.id, token, configuredDays);

    res.json({
      user: getPublicUser(synced),
      sessionExpiresAt: expiresAt.toISOString(),
    });
  } catch (err) {
    logger.error({ err, userId: sub }, "auth_me_failed");
    if (!res.headersSent) {
      res.status(500).json({ error: "Unable to load session" });
    }
  }
});

// POST /auth/presence — signed-in customers only; auth first, then per-user rate limit.
router.post("/auth/presence", requireAuth, presenceHeartbeatLimiter, async (req, res) => {
  await touchUserPresence(req.userId!);
  res.json({ ok: true });
});

export default router;
