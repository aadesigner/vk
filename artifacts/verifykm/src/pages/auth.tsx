import { useState, useEffect, useRef } from "react";
import { pathFor } from "@/lib/localized-routes";
import { useLocation, Link } from "wouter";
import { useAuth, ApiRequestError } from "@/lib/auth-context";
import { useTranslation } from "@/i18n/context";
import { useRecaptcha, executeRecaptchaToken } from "@/hooks/use-recaptcha";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { AUTH_ERROR, AUTH_INPUT, AuthPageShell } from "@/components/auth-page-shell";
import { SEOHead, usePageSeo } from "@/components/seo";
import { translateAuthOAuthError, translateClientError } from "@/lib/translate-client-error";
import { getPostAuthRedirectPath, applyPostAuthRedirect, captureVinFromSearch } from "@/lib/checkout-vin-flow";
import { prefetchRoute } from "@/lib/prefetch-route";
import { PasswordRequirements } from "@/components/password-requirements";
import {
  readAuthCredentials,
  resolveAuthRecaptchaToken,
  validateAuthSignupInput,
} from "@/lib/auth-email-submit";
import {
  parseUserCountryCode,
} from "@/lib/user-countries";
import { UserCountrySelect } from "@/components/user-country-select";
import { cn } from "@/lib/utils";
import { captureAcquisitionOnce, syncAcquisitionCookie } from "@/lib/acquisition";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function AuthField({
  id,
  label,
  optional,
  hint,
  className,
  children,
}: {
  id: string;
  label: string;
  optional?: string;
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-2 min-w-0", className)}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className="text-[12px] font-semibold tracking-tight text-slate-500">
          {label}
          {optional ? (
            <span className="ml-1 font-normal text-muted-foreground">{optional}</span>
          ) : null}
        </Label>
        {hint}
      </div>
      {children}
    </div>
  );
}

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  publicSettingsQueryOptions,
  parseOAuthPublicFlags,
  readPersistedOAuthFlags,
  persistOAuthFlags,
  resolveOAuthPublicFlags,
  readPersistedOAuthAsPublicSettings,
  oauthFlagsAnyEnabled,
} from "@/lib/public-settings";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  );
}

const SOCIAL_BTN = "flex h-12 w-full items-center justify-center gap-2.5 rounded-full border border-slate-200 bg-white text-sm font-semibold text-slate-900 transition-colors hover:border-[#00a5fd] hover:bg-[#f3f9fd]";

type SocialProviderId = "facebook" | "google";

