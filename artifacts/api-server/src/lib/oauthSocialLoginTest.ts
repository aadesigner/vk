import type { SystemSettings } from "@workspace/db";
import { sql } from "drizzle-orm";
import { isExemptApiPath } from "./trustedClient.js";
import {
  isFacebookOAuthConfigured,
  isGoogleOAuthConfigured,
} from "./oauthSettings.js";

export type SocialProvider = "google" | "facebook";

export type OAuthCheckResult = {
  id: string;
  label: string;
  ok: boolean;
  message: string;
  hint?: string;
};

export type SocialLoginTestResult = {
  provider: SocialProvider;
  label: string;
  ok: boolean;
  checks: OAuthCheckResult[];
};

export type SocialLoginTestReport = {
  ok: boolean;
  siteOrigin: string;
  testedAt: string;
  results: SocialLoginTestResult[];
};

export type SocialLoginTestOverrides = {
  googleLoginEnabled?: boolean;
  googleClientId?: string | null;
  googleClientSecret?: string | null;
  facebookLoginEnabled?: boolean;
  facebookAppId?: string | null;
  facebookAppSecret?: string | null;
};

type FetchFn = typeof fetch;

const PROVIDER_LABELS: Record<SocialProvider, string> = {
  google: "Google",
  facebook: "Facebook",
};

const PROVIDER_ID_COLUMNS: Record<SocialProvider, string> = {
  google: "google_id",
  facebook: "facebook_id",
};

function trim(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

export function resolveSiteOrigin(proto: string, host: string): string {
  const scheme = proto.split(",")[0]?.trim() || "https";
  const hostname = host.split(",")[0]?.trim() || "localhost";
  return `${scheme}://${hostname}`.replace(/\/+$/, "");
}

export function buildOAuthRedirectUri(siteOrigin: string, provider: SocialProvider): string {
  return `${siteOrigin}/api/auth/${provider}/callback`;
}

export function applySocialLoginTestOverrides(
  base: SystemSettings | null,
  overrides?: SocialLoginTestOverrides,
): SystemSettings | null {
  if (!base) return null;
  if (!overrides) return base;
  return {
    ...base,
    ...overrides,
  } as SystemSettings;
}

function check(
  id: string,
  label: string,
  ok: boolean,
  message: string,
  hint?: string,
): OAuthCheckResult {
  return { id, label, ok, message, hint };
}

function providerCredentials(settings: SystemSettings, provider: SocialProvider): {
  clientId: string;
  clientSecret: string;
  enabled: boolean;
} {
  if (provider === "google") {
    return {
      enabled: settings.googleLoginEnabled !== false,
      clientId: trim(settings.googleClientId),
      clientSecret: trim(settings.googleClientSecret),
    };
  }
  return {
    enabled: settings.facebookLoginEnabled !== false,
    clientId: trim(settings.facebookAppId),
    clientSecret: trim(settings.facebookAppSecret),
  };
}

function isProviderConfigured(settings: SystemSettings, provider: SocialProvider): boolean {
  if (provider === "google") return isGoogleOAuthConfigured(settings);
  return isFacebookOAuthConfigured(settings);
}

export async function verifyGoogleCredentials(
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  fetchFn: FetchFn = fetch,
): Promise<OAuthCheckResult> {
  try {
    const tokenRes = await fetchFn("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: "verifykm-admin-invalid-code",
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }).toString(),
      signal: AbortSignal.timeout(10_000),
    });
    const data = await tokenRes.json() as { error?: string; error_description?: string };
    if (data.error === "invalid_client") {
      return check(
        "provider_api",
        "Provider credentials",
        false,
        "Google rejected the client ID or secret.",
        "Confirm the OAuth client is a Web application and the secret matches Google Cloud Console.",
      );
    }
    if (data.error === "invalid_grant" || data.error === "redirect_uri_mismatch") {
      return check(
        "provider_api",
        "Provider credentials",
        true,
        "Google accepted the client ID and secret (authorization code probe failed as expected).",
        `Add this redirect URI in Google Cloud Console: ${redirectUri}`,
      );
    }
    return check(
      "provider_api",
      "Provider credentials",
      false,
      data.error_description || data.error || `Unexpected Google response (${tokenRes.status}).`,
    );
  } catch {
    return check(
      "provider_api",
      "Provider credentials",
      false,
      "Could not reach Google OAuth — check server network access.",
    );
  }
}

export async function verifyFacebookCredentials(
  appId: string,
  appSecret: string,
  fetchFn: FetchFn = fetch,
): Promise<OAuthCheckResult> {
  try {
    const tokenRes = await fetchFn(
      `https://graph.facebook.com/v19.0/oauth/access_token?${new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        grant_type: "client_credentials",
      })}`,
      { signal: AbortSignal.timeout(10_000) },
    );
    const data = await tokenRes.json() as { access_token?: string; error?: { message?: string; type?: string } };
    if (data.access_token) {
      return check(
        "provider_api",
        "Provider credentials",
        true,
        "Facebook accepted the App ID and App Secret.",
      );
    }
    const message = data.error?.message || `Facebook rejected credentials (${tokenRes.status}).`;
    return check(
      "provider_api",
      "Provider credentials",
      false,
      message,
      "Use the App ID and App Secret from Facebook Developer Portal → Settings → Basic.",
    );
  } catch {
    return check(
      "provider_api",
      "Provider credentials",
      false,
      "Could not reach Facebook Graph API — check server network access.",
    );
  }
}

