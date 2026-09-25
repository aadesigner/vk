import { useState } from "react";
import { Link } from "wouter";
import { useTranslation } from "@/i18n/context";
import { useRecaptcha } from "@/hooks/use-recaptcha";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { AUTH_ERROR, AUTH_INPUT, AUTH_LABEL, AuthPageShell } from "@/components/auth-page-shell";
import { SEOHead, usePageSeo } from "@/components/seo";
import { translateClientError } from "@/lib/translate-client-error";
import { pathFor } from "@/lib/localized-routes";
import { cn } from "@/lib/utils";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function ForgotPasswordPage() {
  const { language, t } = useTranslation();
  const { getToken, enabled: rcEnabled, ready: rcReady } = useRecaptcha();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const seo = usePageSeo("forgot_password");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (rcEnabled && !rcReady) {
      setError(t("error_recaptcha_loading"));
      return;
    }

    setLoading(true);
    try {
      const recaptchaToken = await getToken("forgot_password") ?? undefined;
      if (rcEnabled && !recaptchaToken) {
        setError(t("error_recaptcha_failed"));
        return;
      }

      const res = await fetch(`${basePath}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, recaptchaToken, lang: language }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string; code?: string };
      if (!res.ok) {
        setError(translateClientError(t, data.code, data.error));
      } else {
        setSent(true);
      }
    } catch {
      setError(t("error_network"));
    } finally {
      setLoading(false);
    }
  };

  const submitDisabled = loading || (rcEnabled && !rcReady);

  return (
    <>
      <SEOHead
        title={seo.title}
        description={seo.description}
        lang={seo.lang}
        canonicalPath={seo.canonicalPath}
        noIndex
      />
      <AuthPageShell>
        {sent ? (
          <div className="text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e7f6ff] text-[#0088d4]">
              <MailCheck className="h-7 w-7" />
            </span>
            <h1 className="mt-5 text-[1.65rem] font-bold tracking-tight text-slate-950">{t("forgot_sent_title")}</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {t("forgot_sent_desc").replace("{email}", email)}
            </p>
            <div className="mt-5 rounded-xl border border-slate-200 bg-[#f7fafc] px-4 py-3 text-sm font-medium text-slate-800">
              {email}
            </div>
            <Link
              href={pathFor(language, "sign_in")}
              className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#0088d4] hover:underline"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("back_to_sign_in")}
            </Link>
          </div>
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
              <h1 className="text-[1.65rem] font-bold tracking-tight text-slate-950 sm:text-[1.85rem]">{t("forgot_title")}</h1>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{t("forgot_subtitle")}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className={AUTH_LABEL}>{t("email")}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t("auth_email_placeholder")}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  disabled={loading}
                  className={cn(AUTH_INPUT, "auth-field-input")}
                />
              </div>

              {error && (
                <div className={AUTH_ERROR} role="alert">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="h-12 w-full rounded-xl text-[15px] font-semibold"
                disabled={submitDisabled}
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" />{t("forgot_sending")}</>
                ) : (
                  t("forgot_send_button")
                )}
              </Button>
            </form>
          </>
        )}
      </AuthPageShell>
    </>
  );
}