function SocialAuthButtons({
  language,
  mode,
  googleEnabled,
  facebookEnabled,
  loading,
}: {
  language: string;
  mode: "sign-in" | "sign-up";
  googleEnabled: boolean;
  facebookEnabled: boolean;
  loading?: boolean;
}) {
  const { t } = useTranslation();
  const isSignIn = mode === "sign-in";

  const providers: Array<{
    id: SocialProviderId;
    enabled: boolean;
    href: string;
    label: string;
    icon: React.ReactNode;
  }> = [
    {
      id: "google",
      enabled: googleEnabled,
      href: `${basePath}/api/auth/google?lang=${language}`,
      label: isSignIn ? t("auth_continue_with_google") : t("auth_signup_with_google"),
      icon: <GoogleIcon className="h-4 w-4 shrink-0" />,
    },
    {
      id: "facebook",
      enabled: facebookEnabled,
      href: `${basePath}/api/auth/facebook?lang=${language}`,
      label: isSignIn ? t("auth_continue_with_facebook") : t("auth_signup_with_facebook"),
      icon: <FacebookIcon className="h-4 w-4 shrink-0 text-[#1877F2]" />,
    },
  ];

  const active = providers.filter((p) => p.enabled);
  const count = active.length;

  if (loading) {
    return (
      <div className="mt-6 space-y-3">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-[11px] font-medium uppercase tracking-wider text-slate-400">
            <span className="bg-white px-3">{t("or")}</span>
          </div>
        </div>
        <div className="space-y-2">
          {Array.from({ length: Math.max(count, 2) }).map((_, i) => (
            <div key={i} className="h-12 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (count === 0) return null;

  return (
    <div className="mt-6 space-y-2.5">
      <p className="text-center text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{t("or")}</p>
      <div className="space-y-2">
        {active.map((provider) => (
          <a
            key={provider.id}
            href={provider.href}
            onClick={() => {
              captureAcquisitionOnce();
              syncAcquisitionCookie();
            }}
            className={SOCIAL_BTN}
          >
            {provider.icon}
            <span>{provider.label}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

interface AuthFormProps {
  lang: string;
  mode: "sign-in" | "sign-up";
}

export function AuthForm({ mode: initialMode }: AuthFormProps) {
  const { user, login, register, isSignedIn, isLoaded } = useAuth();
  const { language, t } = useTranslation();
  const { getToken: getRecaptchaToken, enabled: rcEnabled, ready: rcReady, siteKey: rcSiteKey } = useRecaptcha();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const oauthError = searchParams.get("error");
  const persistedOAuthRef = useRef(readPersistedOAuthFlags());
  const {
    data: oauthSettings,
    isPending: oauthSettingsPending,
    isFetched: oauthSettingsFetched,
    isError: oauthSettingsError,
    refetch: refetchOAuthSettings,
  } = useQuery(publicSettingsQueryOptions());

  useEffect(() => {
    void queryClient.ensureQueryData(publicSettingsQueryOptions());
  }, [queryClient]);

  useEffect(() => {
    if (!oauthSettingsFetched || !oauthSettings) return;
    const flags = parseOAuthPublicFlags(oauthSettings);
    if (oauthFlagsAnyEnabled(flags)) {
      persistOAuthFlags(flags);
      persistedOAuthRef.current = flags;
      return;
    }
    // Only clear stored flags after a successful fetch that confirms all providers are off.
    if (oauthSettingsError) return;
    const cached = persistedOAuthRef.current ?? readPersistedOAuthFlags();
    if (!oauthFlagsAnyEnabled(cached)) {
      persistOAuthFlags(flags);
      persistedOAuthRef.current = null;
    }
  }, [oauthSettingsFetched, oauthSettings, oauthSettingsError]);

  useEffect(() => {
    const onPageShow = () => {
      void refetchOAuthSettings();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [refetchOAuthSettings]);

  // After OAuth cancel the server redirects here with ?error=… — refetch in background.
  useEffect(() => {
    if (!oauthError) return;
    void refetchOAuthSettings();
  }, [oauthError, refetchOAuthSettings]);

  const liveOAuthFlags = oauthSettingsFetched
    ? parseOAuthPublicFlags(oauthSettings)
    : null;
  const cachedOAuthFlags = persistedOAuthRef.current ?? readPersistedOAuthFlags();
  const resolvedOAuth = oauthSettingsFetched
    ? resolveOAuthPublicFlags(liveOAuthFlags, cachedOAuthFlags)
    : (cachedOAuthFlags ?? parseOAuthPublicFlags(oauthSettings));
  const googleEnabled = resolvedOAuth.googleEnabled;
  const facebookEnabled = resolvedOAuth.facebookEnabled;
  const socialSettingsLoading = !oauthFlagsAnyEnabled(resolvedOAuth)
    && oauthSettingsPending
    && !oauthSettingsError;
  const [mode, setMode] = useState(initialMode);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [countryCode, setCountryCode] = useState("");
  const [geoCountryHint, setGeoCountryHint] = useState<string | null>(null);
  const [countryHintLoaded, setCountryHintLoaded] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const recaptchaPrimeRef = useRef<Promise<string | null> | null>(null);
  const recaptchaPrimeAtRef = useRef(0);

  /** Sign-in and sign-up share one form — reset sensitive fields when switching tabs. */
  const switchAuthMode = (nextMode: "sign-in" | "sign-up") => {
    setMode(nextMode);
    setError("");
    setPassword("");
    setShowPassword(false);
    recaptchaPrimeRef.current = null;
    if (nextMode === "sign-in") {
      setName("");
      setAcceptedTerms(false);
    }
  };

  const recaptchaAction = mode === "sign-in" ? "login" : "register";

  const primeRecaptcha = () => {
    if (!rcEnabled || !rcSiteKey || loading) return;
    const now = Date.now();
    if (recaptchaPrimeRef.current && now - recaptchaPrimeAtRef.current < 800) return;
    recaptchaPrimeAtRef.current = now;
    recaptchaPrimeRef.current = rcReady
      ? executeRecaptchaToken(rcSiteKey, recaptchaAction)
      : getRecaptchaToken(recaptchaAction);
  };

  const syncFieldFromInput = (field: "email" | "password" | "name", value: string) => {
    if (field === "email") setEmail(value);
    else if (field === "password") setPassword(value);
    else setName(value);
  };

  const [error, setError] = useState("");

  // Referral / checkout guest landings pass ?vin= so post-auth can return to checkout with it filled.
  useEffect(() => {
    captureVinFromSearch();
  }, []);

  // Prefill country from IP (informational — does not affect geo redirects).
  useEffect(() => {
    if (mode !== "sign-up" || countryHintLoaded) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`${basePath}/api/auth/geo-country`, { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json() as { countryCode?: string | null };
        const parsed = parseUserCountryCode(data.countryCode);
        if (!cancelled && parsed) {
          setGeoCountryHint(parsed);
          setCountryCode((prev) => prev || parsed);
        }
      } catch {
        /* ignore — user still picks manually */
      } finally {
        if (!cancelled) setCountryHintLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [mode, countryHintLoaded]);

  useEffect(() => {
    if (oauthError) setError(translateAuthOAuthError(t, oauthError));
  }, [oauthError, t]);

  // If already signed in on an auth page with ?vin=, go straight to checkout with prefill.
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    applyPostAuthRedirect(getPostAuthRedirectPath(language), setLocation);
  }, [isLoaded, isSignedIn, language, setLocation]);

  useEffect(() => {
    if (mode === "sign-up") prefetchRoute("checkout");
  }, [mode]);

  useEffect(() => {
    if (!isLoaded || isSignedIn || mode !== "sign-up") return;

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    const attach = () => {
      const el = passwordRef.current;
      if (!el || cancelled) return;
      cleanup?.();

      const syncPasswordFromDom = () => {
        if (el.value) syncFieldFromInput("password", el.value);
      };
      const onAutofillAnim = (e: AnimationEvent) => {
        if (e.animationName === "native-autofill-start") syncPasswordFromDom();
      };
      el.addEventListener("animationstart", onAutofillAnim);
      const timer = window.setTimeout(syncPasswordFromDom, 200);
      const timer2 = window.setTimeout(syncPasswordFromDom, 600);
      cleanup = () => {
        el.removeEventListener("animationstart", onAutofillAnim);
        window.clearTimeout(timer);
        window.clearTimeout(timer2);
      };
    };

    attach();
    const retry = window.setTimeout(attach, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(retry);
      cleanup?.();
    };
  }, [isLoaded, isSignedIn, mode]);

  const isSignIn = mode === "sign-in";
  const seo = usePageSeo(isSignIn ? "auth" : "sign_up");

  // Signed-in users redirect; guests see the form immediately (don't wait on /me).
  if (isSignedIn || (user !== null && !isLoaded)) {
    return (
      <div className="min-h-[calc(100dvh-64px)] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    const form = e.currentTarget;
    const isSignInMode = mode === "sign-in";
    const creds = readAuthCredentials(form, { email, password, name });

    if (!isSignInMode) {
      const signupCheck = validateAuthSignupInput(creds, acceptedTerms, t, countryCode);
      if (!signupCheck.ok) {
        setError(signupCheck.error);
        return;
      }
    }

    setLoading(true);
    try {
      if (rcEnabled && !rcReady) {
        setError(t("error_recaptcha_loading"));
        return;
      }

      const primed = recaptchaPrimeRef.current;
      recaptchaPrimeRef.current = null;

      const recaptchaToken = await resolveAuthRecaptchaToken({
        enabled: rcEnabled,
        siteKey: rcSiteKey,
        action: recaptchaAction,
        primed,
        getToken: getRecaptchaToken,
      });

      if (rcEnabled && !recaptchaToken) {
        setError(t("error_recaptcha_failed"));
        return;
      }

      if (isSignInMode) {
        await login(creds.email, creds.password, recaptchaToken);
      } else {
        await register(creds.email, creds.password, creds.name || undefined, recaptchaToken, countryCode);
      }
      applyPostAuthRedirect(getPostAuthRedirectPath(language), setLocation);
    } catch (err) {
      const code = err instanceof ApiRequestError ? err.code : undefined;
      const message = err instanceof Error ? err.message : undefined;
      setError(translateClientError(t, code, message));
    } finally {
      setLoading(false);
    }
  };

  const submitDisabled = loading || (!isSignIn && (!acceptedTerms || !countryCode));

  return (
    <>
      <SEOHead title={seo.title} description={seo.description} lang={seo.lang} noIndex />
      <AuthPageShell hideLogo>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={mode}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <div className="mb-7 text-center">
                  <h1 className="text-[1.85rem] font-extrabold tracking-[-0.04em] text-slate-950 sm:text-[2.05rem]">
                    {isSignIn ? t("auth_welcome_back") : t("auth_create_account")}
                  </h1>
                  <p className="mx-auto mt-2 max-w-[22rem] text-sm leading-relaxed text-slate-500">
                    {isSignIn ? t("auth_signin_subtitle") : t("auth_signup_subtitle")}
                  </p>
                  <div className="mt-5 flex items-center justify-center gap-6 text-sm font-semibold">
                    <button
                      type="button"
                      onClick={() => switchAuthMode("sign-in")}
                      className={cn(
                        "relative pb-1.5 transition-colors",
                        isSignIn ? "text-slate-950" : "text-slate-400 hover:text-slate-700",
                      )}
                    >
                      {t("sign_in")}
                      {isSignIn ? <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-[#00a5fd]" /> : null}
                    </button>
                    <button
                      type="button"
                      onClick={() => switchAuthMode("sign-up")}
                      className={cn(
                        "relative pb-1.5 transition-colors",
                        !isSignIn ? "text-slate-950" : "text-slate-400 hover:text-slate-700",
                      )}
                    >
                      {t("sign_up")}
                      {!isSignIn ? <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-[#00a5fd]" /> : null}
                    </button>
                  </div>
                </div>

                <form onSubmit={handleSubmit} autoComplete="on" className="space-y-4">
                  {!isSignIn ? (
                    <div className="grid grid-cols-[minmax(0,1fr)_8.75rem] items-start gap-2 sm:grid-cols-[minmax(0,1fr)_9.5rem] sm:gap-3">
                      <AuthField
                        id="name"
                        label={t("auth_name_label")}
                        optional={t("auth_name_optional")}
                      >
                        <Input
                          id="name"
                          name="name"
                          type="text"
                          placeholder={t("auth_name_placeholder")}
                          value={name}
                          onChange={e => setName(e.target.value)}
                          onInput={e => syncFieldFromInput("name", e.currentTarget.value)}
                          autoComplete="name"
                          disabled={loading}
                          className={cn(AUTH_INPUT, "auth-field-input")}
                        />
                      </AuthField>
                      <AuthField id="country" label={t("auth_country_label")}>
                        <UserCountrySelect
                          id="country"
                          value={countryCode}
                          onValueChange={setCountryCode}
                          preferredCode={geoCountryHint}
                          placeholder={t("auth_country_placeholder")}
                          searchPlaceholder={t("auth_country_search")}
                          emptySearchLabel={t("auth_country_search_empty")}
                          disabled={loading}
                          size="lg"
                          triggerClassName={cn(AUTH_INPUT, "justify-between px-2.5 sm:px-3")}
                          contentClassName="min-w-[16.5rem]"
                        />
                      </AuthField>
                    </div>
                  ) : null}

                  <AuthField id="email" label={t("email")}>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder={t("auth_email_placeholder")}
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      onInput={e => syncFieldFromInput("email", e.currentTarget.value)}
                      required
                      autoComplete={isSignIn ? "username" : "email"}
                      disabled={loading}
                      className={cn(AUTH_INPUT, "auth-field-input")}
                    />
                  </AuthField>

                  <AuthField
                    id="password"
                    label={t("auth_password_label")}
                    hint={isSignIn ? (
                      <Link
                        href={`/${language}/forgot-password`}
                        className="text-xs font-semibold text-[#0088d4] hover:underline shrink-0"
                      >
                        {t("forgot_password_link")}
                      </Link>
                    ) : undefined}
                  >
                    <div className="relative">
                      <Input
                        ref={passwordRef}
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        placeholder={isSignIn ? t("auth_password_placeholder_signin") : t("auth_password_placeholder_signup")}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        onInput={e => syncFieldFromInput("password", e.currentTarget.value)}
                        required
                        minLength={isSignIn ? 1 : 6}
                        autoComplete={isSignIn ? "current-password" : "new-password"}
                        disabled={loading}
                        className={cn(AUTH_INPUT, "pr-11 auth-field-input")}
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-400 hover:text-slate-800 transition-colors rounded-r-xl"
                        onClick={() => setShowPassword(v => !v)}
                        tabIndex={-1}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>

                    <AnimatePresence>
                      {!isSignIn && password.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <PasswordRequirements password={password} className="pt-2" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </AuthField>

                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className={AUTH_ERROR}
                        role="alert"
                      >
                        {error}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {!isSignIn && (
                    <div className="flex items-start gap-3 rounded-2xl bg-[#f3f7fb] px-3.5 py-3">
                      <Checkbox
                        id="accept-terms"
                        checked={acceptedTerms}
                        onCheckedChange={(v) => setAcceptedTerms(v === true)}
                        disabled={loading}
                        className="mt-0.5 h-5 w-5 shrink-0 rounded-[5px] border-muted-foreground/40 data-[state=checked]:border-primary [&_svg]:h-[0.95rem] [&_svg]:w-[0.95rem] max-sm:mr-0.5"
                      />
                      <label
                        htmlFor="accept-terms"
                        className="text-[13px] leading-snug text-slate-600 cursor-pointer select-none"
                      >
                        {t("auth_accept_terms_lead")}{" "}
                        <a
                          href={pathFor(language, "terms")}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline underline-offset-2 hover:text-foreground"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {t("terms")}
                        </a>{" "}
                        {t("auth_accept_terms_and")}{" "}
                        <a
                          href={pathFor(language, "privacy")}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline underline-offset-2 hover:text-foreground"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {t("auth_privacy_link")}
                        </a>
                      </label>
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="h-12 w-full rounded-full text-[15px] font-bold"
                    disabled={submitDisabled}
                    onPointerDown={primeRecaptcha}
                    onTouchStart={primeRecaptcha}
                  >
                    {loading ? (
                      <><Loader2 className="h-4 w-4 animate-spin mr-2" />{isSignIn ? t("auth_signing_in") : t("auth_creating_account")}</>
                    ) : (
                      isSignIn ? t("sign_in") : t("sign_up")
                    )}
                  </Button>
                </form>
              </motion.div>
            </AnimatePresence>

            <SocialAuthButtons
              language={language}
              mode={mode}
              googleEnabled={googleEnabled}
              facebookEnabled={facebookEnabled}
              loading={socialSettingsLoading}
            />

            <p className="mt-7 text-center text-sm text-slate-500">
              {isSignIn ? (
                <>
                  {t("auth_no_account")}{" "}
                  <button type="button" className="font-semibold text-[#0088d4] hover:underline" onClick={() => switchAuthMode("sign-up")}>
                    {t("auth_sign_up_free")}
                  </button>
                </>
              ) : (
                <>
                  {t("auth_have_account")}{" "}
                  <button type="button" className="font-semibold text-[#0088d4] hover:underline" onClick={() => switchAuthMode("sign-in")}>
                    {t("sign_in")}
                  </button>
                </>
              )}
            </p>
      </AuthPageShell>
    </>
  );
}
