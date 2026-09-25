import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useTranslation } from "@/i18n/context";
import type { Language } from "@/lib/languages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { AUTH_ERROR, AUTH_INPUT, AUTH_LABEL, AuthPageShell } from "@/components/auth-page-shell";
import { SEOHead } from "@/components/seo";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

import { PasswordRequirements } from "@/components/password-requirements";
import { isPasswordStrongEnough, getPasswordErrorMessage } from "@/lib/password-policy";
import { translateClientError } from "@/lib/translate-client-error";
import { pathFor } from "@/lib/localized-routes";
import { cn } from "@/lib/utils";

export default function ResetPasswordPage() {
  const { language, t } = useTranslation();
  const [, setLocation] = useLocation();

  const token = new URLSearchParams(window.location.search).get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [tokenExpired, setTokenExpired] = useState(false);

  useEffect(() => {
    if (!token) {
      setTokenValid(false);
      return;
    }
    fetch(`${basePath}/api/auth/reset-password?token=${encodeURIComponent(token)}`, {
      credentials: "include",
    })
      .then(r => r.json())
      .then((data: { valid?: boolean; expired?: boolean }) => {
        setTokenValid(data.valid ?? false);
        setTokenExpired(data.expired ?? false);
      })
      .catch(() => setTokenValid(false));
  }, [token]);

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
      const res = await fetch(`${basePath}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(translateClientError(t, data.code, data.error));
      } else {
        setDone(true);
        setTimeout(() => setLocation(pathFor(language, "sign_in")), 3000);
      }
    } catch {
      setError(t("error_network"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SEOHead
        title={`${t("reset_title")} — verifykm.com`}
        description={t("reset_subtitle")}
        lang={language as Language}
        noIndex
      />
      <AuthPageShell>
        {done ? (
          <div className="text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e7f6ff] text-[#0088d4]">
              <CheckCircle2 className="h-7 w-7" />
            </span>
            <h1 className="mt-5 text-[1.65rem] font-bold tracking-tight text-slate-950">{t("reset_done_title")}</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{t("reset_done_desc")}</p>
          </div>
        ) : tokenValid === null ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : tokenValid === false ? (
          <>
            <div className={cn(AUTH_ERROR, "flex items-start gap-2")}>
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                {tokenExpired ? t("reset_expired") : t("reset_invalid")}{" "}
                <Link href={`/${language}/forgot-password`} className="font-semibold underline">
                  {t("reset_request_new")}
                </Link>
                .
              </span>
            </div>
            <Link
              href={pathFor(language, "sign_in")}
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-[#0088d4] hover:underline"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("back_to_sign_in")}
            </Link>
          </>
        ) : (
          <>
            <Link
              href={pathFor(language, "sign_in")}
              className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("back_to_sign_in")}
            </Link>
            <div className="mb-6">
              <h1 className="text-[1.65rem] font-bold tracking-tight text-slate-950 sm:text-[1.85rem]">{t("reset_title")}</h1>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{t("reset_subtitle")}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password" className={AUTH_LABEL}>{t("reset_new_password_label")}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder={t("reset_new_password_placeholder")}
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
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" />{t("reset_submitting")}</>
                ) : (
                  t("reset_submit")
                )}
              </Button>
            </form>
          </>
        )}
      </AuthPageShell>
    </>
  );
}
