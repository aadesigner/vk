import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "@/i18n/context";
import type { Language } from "@/lib/languages";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2, CheckCircle2 } from "lucide-react";
import { AUTH_ERROR, AUTH_INPUT, AUTH_LABEL, AuthPageShell } from "@/components/auth-page-shell";
import { SEOHead } from "@/components/seo";
import { PasswordRequirements } from "@/components/password-requirements";
import { isPasswordStrongEnough, getPasswordErrorMessage } from "@/lib/password-policy";
import { translateClientError } from "@/lib/translate-client-error";
import { getPostAuthRedirectPath, applyPostAuthRedirect } from "@/lib/checkout-vin-flow";
import { pathFor } from "@/lib/localized-routes";
import { cn } from "@/lib/utils";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function SetPasswordPage() {
  const { language, t } = useTranslation();
  const { user, isLoaded, isSignedIn, refreshUser } = useAuth();
  const [, setLocation] = useLocation();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setLocation(pathFor(language, "sign_in"));
      return;
    }
    if (user?.hasPassword) {
      applyPostAuthRedirect(getPostAuthRedirectPath(language), setLocation);
    }
  }, [isLoaded, isSignedIn, user?.hasPassword, language, setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError(t("reset_passwords_mismatch"));
      return;
    }
    if (!isPasswordStrongEnough(password)) {
      setError(getPasswordErrorMessage(t, password));
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${basePath}/api/auth/set-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string; code?: string };
      if (!res.ok) {
        setError(translateClientError(t, data.code, data.error));
        return;
      }
      await refreshUser();
      setDone(true);
      setTimeout(() => applyPostAuthRedirect(getPostAuthRedirectPath(language), setLocation), 2000);
    } catch {
      setError(t("error_network"));
    } finally {
      setLoading(false);
    }
  };

  if (!isLoaded || !isSignedIn || user?.hasPassword) {
    return (
      <div className="min-h-[calc(100dvh-64px)] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      <SEOHead
        title={`${t("set_password_title")} — verifykm.com`}
        description={t("set_password_subtitle")}
        lang={language as Language}
        noIndex
      />
      <AuthPageShell>
        {done ? (
          <div className="text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e7f6ff] text-[#0088d4]">
              <CheckCircle2 className="h-7 w-7" />
            </span>
            <h1 className="mt-5 text-[1.65rem] font-bold tracking-tight text-slate-950">{t("set_password_done_title")}</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{t("set_password_done_desc")}</p>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h1 className="text-[1.65rem] font-bold tracking-tight text-slate-950 sm:text-[1.85rem]">{t("set_password_title")}</h1>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{t("set_password_subtitle")}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password" className={AUTH_LABEL}>{t("auth_password_label")}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder={t("auth_password_placeholder_signup")}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    disabled={loading}
                    className={cn(AUTH_INPUT, "pr-11")}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-400 transition-colors hover:text-slate-800"
                    onClick={() => setShowPassword(v => !v)}
                    tabIndex={-1}
                    aria-label={showPassword ? t("auth_password_hide") : t("auth_password_show")}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {password.length > 0 && (
                  <PasswordRequirements password={password} className="mt-2" />
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm" className={AUTH_LABEL}>{t("reset_confirm_label")}</Label>
                <div className="relative">
                  <Input
                    id="confirm"
                    type={showConfirm ? "text" : "password"}
                    placeholder={t("reset_confirm_placeholder")}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    required
                    autoComplete="new-password"
                    disabled={loading}
                    className={cn(AUTH_INPUT, "pr-11")}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-400 transition-colors hover:text-slate-800"
                    onClick={() => setShowConfirm(v => !v)}
                    tabIndex={-1}
                    aria-label={showConfirm ? t("auth_password_hide") : t("auth_password_show")}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className={AUTH_ERROR} role="alert">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="h-12 w-full rounded-xl text-[15px] font-semibold"
                disabled={loading || !isPasswordStrongEnough(password) || password !== confirm}
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" />{t("set_password_submitting")}</>
                ) : (
                  t("set_password_submit")
                )}
              </Button>
            </form>
          </>
        )}
      </AuthPageShell>
    </>
  );
}