export async function verifyUserProviderColumn(provider: SocialProvider): Promise<OAuthCheckResult> {
  const column = PROVIDER_ID_COLUMNS[provider];
  try {
    const { db } = await import("@workspace/db");
    const result = await db.execute(sql`
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = ${column}
      LIMIT 1
    `);
    const rows = result.rows as unknown[];
    if (rows.length > 0) {
      return check(
        "db_schema",
        "Database ready",
        true,
        `users.${column} column exists for returning-user login.`,
      );
    }
    return check(
      "db_schema",
      "Database ready",
      false,
      `Missing users.${column} column — run database migrations.`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Database check failed";
    return check("db_schema", "Database ready", false, message);
  }
}

export async function runSocialLoginProviderTest(
  provider: SocialProvider,
  settings: SystemSettings | null,
  siteOrigin: string,
  fetchFn: FetchFn = fetch,
): Promise<SocialLoginTestResult> {
  const label = PROVIDER_LABELS[provider];
  const checks: OAuthCheckResult[] = [];
  const redirectUri = buildOAuthRedirectUri(siteOrigin, provider);
  const initPath = `/auth/${provider}`;

  if (!settings) {
    checks.push(check("configured", "Saved settings", false, "No system settings row found."));
    return { provider, label, ok: false, checks };
  }

  const { enabled, clientId, clientSecret } = providerCredentials(settings, provider);

  checks.push(
    enabled
      ? check("enabled", "Enabled", true, `${label} sign-in is enabled.`)
      : check(
        "enabled",
        "Enabled",
        false,
        `${label} sign-in is disabled in admin settings.`,
        "Turn on the provider toggle and save.",
      ),
  );

  if (!clientId) {
    checks.push(check("client_id", "Client / App ID", false, "Client ID is missing."));
  } else {
    checks.push(check("client_id", "Client / App ID", true, "Client ID is saved."));
  }

  if (!clientSecret) {
    checks.push(check("client_secret", "Client secret", false, "Client secret is missing.", "Enter the secret on first save — it cannot be left blank initially."));
  } else {
    checks.push(check("client_secret", "Client secret", true, "Client secret is saved."));
  }

  const buttonVisible = isProviderConfigured(settings);
  checks.push(
    buttonVisible
      ? check("login_button", "Login page button", true, "The sign-in page will show this provider.")
      : check(
        "login_button",
        "Login page button",
        false,
        "The sign-in page will hide this provider until enabled, ID, and secret are all set.",
      ),
  );

  checks.push(
    check(
      "redirect_uri",
      "Redirect URI",
      true,
      redirectUri,
      `Add this exact URL in the ${label} developer console.`,
    ),
  );

  checks.push(
    isExemptApiPath(initPath)
      ? check("oauth_route", "OAuth start route", true, `${initPath} is reachable without the client guard header.`)
      : check("oauth_route", "OAuth start route", false, `${initPath} is blocked by the API client guard.`),
  );

  checks.push(await verifyUserProviderColumn(provider));

  checks.push(
    check(
      "flow_returning",
      "Returning user login",
      buttonVisible,
      buttonVisible
        ? `Callback looks up users by ${PROVIDER_ID_COLUMNS[provider]} then signs them in.`
        : "Skipped until provider is fully configured.",
    ),
  );

  checks.push(
    check(
      "flow_email_link",
      "Existing account (same email)",
      buttonVisible,
      buttonVisible
        ? "If the email already exists, the provider ID is linked and the user is signed in."
        : "Skipped until provider is fully configured.",
    ),
  );

  checks.push(
    check(
      "flow_register",
      "New user registration",
      buttonVisible,
      buttonVisible
        ? "If no user matches, a new account is created and the user is signed in."
        : "Skipped until provider is fully configured.",
    ),
  );

  if (enabled && clientId && clientSecret) {
    if (provider === "google") {
      checks.push(await verifyGoogleCredentials(clientId, clientSecret, redirectUri, fetchFn));
    } else {
      checks.push(await verifyFacebookCredentials(clientId, clientSecret, fetchFn));
    }
  } else {
    checks.push(check(
      "provider_api",
      "Provider credentials",
      false,
      "Skipped — save enabled flag, client ID, and secret first.",
    ));
  }

  const ok = checks.every((c) => c.ok);
  return { provider, label, ok, checks };
}

export async function runAllSocialLoginTests(
  settings: SystemSettings | null,
  siteOrigin: string,
  fetchFn: FetchFn = fetch,
): Promise<SocialLoginTestReport> {
  const providers: SocialProvider[] = ["google", "facebook"];
  const results = await Promise.all(
    providers.map((provider) => runSocialLoginProviderTest(provider, settings, siteOrigin, fetchFn)),
  );
  return {
    ok: results.every((r) => r.ok),
    siteOrigin,
    testedAt: new Date().toISOString(),
    results,
  };
}
