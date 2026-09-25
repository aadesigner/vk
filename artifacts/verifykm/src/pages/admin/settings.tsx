import { useState, useEffect } from "react";
import { useAdminGetSettings, useAdminUpdateSettings } from "@workspace/api-client-react";
import { adminSettingsQuery } from "@/lib/admin-query-options";
import { AdminQueryFallback } from "@/components/admin-query-fallback";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Save, Mail, Info, CreditCard, Send, CheckCircle2, XCircle,
  Search, Eye, Globe, Trash2, Database, Loader2, Wrench, Download, Upload,
} from "lucide-react";
import {
  MAINTENANCE_PARTIAL_RESTRICTIONS,
  type MaintenancePartialRestriction,
} from "@/lib/maintenance-policy";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AdminTrackingSettings } from "@/components/admin/admin-tracking-settings";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type PaymentsForm = {
  paypalClientId: string;
  paypalClientSecret: string;
  paypalSandbox: boolean;
  paypalEnableCards: boolean;
  pokMerchantId: string;
  pokKeyId: string;
  pokKeySecret: string;
  pokEnv: "staging" | "production";
};

type SocialForm = {
  googleLoginEnabled: boolean;
  googleClientId: string;
  googleClientSecret: string;
  facebookLoginEnabled: boolean;
  facebookAppId: string;
  facebookAppSecret: string;
};

type SocialLoginCheck = {
  id: string;
  label: string;
  ok: boolean;
  message: string;
  hint?: string;
};

type SocialLoginProviderResult = {
  provider: string;
  label: string;
  ok: boolean;
  checks: SocialLoginCheck[];
};

type SocialLoginTestReport = {
  ok: boolean;
  siteOrigin: string;
  testedAt: string;
  results: SocialLoginProviderResult[];
  error?: string;
};

type SmtpSecurityLevel = "starttls" | "ssl" | "none";

function loadSmtpSecurity(raw: unknown, port: number): SmtpSecurityLevel {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "ssl" || s === "none" || s === "starttls") return s;
  return port === 465 ? "ssl" : "starttls";
}

type AuthForm = {
  smtpEnabled: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecurity: SmtpSecurityLevel;
  smtpUser: string;
  smtpPass: string;
  smtpFromEmail: string;
  smtpFromName: string;
  sessionDays: number;
  requireHttps: boolean;
};

type BotForm = {
  recaptchaEnabled: boolean;
  recaptchaSiteKey: string;
  recaptchaSecretKey: string;
};

type GeneralForm = {
  vinLookupEnabled: boolean;
  maintenanceMode: boolean;
  maintenanceRestrictions: MaintenancePartialRestriction[];
  maintenanceMessage: string;
};

type SystemForm = {
  freeVinDecoderEnabled: boolean;
  freeVinDecoderDailyLimit: number;
  freeVinDecoderRequireSignIn: boolean;
  rateLimit: number;
  rateLimitWindow: number;
  maxVinsPerDay: number;
  abuseDetectionEnabled: boolean;
  logRetentionDays: number;
  failedTxnRetentionDays: number;
  krwPerUsd: number;
};

function TabSaveButton({
  isPending, saved, label, onClick,
}: { isPending: boolean; saved: boolean; label: string; onClick: () => void }) {
  return (
    <div className="flex justify-end pt-2">
      <Button disabled={isPending} className="h-10 px-6 font-semibold gap-2" onClick={onClick}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" />
          : saved ? <CheckCircle2 className="h-4 w-4" />
          : <Save className="h-4 w-4" />}
        {saved ? "Saved!" : isPending ? "Saving…" : label}
      </Button>
    </div>
  );
}

export default function AdminSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: settings, isLoading, isError, error, refetch, isFetching } = useAdminGetSettings({
    query: adminSettingsQuery(),
  });

  const notifySaved = (label: string) => {
    toast({ title: "Saved", description: `${label} updated successfully.` });
  };

  const notifySaveError = (label: string, err: Error) => {
    toast({
      variant: "destructive",
      title: "Save failed",
      description: err.message || `Could not save ${label.toLowerCase()}.`,
    });
  };

  const [paymSaved, setPaymSaved] = useState(false);
  const [paymError, setPaymError] = useState("");
  const [hasPaypalSecret, setHasPaypalSecret] = useState(false);
  const [hasPokSecret, setHasPokSecret] = useState(false);
  const [hasGoogleSecret, setHasGoogleSecret] = useState(false);
  const [hasFacebookSecret, setHasFacebookSecret] = useState(false);
  const [hasSmtpPass, setHasSmtpPass] = useState(false);
  const [hasRecaptchaSecret, setHasRecaptchaSecret] = useState(false);
  const [socialSaved, setSocialSaved] = useState(false);
  const [socialTestStatus, setSocialTestStatus] = useState<"idle" | "testing" | "done">("idle");
  const [socialTestReport, setSocialTestReport] = useState<SocialLoginTestReport | null>(null);
  const [authSaved, setAuthSaved] = useState(false);
  const [botSaved, setBotSaved] = useState(false);
  const [generalSaved, setGeneralSaved] = useState(false);
  const [sysSaved, setSysSaved] = useState(false);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
    queryClient.invalidateQueries({ queryKey: ["/api/payments/public-settings"] });
  };

  const paymUpdater = useAdminUpdateSettings({
    mutation: {
      onSuccess: () => {
        invalidate();
        setPaymError("");
        setPaymSaved(true);
        notifySaved("Payment settings");
        if (payments.paypalClientSecret.trim()) setHasPaypalSecret(true);
        if (payments.pokKeySecret.trim()) setHasPokSecret(true);
        setPayments((f) => ({ ...f, paypalClientSecret: "", pokKeySecret: "" }));
        setTimeout(() => setPaymSaved(false), 2000);
      },
      onError: (err: Error) => {
        const message = err.message || "Failed to save payment settings";
        setPaymError(message);
        notifySaveError("Payment settings", err);
      },
    },
  });
  const authUpdater = useAdminUpdateSettings({
    mutation: {
      onSuccess: () => {
        invalidate();
        setAuthSaved(true);
        notifySaved("Auth settings");
        if (auth.smtpPass.trim()) setHasSmtpPass(true);
        setAuth((f) => ({ ...f, smtpPass: "" }));
        setTimeout(() => setAuthSaved(false), 2000);
      },
      onError: (err: Error) => notifySaveError("Auth settings", err),
    },
  });
  const botUpdater = useAdminUpdateSettings({
    mutation: {
      onSuccess: () => {
        invalidate();
        setBotSaved(true);
        notifySaved("Bot protection settings");
        if (bot.recaptchaSecretKey.trim()) setHasRecaptchaSecret(true);
        setBot((f) => ({ ...f, recaptchaSecretKey: "" }));
        setTimeout(() => setBotSaved(false), 2000);
      },
      onError: (err: Error) => notifySaveError("Bot protection settings", err),
    },
  });
  const generalUpdater = useAdminUpdateSettings({
    mutation: {
      onSuccess: () => {
        invalidate();
        setGeneralSaved(true);
        notifySaved("General settings");
        setTimeout(() => setGeneralSaved(false), 2000);
      },
      onError: (err: Error) => notifySaveError("General settings", err),
    },
  });
  const sysUpdater = useAdminUpdateSettings({
    mutation: {
      onSuccess: () => {
        invalidate();
        setSysSaved(true);
        notifySaved("System settings");
        setTimeout(() => setSysSaved(false), 2000);
      },
      onError: (err: Error) => notifySaveError("System settings", err),
    },
  });
  const socialUpdater = useAdminUpdateSettings({
    mutation: {
      onSuccess: (data, { data: payload }) => {
        invalidate();
        setSocialSaved(true);
        notifySaved("Social login settings");
        const saved = data as unknown as Record<string, unknown> | undefined;
        if (saved) {
          if ("hasGoogleSecret" in saved) setHasGoogleSecret(!!saved.hasGoogleSecret);
          if ("hasFacebookSecret" in saved) setHasFacebookSecret(!!saved.hasFacebookSecret);
        } else {
          if (typeof payload.googleClientSecret === "string" && payload.googleClientSecret.trim()) {
            setHasGoogleSecret(true);
          }
          if (typeof payload.facebookAppSecret === "string" && payload.facebookAppSecret.trim()) {
            setHasFacebookSecret(true);
          }
        }
        setSocial((f) => ({
          ...f,
          googleClientSecret: "",
          facebookAppSecret: "",
        }));
        setTimeout(() => setSocialSaved(false), 2000);
      },
      onError: (err: Error) => notifySaveError("Social login settings", err),
    },
  });

  const [payments, setPayments] = useState<PaymentsForm>({
    paypalClientId: "", paypalClientSecret: "", paypalSandbox: true, paypalEnableCards: true,
    pokMerchantId: "", pokKeyId: "", pokKeySecret: "", pokEnv: "production",
  });
  const [social, setSocial] = useState<SocialForm>({
    googleLoginEnabled: true, googleClientId: "", googleClientSecret: "",
    facebookLoginEnabled: true, facebookAppId: "", facebookAppSecret: "",
  });
  const [auth, setAuth] = useState<AuthForm>({
    smtpEnabled: false, smtpHost: "", smtpPort: 587, smtpSecurity: "starttls", smtpUser: "", smtpPass: "",
    smtpFromEmail: "", smtpFromName: "verifykm", sessionDays: 30, requireHttps: false,
  });
  const [bot, setBot] = useState<BotForm>({
    recaptchaEnabled: false, recaptchaSiteKey: "", recaptchaSecretKey: "",
  });
  const [general, setGeneral] = useState<GeneralForm>({
    vinLookupEnabled: true,
    maintenanceMode: false,
    maintenanceRestrictions: [],
    maintenanceMessage: "",
  });
  const [system, setSystem] = useState<SystemForm>({
    freeVinDecoderEnabled: true, freeVinDecoderDailyLimit: 0, freeVinDecoderRequireSignIn: false,
    rateLimit: 100, rateLimitWindow: 60, maxVinsPerDay: 0,
    abuseDetectionEnabled: true,
    logRetentionDays: 4, failedTxnRetentionDays: 0,
    krwPerUsd: 1415,
  });

  const [smtpTestEmail, setSmtpTestEmail] = useState("");
  const [smtpTestStatus, setSmtpTestStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [smtpTestError, setSmtpTestError] = useState("");
  const [smtpTestHint, setSmtpTestHint] = useState("");
  const [recaptchaTestStatus, setRecaptchaTestStatus] = useState<"idle" | "testing" | "ok" | "error">("idle");
  const [recaptchaTestError, setRecaptchaTestError] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [backupExporting, setBackupExporting] = useState(false);
  const [backupImporting, setBackupImporting] = useState(false);
  const [backupConfirm, setBackupConfirm] = useState("");
  const [backupFile, setBackupFile] = useState<File | null>(null);

  useEffect(() => {
    if (!settings) return;
    const s = settings as unknown as Record<string, unknown>;
    setPayments({
      paypalClientId: (s.paypalClientId as string) ?? "",
      paypalClientSecret: "",
      paypalSandbox: (s.paypalSandbox as boolean) ?? true,
      paypalEnableCards: (s.paypalEnableCards as boolean) ?? true,
      pokMerchantId: (s.pokMerchantId as string) ?? "",
      pokKeyId: (s.pokKeyId as string) ?? "",
      pokKeySecret: "",
      pokEnv: (s.pokEnv as string) === "staging" ? "staging" : "production",
    });
    setHasPaypalSecret(!!s.hasPaypalSecret);
    setHasPokSecret(!!s.hasPokSecret);
    setHasGoogleSecret(!!s.hasGoogleSecret);
    setHasFacebookSecret(!!s.hasFacebookSecret);
    setHasSmtpPass(!!s.hasSmtpPass);
    setHasRecaptchaSecret(!!s.hasRecaptchaSecret);
    setSocial({
      googleLoginEnabled: (s.googleLoginEnabled as boolean) ?? true,
      googleClientId: (s.googleClientId as string) ?? "",
      googleClientSecret: "",
      facebookLoginEnabled: (s.facebookLoginEnabled as boolean) ?? true,
      facebookAppId: (s.facebookAppId as string) ?? "",
      facebookAppSecret: "",
    });
    setAuth({
      smtpEnabled: (s.smtpEnabled as boolean) ?? false,
      smtpHost: (s.smtpHost as string) ?? "",
      smtpPort: (s.smtpPort as number) ?? 587,
      smtpSecurity: loadSmtpSecurity(s.smtpSecurity, (s.smtpPort as number) ?? 587),
      smtpUser: (s.smtpUser as string) ?? "",
      smtpPass: "",
      smtpFromEmail: (s.smtpFromEmail as string) ?? "",
      smtpFromName: (s.smtpFromName as string) ?? "verifykm",
      sessionDays: (s.sessionDays as number) ?? 30,
      requireHttps: (s.requireHttps as boolean) ?? false,
    });
    setBot({
      recaptchaEnabled: (s.recaptchaEnabled as boolean) ?? false,
      recaptchaSiteKey: (s.recaptchaSiteKey as string) ?? "",
      recaptchaSecretKey: "",
    });
    setGeneral({
      vinLookupEnabled: (s.vinLookupEnabled as boolean) ?? true,
      maintenanceMode: (s.maintenanceMode as boolean) ?? false,
      maintenanceRestrictions: Array.isArray(s.maintenanceRestrictions)
        ? (s.maintenanceRestrictions as string[]).filter((x): x is MaintenancePartialRestriction =>
          MAINTENANCE_PARTIAL_RESTRICTIONS.includes(x as MaintenancePartialRestriction))
        : [],
      maintenanceMessage: (s.maintenanceMessage as string) ?? "",
    });
    setSystem({
      freeVinDecoderEnabled: (s.freeVinDecoderEnabled as boolean) ?? true,
      freeVinDecoderDailyLimit: (s.freeVinDecoderDailyLimit as number) ?? 0,
      freeVinDecoderRequireSignIn: (s.freeVinDecoderRequireSignIn as boolean) ?? false,
      rateLimit: settings.rateLimit,
      rateLimitWindow: settings.rateLimitWindow,
      maxVinsPerDay: settings.maxVinsPerDay,
      abuseDetectionEnabled: settings.abuseDetectionEnabled,
      logRetentionDays: (s.logRetentionDays as number) ?? 4,
      failedTxnRetentionDays: (s.failedTxnRetentionDays as number) ?? 0,
      krwPerUsd: (s.krwPerUsd as number) ?? 1415,
    });
  }, [settings]);

  const handlePreview = async () => {
    setPreviewLoading(true);
    setPreviewOpen(true);
    try {
      const resp = await fetch(`${basePath}/api/admin/email/preview`);
      const data = await resp.json() as { html?: string };
      setPreviewHtml(data.html ?? "");
    } catch {
      setPreviewHtml("<p style='padding:24px;color:red'>Failed to load preview</p>");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleTestSocialLogins = async () => {
    setSocialTestStatus("testing");
    setSocialTestReport(null);
    try {
      const overrides: Record<string, unknown> = {
        googleLoginEnabled: social.googleLoginEnabled,
        facebookLoginEnabled: social.facebookLoginEnabled,
      };
      if (social.googleClientId.trim()) overrides.googleClientId = social.googleClientId.trim();
      if (social.facebookAppId.trim()) overrides.facebookAppId = social.facebookAppId.trim();
      const googleSecret = social.googleClientSecret.trim();
      const facebookSecret = social.facebookAppSecret.trim();
      if (googleSecret) overrides.googleClientSecret = googleSecret;
      if (facebookSecret) overrides.facebookAppSecret = facebookSecret;

      const resp = await fetch(`${basePath}/api/admin/settings/test-social-logins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ overrides }),
      });
      const data = await resp.json() as SocialLoginTestReport;
      if (!resp.ok && !data.results?.length) {
        setSocialTestReport({
          ok: false,
          siteOrigin: "",
          testedAt: new Date().toISOString(),
          results: [],
          error: data.error ?? `Test failed (${resp.status})`,
        });
      } else {
        setSocialTestReport(data);
      }
      setSocialTestStatus("done");
    } catch {
      setSocialTestReport({
        ok: false,
        siteOrigin: "",
        testedAt: new Date().toISOString(),
        results: [],
        error: "Network error — stay signed in as admin and try again",
      });
      setSocialTestStatus("done");
    }
  };

  const handleTestRecaptcha = async () => {
    setRecaptchaTestStatus("testing");
    setRecaptchaTestError("");
    try {
      const resp = await fetch(`${basePath}/api/admin/settings/test-recaptcha`, {
        method: "POST",
        credentials: "include",
      });
      const data = await resp.json() as { ok?: boolean; error?: string };
      if (data.ok) setRecaptchaTestStatus("ok");
      else { setRecaptchaTestStatus("error"); setRecaptchaTestError(data.error ?? "reCAPTCHA key validation failed"); }
    } catch {
      setRecaptchaTestStatus("error");
      setRecaptchaTestError("Network error — check you are signed in as admin");
    }
  };

  const handleTestSmtp = async () => {
    if (!smtpTestEmail.trim()) return;
    if (!auth.smtpEnabled) {
      setSmtpTestStatus("error");
      setSmtpTestError("Enable SMTP first");
      return;
    }
    if (!auth.smtpHost.trim() || !auth.smtpUser.trim()) {
      setSmtpTestStatus("error");
      setSmtpTestError("SMTP host and username are required");
      return;
    }
    if (!auth.smtpPass.trim() && !hasSmtpPass) {
      setSmtpTestStatus("error");
      setSmtpTestError("Enter the SMTP password (or save it first), then test again");
      return;
    }
    setSmtpTestStatus("sending");
    setSmtpTestError("");
    setSmtpTestHint("");
    try {
      const resp = await fetch(`${basePath}/api/admin/email/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          to: smtpTestEmail.trim(),
          smtp: {
            smtpEnabled: auth.smtpEnabled,
            smtpHost: auth.smtpHost.trim() || null,
            smtpPort: auth.smtpPort,
            smtpSecurity: auth.smtpSecurity,
            smtpUser: auth.smtpUser.trim() || null,
            smtpPass: auth.smtpPass.trim() || undefined,
            smtpFromEmail: auth.smtpFromEmail.trim() || null,
            smtpFromName: auth.smtpFromName.trim() || null,
          },
        }),
      });
      const data = await resp.json().catch(() => ({})) as { ok?: boolean; error?: string; hint?: string };
      if (resp.ok && data.ok) setSmtpTestStatus("ok");
      else {
        setSmtpTestStatus("error");
        const gatewayTimeout = resp.status === 502 || resp.status === 504;
        setSmtpTestError(
          data.error
          ?? (gatewayTimeout
            ? "Mail test timed out or the server could not reach your SMTP host."
            : `Failed to send test email (${resp.status})`),
        );
        setSmtpTestHint(
          data.hint
          ?? (gatewayTimeout
            ? "On Railway, outbound SMTP is often blocked or slow. Try port 465 (SSL) or 587 (STARTTLS), verify credentials, or use a transactional email relay (SendGrid, Mailgun, etc.)."
            : ""),
        );
      }
    } catch {
      setSmtpTestStatus("error");
      setSmtpTestError("Network error — save settings, stay signed in as admin, then retry");
    }
  };

  const handleBackupExport = async () => {
    setBackupExporting(true);
    try {
      const resp = await fetch(`${basePath}/api/admin/backup/export`, {
        method: "GET",
        credentials: "include",
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error || `Export failed (${resp.status})`);
      }
      const blob = await resp.blob();
      const cd = resp.headers.get("Content-Disposition") ?? "";
      const match = /filename="?([^"]+)"?/i.exec(cd);
      const filename = match?.[1] ?? `verifykm-backup-${new Date().toISOString().slice(0, 10)}.json.gz`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ title: "Backup downloaded", description: "Keep this file private — it includes secrets and user data." });
    } catch (err) {
      toast({
        title: "Backup export failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBackupExporting(false);
    }
  };

  const handleBackupImport = async () => {
    if (!backupFile) {
      toast({ title: "Choose a backup file", variant: "destructive" });
      return;
    }
    if (backupConfirm.trim() !== "RESTORE BACKUP") {
      toast({
        title: "Confirm phrase required",
        description: "Type RESTORE BACKUP exactly to continue.",
        variant: "destructive",
      });
      return;
    }
    setBackupImporting(true);
    try {
      const body = new FormData();
      body.append("file", backupFile);
      body.append("confirmPhrase", "RESTORE BACKUP");
      const resp = await fetch(`${basePath}/api/admin/backup/import`, {
        method: "POST",
        credentials: "include",
        body,
      });
      const data = await resp.json().catch(() => ({})) as {
        ok?: boolean;
        error?: string;
        message?: string;
        counts?: Record<string, number>;
      };
      if (!resp.ok || !data.ok) {
        throw new Error(data.error || `Restore failed (${resp.status})`);
      }
      const total = data.counts
        ? Object.values(data.counts).reduce((n, v) => n + v, 0)
        : 0;
      toast({
        title: "Backup restored",
        description: data.message ?? `Replaced site data (${total.toLocaleString()} rows).`,
      });
      setBackupConfirm("");
      setBackupFile(null);
      invalidate();
      void queryClient.invalidateQueries();
    } catch (err) {
      toast({
        title: "Backup restore failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBackupImporting(false);
    }
  };

  const settingsSkeleton = (
    <div className="space-y-6 max-w-2xl min-w-0 w-full">
      <div>
        <h1 className="text-2xl font-extrabold">Settings</h1>
        <p className="text-muted-foreground mt-1">System configuration</p>
      </div>
      <Skeleton className="h-10 w-full rounded-lg" />
      <Card><CardContent className="pt-6 space-y-4">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
      </CardContent></Card>
    </div>
  );

  return (
    <AdminQueryFallback
      isLoading={isLoading}
      isError={isError}
      isFetching={isFetching}
      error={error}
      refetch={refetch}
      hasData={!!settings}
      message="Failed to load settings"
      skeleton={settingsSkeleton}
    >
    <div className="space-y-6 max-w-2xl min-w-0 w-full min-w-0 w-full">
      <div>
        <h1 className="text-2xl font-extrabold">Settings</h1>
        <p className="text-muted-foreground mt-1">System configuration</p>
      </div>

      <Tabs defaultValue="payments">
        <TabsList className="w-full h-auto gap-1.5 p-1.5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-8 lg:gap-1">
          <TabsTrigger value="payments" className="text-[11px] sm:text-xs lg:text-sm py-2.5 px-2 whitespace-normal leading-tight min-h-11">
            Payments
          </TabsTrigger>
          <TabsTrigger value="tracking" className="text-[11px] sm:text-xs lg:text-sm py-2.5 px-2 whitespace-normal leading-tight min-h-11">
            Tracking
          </TabsTrigger>
          <TabsTrigger value="social" className="text-[11px] sm:text-xs lg:text-sm py-2.5 px-2 whitespace-normal leading-tight min-h-11">
            <span className="lg:hidden">Social</span>
            <span className="hidden lg:inline">Social Login</span>
          </TabsTrigger>
          <TabsTrigger value="auth" className="text-[11px] sm:text-xs lg:text-sm py-2.5 px-2 whitespace-normal leading-tight min-h-11">
            <span className="lg:hidden">Auth</span>
            <span className="hidden lg:inline">Auth &amp; Access</span>
          </TabsTrigger>
          <TabsTrigger value="bot" className="text-[11px] sm:text-xs lg:text-sm py-2.5 px-2 whitespace-normal leading-tight min-h-11">
            <span className="lg:hidden">Bots</span>
            <span className="hidden lg:inline">Bot Protection</span>
          </TabsTrigger>
          <TabsTrigger value="general" className="text-[11px] sm:text-xs lg:text-sm py-2.5 px-2 whitespace-normal leading-tight min-h-11">
            General
          </TabsTrigger>
          <TabsTrigger value="system" className="text-[11px] sm:text-xs lg:text-sm py-2.5 px-2 whitespace-normal leading-tight min-h-11">
            <span className="lg:hidden">Limits</span>
            <span className="hidden lg:inline">System Limits</span>
          </TabsTrigger>
          <TabsTrigger value="backup" className="text-[11px] sm:text-xs lg:text-sm py-2.5 px-2 whitespace-normal leading-tight min-h-11">
            Backup
          </TabsTrigger>
        </TabsList>

        {/* ── PAYMENTS ─────────────────────────────────────────────────────── */}
        <TabsContent value="payments" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="h-4 w-4 text-[#003087]" />
                PayPal Payments
              </CardTitle>
              <CardDescription>
                Configure your PayPal credentials from{" "}
                <a href="https://developer.paypal.com/dashboard/" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                  developer.paypal.com
                </a>{" "}→ My Apps &amp; Credentials.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Client ID (public)</Label>
                <p className="text-xs text-muted-foreground">Shown to users in the PayPal button — not secret</p>
                <Input placeholder="AZl..." value={payments.paypalClientId} onChange={(e) => setPayments(f => ({ ...f, paypalClientId: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Client Secret (private)</Label>
                <p className="text-xs text-muted-foreground">Used server-side only to create/capture orders</p>
                <Input type="password" placeholder={hasPaypalSecret ? "••••••••  (leave blank to keep current)" : "EGl..."} value={payments.paypalClientSecret} onChange={(e) => setPayments(f => ({ ...f, paypalClientSecret: e.target.value }))} />
              </div>
              <div className="flex items-center gap-3 p-3 border rounded-lg">
                <Switch id="paypal-sandbox" checked={payments.paypalSandbox} onCheckedChange={(v) => setPayments(f => ({ ...f, paypalSandbox: v }))} />
                <div>
                  <Label htmlFor="paypal-sandbox" className="cursor-pointer">Sandbox Mode</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Use PayPal sandbox for testing — disable for live payments</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 border rounded-lg">
                <Switch id="paypal-cards" checked={payments.paypalEnableCards} onCheckedChange={(v) => setPayments(f => ({ ...f, paypalEnableCards: v }))} />
                <div>
                  <Label htmlFor="paypal-cards" className="cursor-pointer">Credit Card Payments</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Allow Visa / Mastercard / Amex via PayPal Hosted Fields</p>
                </div>
              </div>
              {payments.paypalEnableCards && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700/60 text-xs text-amber-700 dark:text-amber-400">
                  <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <p><strong>Advanced account approval required.</strong> Hosted Fields requires <strong>Advanced Card Payments</strong> enabled on your PayPal account.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="h-4 w-4 text-violet-600" />
                POK Card Payments
              </CardTitle>
              <CardDescription>
                Configure POK gateway credentials from{" "}
                <a href="https://pokpay.io/en" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                  pokpay.io
                </a>
                {" "}(Business / developer keys). Secrets stay on the server — never sent to the browser.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Merchant ID</Label>
                <Input
                  placeholder="Merchant UUID"
                  value={payments.pokMerchantId}
                  onChange={(e) => setPayments((f) => ({ ...f, pokMerchantId: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Key ID</Label>
                <Input
                  placeholder="POK key id"
                  value={payments.pokKeyId}
                  onChange={(e) => setPayments((f) => ({ ...f, pokKeyId: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Key Secret (private)</Label>
                <p className="text-xs text-muted-foreground">Used server-side only to create/confirm POK orders</p>
                <Input
                  type="password"
                  placeholder={hasPokSecret ? "••••••••  (leave blank to keep current)" : "POK key secret"}
                  value={payments.pokKeySecret}
                  onChange={(e) => setPayments((f) => ({ ...f, pokKeySecret: e.target.value }))}
                />
              </div>
              <div className="flex items-center gap-3 p-3 border rounded-lg">
                <Switch
                  id="pok-staging"
                  checked={payments.pokEnv === "staging"}
                  onCheckedChange={(v) => setPayments((f) => ({ ...f, pokEnv: v ? "staging" : "production" }))}
                />
                <div>
                  <Label htmlFor="pok-staging" className="cursor-pointer">Staging environment</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Use POK staging API for test cards — turn off for live payments
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Card checkout enables when Merchant ID, Key ID, and Key Secret are all set (admin or env fallback).
              </p>
            </CardContent>
          </Card>

          {paymError && <p className="text-sm text-destructive">{paymError}</p>}

          <TabSaveButton
            isPending={paymUpdater.isPending}
            saved={paymSaved}
            label="Save Payments"
            onClick={() => {
              setPaymError("");
              const clientId = payments.paypalClientId.trim();
              const clientSecret = payments.paypalClientSecret.trim();
              const pokMerchantId = payments.pokMerchantId.trim();
              const pokKeyId = payments.pokKeyId.trim();
              const pokKeySecret = payments.pokKeySecret.trim();
              const pokAny = !!(pokMerchantId || pokKeyId || pokKeySecret || hasPokSecret);
              const pokComplete = !!(pokMerchantId && pokKeyId && (pokKeySecret || hasPokSecret));

              if (clientId || clientSecret || hasPaypalSecret) {
                if (!clientId) {
                  setPaymError("PayPal Client ID is required when configuring PayPal.");
                  return;
                }
                if (!clientSecret && !hasPaypalSecret) {
                  setPaymError("PayPal Client Secret is required.");
                  return;
                }
              }
              if (pokAny && !pokComplete) {
                setPaymError("POK requires Merchant ID, Key ID, and Key Secret.");
                return;
              }
              if (!clientId && !hasPaypalSecret && !pokComplete) {
                setPaymError("Configure PayPal and/or POK credentials before saving.");
                return;
              }

              const payload: Record<string, unknown> = {
                paypalSandbox: payments.paypalSandbox,
                paypalEnableCards: payments.paypalEnableCards,
                pokEnv: payments.pokEnv,
              };
              if (clientId) payload.paypalClientId = clientId;
              if (clientSecret) payload.paypalClientSecret = clientSecret;
              if (pokMerchantId) payload.pokMerchantId = pokMerchantId;
              if (pokKeyId) payload.pokKeyId = pokKeyId;
              if (pokKeySecret) payload.pokKeySecret = pokKeySecret;
              paymUpdater.mutate({ data: payload as Parameters<typeof paymUpdater.mutate>[0]["data"] });
            }}
          />
        </TabsContent>

        {/* ── TRACKING (GTM / GA / Clarity / Meta) ───────────────────────────── */}
        <TabsContent value="tracking" className="space-y-4 mt-4">
          <AdminTrackingSettings
            onSaved={() => notifySaved("Tracking settings")}
            onSaveError={(err) => notifySaveError("Tracking settings", err)}
          />
        </TabsContent>

        {/* ── SOCIAL LOGIN ──────────────────────────────────────────────────── */}
        <TabsContent value="social" className="space-y-4 mt-4">

          <Card className="border-primary/20 bg-primary/[0.03]">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Test social login configuration</CardTitle>
              <CardDescription>
                Validates saved credentials with Google and Facebook, checks redirect URIs,
                login-page visibility, and documents register / existing-account / returning-user flows.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                disabled={socialTestStatus === "testing"}
                onClick={() => void handleTestSocialLogins()}
              >
                {socialTestStatus === "testing" ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Testing Google and Facebook…</>
                ) : (
                  <><Search className="h-4 w-4" />Run all social login tests</>
                )}
              </Button>

              {socialTestReport?.error && (
                <p className="text-sm text-destructive">{socialTestReport.error}</p>
              )}

              {socialTestReport?.results?.length ? (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Tested against <code className="bg-muted px-1 rounded">{socialTestReport.siteOrigin}</code>
                    {" · "}
                    {socialTestReport.ok ? (
                      <span className="text-[#0088d4] dark:text-[#00a5fd] font-medium">All providers passed</span>
                    ) : (
                      <span className="text-amber-700 dark:text-amber-400 font-medium">Some checks failed — review below</span>
                    )}
                  </p>
                  {socialTestReport.results.map((provider) => (
                    <div key={provider.provider} className="rounded-xl border bg-background/80 p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        {provider.ok ? (
                          <CheckCircle2 className="h-4 w-4 text-[#00a5fd] shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive shrink-0" />
                        )}
                        <p className="font-semibold text-sm">{provider.label}</p>
                      </div>
                      <ul className="space-y-1.5">
                        {provider.checks.map((item) => (
                          <li key={item.id} className="text-xs">
                            <div className="flex items-start gap-2">
                              {item.ok ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-[#00a5fd] mt-0.5 shrink-0" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
                              )}
                              <div className="min-w-0">
                                <span className="font-medium text-foreground/90">{item.label}: </span>
                                <span className={item.ok ? "text-muted-foreground" : "text-destructive"}>{item.message}</span>
                                {item.hint ? (
                                  <p className="text-muted-foreground mt-0.5">{item.hint}</p>
                                ) : null}
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* Google */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Google Sign-In
                  </CardTitle>
                  <CardDescription>
                    Create credentials in{" "}
                    <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                      Google Cloud Console
                    </a>{" "}→ OAuth 2.0 Client ID (Web application).
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 pt-0.5 shrink-0">
                  <Label htmlFor="google-enabled" className="text-sm text-muted-foreground">
                    {social.googleLoginEnabled ? "Enabled" : "Disabled"}
                  </Label>
                  <Switch
                    id="google-enabled"
                    checked={social.googleLoginEnabled}
                    onCheckedChange={(v) => setSocial(f => ({ ...f, googleLoginEnabled: v }))}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Client ID</Label>
                <Input placeholder="1234567890-abc...apps.googleusercontent.com" value={social.googleClientId} onChange={(e) => setSocial(f => ({ ...f, googleClientId: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Client Secret</Label>
                <Input type="password" placeholder={hasGoogleSecret ? "••••••••  (leave blank to keep current)" : "GOCSPX-..."} value={social.googleClientSecret} onChange={(e) => setSocial(f => ({ ...f, googleClientSecret: e.target.value }))} />
              </div>
              {(() => {
                const ready = social.googleLoginEnabled
                  && !!social.googleClientId.trim()
                  && (hasGoogleSecret || !!social.googleClientSecret.trim());
                return (
                  <p className={cn("text-xs", ready ? "text-[#0088d4] dark:text-[#00a5fd]" : "text-amber-700 dark:text-amber-400")}>
                    {ready
                      ? "Continue with Google will show on sign-in / sign-up after you save."
                      : "Button stays hidden until enabled, Client ID, and Client Secret are all set (enter the secret on first save)."}
                  </p>
                );
              })()}
              <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/60 border text-xs text-muted-foreground">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <p>Add as <strong>Authorized redirect URI</strong>: <code className="bg-muted px-1 py-0.5 rounded font-mono">https://your-domain.com/api/auth/google/callback</code></p>
              </div>
            </CardContent>
          </Card>

          {/* Facebook */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="#1877F2" aria-hidden="true">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                    Facebook Sign-In
                  </CardTitle>
                  <CardDescription>
                    Create credentials in{" "}
                    <a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                      Facebook Developer Portal
                    </a>{" "}→ Add Product → Facebook Login → Settings.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 pt-0.5 shrink-0">
                  <Label htmlFor="facebook-enabled" className="text-sm text-muted-foreground">
                    {social.facebookLoginEnabled ? "Enabled" : "Disabled"}
                  </Label>
                  <Switch
                    id="facebook-enabled"
                    checked={social.facebookLoginEnabled}
                    onCheckedChange={(v) => setSocial(f => ({ ...f, facebookLoginEnabled: v }))}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>App ID</Label>
                <Input placeholder="123456789012345" value={social.facebookAppId} onChange={(e) => setSocial(f => ({ ...f, facebookAppId: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>App Secret</Label>
                <Input type="password" placeholder={hasFacebookSecret ? "••••••••  (leave blank to keep current)" : "••••••••"} value={social.facebookAppSecret} onChange={(e) => setSocial(f => ({ ...f, facebookAppSecret: e.target.value }))} />
              </div>
              {(() => {
                const ready = social.facebookLoginEnabled
                  && !!social.facebookAppId.trim()
                  && (hasFacebookSecret || !!social.facebookAppSecret.trim());
                return (
                  <p className={cn("text-xs", ready ? "text-[#0088d4] dark:text-[#00a5fd]" : "text-amber-700 dark:text-amber-400")}>
                    {ready
                      ? "Continue with Facebook will show on sign-in / sign-up after you save."
                      : "Button stays hidden until enabled, App ID, and App Secret are all set (enter the secret on first save)."}
                  </p>
                );
              })()}
              <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/60 border text-xs text-muted-foreground">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <p>Add as <strong>Valid OAuth Redirect URI</strong>: <code className="bg-muted px-1 py-0.5 rounded font-mono">https://your-domain.com/api/auth/facebook/callback</code></p>
              </div>
            </CardContent>
          </Card>

          <TabSaveButton
            isPending={socialUpdater.isPending}
            saved={socialSaved}
            label="Save Social Login"
            onClick={() => {
              const payload: Record<string, unknown> = {
                googleLoginEnabled: social.googleLoginEnabled,
                googleClientId: social.googleClientId.trim() || null,
                facebookLoginEnabled: social.facebookLoginEnabled,
                facebookAppId: social.facebookAppId.trim() || null,
              };
              const googleSecret = social.googleClientSecret.trim();
              const facebookSecret = social.facebookAppSecret.trim();
              if (googleSecret) payload.googleClientSecret = googleSecret;
              if (facebookSecret) payload.facebookAppSecret = facebookSecret;
              socialUpdater.mutate({ data: payload as Parameters<typeof socialUpdater.mutate>[0]["data"] });
            }}
          />
        </TabsContent>

        {/* ── AUTH & ACCESS ────────────────────────────────────────────────── */}
        <TabsContent value="auth" className="space-y-4 mt-4">
          <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-950/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-400 text-base">
                <Mail className="h-4 w-4 shrink-0" />
                Email Verification
              </CardTitle>
              <CardDescription className="text-blue-600/80 dark:text-blue-400/70">
                Email verification on sign-up is not yet enforced — users can register immediately.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-100/60 dark:bg-blue-900/30 text-sm text-blue-700 dark:text-blue-300">
                <Info className="h-4 w-4 mt-0.5 shrink-0" />
                <p>To add email verification, implement a token-based confirmation flow in <strong>api-server/src/routes/auth.ts</strong>.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Mail className="h-4 w-4 text-primary" />
                    SMTP / Email
                  </CardTitle>
                  <CardDescription>Configure outgoing email for welcome, report-ready, and promo messages.</CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <Button variant="outline" size="sm" onClick={handlePreview} disabled={previewLoading} className="gap-1.5 text-xs">
                    <Eye className="h-3.5 w-3.5" />
                    Preview
                  </Button>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Enable SMTP</span>
                    <Switch checked={auth.smtpEnabled} onCheckedChange={(v) => setAuth(f => ({ ...f, smtpEnabled: v }))} />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <Label>SMTP Host</Label>
                  <Input placeholder="smtp.gmail.com" value={auth.smtpHost} onChange={(e) => setAuth(f => ({ ...f, smtpHost: e.target.value }))} disabled={!auth.smtpEnabled} />
                </div>
                <div className="space-y-1.5">
                  <Label>Port</Label>
                  <Input type="number" placeholder="587" value={auth.smtpPort} onChange={(e) => setAuth(f => ({ ...f, smtpPort: parseInt(e.target.value) || 587 }))} disabled={!auth.smtpEnabled} />
                </div>
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <Label>Security</Label>
                  <Select
                    value={auth.smtpSecurity}
                    onValueChange={(v) => setAuth(f => ({ ...f, smtpSecurity: v as SmtpSecurityLevel }))}
                    disabled={!auth.smtpEnabled}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="STARTTLS" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="starttls">STARTTLS (port 587 — recommended)</SelectItem>
                      <SelectItem value="ssl">SSL/TLS (port 465)</SelectItem>
                      <SelectItem value="none">None (plain — not recommended)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Must match your provider. Gmail/Outlook usually use STARTTLS on 587.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Username / Email</Label>
                  <Input placeholder="you@example.com" value={auth.smtpUser} onChange={(e) => setAuth(f => ({ ...f, smtpUser: e.target.value }))} disabled={!auth.smtpEnabled} />
                </div>
                <div className="space-y-1.5">
                  <Label>Password</Label>
                  <Input type="password" placeholder={hasSmtpPass ? "••••••••  (leave blank to keep current)" : "App password or SMTP key"} value={auth.smtpPass} onChange={(e) => setAuth(f => ({ ...f, smtpPass: e.target.value }))} disabled={!auth.smtpEnabled} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>From Email</Label>
                  <Input placeholder="noreply@verifykm.com" value={auth.smtpFromEmail} onChange={(e) => setAuth(f => ({ ...f, smtpFromEmail: e.target.value }))} disabled={!auth.smtpEnabled} />
                </div>
                <div className="space-y-1.5">
                  <Label>From Name</Label>
                  <Input placeholder="verifykm" value={auth.smtpFromName} onChange={(e) => setAuth(f => ({ ...f, smtpFromName: e.target.value }))} disabled={!auth.smtpEnabled} />
                </div>
              </div>
              <div className="border-t pt-4 space-y-2">
                <p className="text-xs text-muted-foreground">
                  Save SMTP settings below, then send a test. The test uses the form values (saved password is kept if the field is blank).
                </p>
                <Label className="text-muted-foreground text-xs uppercase tracking-wide">Test Email</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="recipient@example.com"
                    value={smtpTestEmail}
                    onChange={(e) => { setSmtpTestEmail(e.target.value); setSmtpTestStatus("idle"); }}
                    disabled={!auth.smtpEnabled}
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    onClick={handleTestSmtp}
                    disabled={!auth.smtpEnabled || smtpTestStatus === "sending" || !smtpTestEmail.trim()}
                    className="gap-1.5 shrink-0"
                  >
                    {smtpTestStatus === "sending" ? "Sending…"
                      : smtpTestStatus === "ok" ? <><CheckCircle2 className="h-4 w-4 text-[#00a5fd]" />Sent!</>
                      : smtpTestStatus === "error" ? <><XCircle className="h-4 w-4 text-destructive" />Failed</>
                      : <><Send className="h-4 w-4" />Send Test</>}
                  </Button>
                </div>
                {smtpTestStatus === "error" && smtpTestError && (
                  <div className="space-y-1">
                    <p className="text-xs text-destructive font-medium">{smtpTestError}</p>
                    {smtpTestHint && <p className="text-xs text-muted-foreground">{smtpTestHint}</p>}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Globe className="h-4 w-4 text-primary" />
                Session &amp; HTTPS
              </CardTitle>
              <CardDescription>Session duration and HTTPS enforcement</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Session Duration (days)</Label>
                <p className="text-xs text-muted-foreground">How long a login session stays valid (minimum 14 days; httpOnly cookie + local cache)</p>
                <Input
                  type="number" min={14} max={365}
                  value={auth.sessionDays}
                  onChange={(e) => setAuth(f => ({ ...f, sessionDays: Math.min(365, Math.max(14, Number(e.target.value) || 30)) }))}
                  className="max-w-[200px]"
                />
              </div>
              <div className="flex items-start gap-3">
                <Switch id="requireHttps" checked={auth.requireHttps} onCheckedChange={(v) => setAuth(f => ({ ...f, requireHttps: v }))} className="mt-0.5" />
                <div>
                  <Label htmlFor="requireHttps" className="cursor-pointer">Require HTTPS</Label>
                  <p className="text-xs text-muted-foreground">Redirect all plain HTTP requests to HTTPS. Only enable when served behind a TLS-terminating proxy.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <TabSaveButton
            isPending={authUpdater.isPending}
            saved={authSaved}
            label="Save Auth & Access"
            onClick={() => {
              const payload: Record<string, unknown> = {
                smtpEnabled: auth.smtpEnabled,
                smtpHost: auth.smtpHost.trim() || null,
                smtpPort: auth.smtpPort,
                smtpSecurity: auth.smtpSecurity,
                smtpUser: auth.smtpUser.trim() || null,
                smtpFromEmail: auth.smtpFromEmail.trim() || null,
                smtpFromName: auth.smtpFromName.trim() || null,
                sessionDays: auth.sessionDays,
                requireHttps: auth.requireHttps,
              };
              const smtpPass = auth.smtpPass.trim();
              if (smtpPass) payload.smtpPass = smtpPass;
              authUpdater.mutate({ data: payload as Parameters<typeof authUpdater.mutate>[0]["data"] });
            }}
          />
        </TabsContent>

        {/* ── BOT PROTECTION ───────────────────────────────────────────────── */}
        <TabsContent value="bot" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">reCAPTCHA v3</CardTitle>
              <CardDescription>
                Bot protection for VIN lookups. Get keys at{" "}
                <a href="https://www.google.com/recaptcha/admin" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                  google.com/recaptcha/admin
                </a>{" "}— choose "reCAPTCHA v3". Score threshold is configured under Security → reCAPTCHA.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 p-3 border rounded-lg">
                <Switch id="recaptcha-enabled" checked={bot.recaptchaEnabled} onCheckedChange={(v) => setBot(f => ({ ...f, recaptchaEnabled: v }))} />
                <div>
                  <Label htmlFor="recaptcha-enabled" className="cursor-pointer">reCAPTCHA v3 Enabled</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Require reCAPTCHA v3 on VIN form submissions to block bots</p>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Site Key (public)</Label>
                <Input placeholder="6Lc..." value={bot.recaptchaSiteKey} onChange={(e) => { setBot(f => ({ ...f, recaptchaSiteKey: e.target.value })); setRecaptchaTestStatus("idle"); }} />
              </div>
              <div className="space-y-1.5">
                <Label>Secret Key (private)</Label>
                <Input type="password" placeholder={hasRecaptchaSecret ? "••••••••  (leave blank to keep current)" : "6Lc..."} value={bot.recaptchaSecretKey} onChange={(e) => { setBot(f => ({ ...f, recaptchaSecretKey: e.target.value })); setRecaptchaTestStatus("idle"); }} />
              </div>
              <div className="border-t pt-4 space-y-2">
                <Label className="text-muted-foreground text-xs uppercase tracking-wide">Verify Keys</Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={handleTestRecaptcha}
                    disabled={recaptchaTestStatus === "testing" || !bot.recaptchaSiteKey || (!bot.recaptchaSecretKey && !hasRecaptchaSecret)}
                    className="gap-1.5"
                  >
                    {recaptchaTestStatus === "testing" ? "Testing…"
                      : recaptchaTestStatus === "ok" ? <><CheckCircle2 className="h-4 w-4 text-[#00a5fd]" />Keys Valid</>
                      : recaptchaTestStatus === "error" ? <><XCircle className="h-4 w-4 text-destructive" />Invalid</>
                      : "Test Keys"}
                  </Button>
                </div>
                {recaptchaTestStatus === "error" && recaptchaTestError && <p className="text-xs text-destructive">{recaptchaTestError}</p>}
              </div>
            </CardContent>
          </Card>

          <TabSaveButton
            isPending={botUpdater.isPending}
            saved={botSaved}
            label="Save Bot Protection"
            onClick={() => {
              const payload: Record<string, unknown> = {
                recaptchaEnabled: bot.recaptchaEnabled,
                recaptchaSiteKey: bot.recaptchaSiteKey.trim() || null,
              };
              const secret = bot.recaptchaSecretKey.trim();
              if (secret) payload.recaptchaSecretKey = secret;
              botUpdater.mutate({ data: payload as Parameters<typeof botUpdater.mutate>[0]["data"] });
            }}
          />
        </TabsContent>

        {/* ── GENERAL ──────────────────────────────────────────────────────── */}
        <TabsContent value="general" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Search className="h-4 w-4 text-primary" />
                Paid VIN lookup
              </CardTitle>
              <CardDescription>
                Turn off checkout and new VIN reports site-wide when you need to pause provider calls or fix an issue. Admins can still test.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-3 p-3 border rounded-xl hover:bg-muted/30 transition-colors">
                <Switch
                  id="vinLookupEnabled"
                  checked={general.vinLookupEnabled}
                  onCheckedChange={(v) => setGeneral((f) => ({ ...f, vinLookupEnabled: v }))}
                  className="mt-0.5"
                />
                <div>
                  <Label htmlFor="vinLookupEnabled" className="cursor-pointer">VIN lookup enabled</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    When off, visitors see a warning on VIN pages and cannot start checkout or run paid lookups.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Wrench className="h-4 w-4 text-primary" />
                Maintenance mode
              </CardTitle>
              <CardDescription>
                Block the whole site or restrict specific pages (free decoder, checkout, VIN reports). Admins always have access.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-start gap-3 p-3 border rounded-xl hover:bg-muted/30 transition-colors">
                <Switch
                  id="maintenanceMode"
                  checked={general.maintenanceMode}
                  onCheckedChange={(v) => setGeneral((f) => ({ ...f, maintenanceMode: v }))}
                  className="mt-0.5"
                />
                <div>
                  <Label htmlFor="maintenanceMode" className="cursor-pointer">Full site maintenance</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Public visitors see a “back soon” page on all routes except sign-in and legal pages.
                  </p>
                </div>
              </div>

              <div className={`space-y-3 ${general.maintenanceMode ? "opacity-50 pointer-events-none" : ""}`}>
                <Label className="text-sm">Partial restrictions (when full maintenance is off)</Label>
                {([
                  { key: "free_decoder" as const, label: "Free VIN decoder", desc: "Blocks /free-vin-decoder and decode API" },
                  { key: "checkout" as const, label: "Checkout & payments", desc: "Blocks checkout and PayPal order APIs" },
                  { key: "vin_reports" as const, label: "VIN reports", desc: "Blocks paid report views and lookup APIs" },
                ]).map(({ key, label, desc }) => (
                  <div key={key} className="flex items-start gap-3 p-3 border rounded-xl hover:bg-muted/30 transition-colors">
                    <Checkbox
                      id={`maint-${key}`}
                      checked={general.maintenanceRestrictions.includes(key)}
                      onCheckedChange={(checked) => {
                        setGeneral((f) => ({
                          ...f,
                          maintenanceRestrictions: checked
                            ? [...f.maintenanceRestrictions, key]
                            : f.maintenanceRestrictions.filter((r) => r !== key),
                        }));
                      }}
                      className="mt-0.5"
                    />
                    <div>
                      <Label htmlFor={`maint-${key}`} className="cursor-pointer">{label}</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="maintenanceMessage">Optional message (shown on maintenance page)</Label>
                <Textarea
                  id="maintenanceMessage"
                  value={general.maintenanceMessage}
                  onChange={(e) => setGeneral((f) => ({ ...f, maintenanceMessage: e.target.value }))}
                  placeholder="We're upgrading our servers — back in about 30 minutes."
                  rows={3}
                  maxLength={500}
                />
              </div>
            </CardContent>
          </Card>

          <TabSaveButton
            isPending={generalUpdater.isPending}
            saved={generalSaved}
            label="Save General"
            onClick={() => generalUpdater.mutate({ data: general as Parameters<typeof generalUpdater.mutate>[0]["data"] })}
          />
        </TabsContent>

        {/* ── SYSTEM LIMITS ────────────────────────────────────────────────── */}
        <TabsContent value="system" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Search className="h-4 w-4 text-primary" />
                Free VIN Decoder
              </CardTitle>
              <CardDescription>
                Control public access to <code className="text-xs bg-muted px-1 py-0.5 rounded">/free-vin-decoder</code>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 p-3 border rounded-lg">
                <Switch id="free-decoder-enabled" checked={system.freeVinDecoderEnabled} onCheckedChange={(v) => setSystem(f => ({ ...f, freeVinDecoderEnabled: v }))} />
                <div>
                  <Label htmlFor="free-decoder-enabled" className="cursor-pointer">Enabled</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Allow public access to the free VIN decoder page</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 border rounded-lg">
                <Switch id="free-decoder-signin" checked={system.freeVinDecoderRequireSignIn} onCheckedChange={(v) => setSystem(f => ({ ...f, freeVinDecoderRequireSignIn: v }))} />
                <div>
                  <Label htmlFor="free-decoder-signin" className="cursor-pointer">Require Sign-in</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Only allow authenticated users to decode VINs</p>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Daily Decode Limit per IP</Label>
                <p className="text-xs text-muted-foreground">Max free decodes per IP per day (0 = unlimited)</p>
                <Input type="number" min={0} value={system.freeVinDecoderDailyLimit} onChange={(e) => setSystem(f => ({ ...f, freeVinDecoderDailyLimit: Number(e.target.value) }))} className="max-w-[200px]" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Rate Limiting</CardTitle>
              <CardDescription>General API rate limits. Security-specific limits (login, registration, VIN) are in the Security page.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {([
                { key: "rateLimit" as const, label: "Request Rate Limit", desc: "Maximum requests per rate limit window" },
                { key: "rateLimitWindow" as const, label: "Rate Limit Window (seconds)", desc: "Time window for rate limiting in seconds" },
                { key: "maxVinsPerDay" as const, label: "Max VINs Per Day", desc: "Per-user daily limit (0 = unlimited)" },
              ]).map(({ key, label, desc }) => (
                <div key={key} className="space-y-1.5">
                  <Label>{label}</Label>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                  <Input type="number" min={0} value={system[key] as number} onChange={(e) => setSystem(f => ({ ...f, [key]: Number(e.target.value) }))} className="max-w-[200px]" />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Feature Flags</CardTitle>
              <CardDescription>Enable or disable site features</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {([
                { key: "abuseDetectionEnabled" as const, label: "Abuse Detection", desc: "Automatically detect and block suspicious activity" },
              ]).map(({ key, label, desc }) => (
                <div key={key} className="flex items-start gap-3 p-3 border rounded-xl hover:bg-muted/30 transition-colors">
                  <Switch id={key} checked={system[key] as boolean} onCheckedChange={(v) => setSystem(f => ({ ...f, [key]: v }))} className="mt-0.5" />
                  <div>
                    <Label htmlFor={key} className="cursor-pointer">{label}</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Korean report amounts (KRW → USD)</CardTitle>
              <CardDescription>
                Exchange rate for all Korean won amounts on VIN reports — insurance, registry, accidents, and prices. Shown as USD with original won faded in parentheses.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Korean won per 1 USD</Label>
                <p className="text-xs text-muted-foreground">
                  Used for every Korean won amount on VIN reports (insurance, registry, accidents). Shown as USD with original won in parentheses.
                  Existing reports use this live rate too — they no longer keep an old frozen conversion.
                  Example: at 1,415 — ₩7,060,220 displays as $4,990 (₩7,060,220)
                </p>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={system.krwPerUsd}
                  onChange={(e) => setSystem((f) => ({ ...f, krwPerUsd: Number(e.target.value) || 1415 }))}
                  className="max-w-[200px]"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="h-4 w-4 text-primary" />
                Automatic Cleanup
              </CardTitle>
              <CardDescription>
                Old records are purged every 6 hours. System logs default to 4 days retention.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>System Log Retention</Label>
                <p className="text-xs text-muted-foreground">Delete system logs older than this many days (0 uses the 4-day default)</p>
                <Select value={String(system.logRetentionDays)} onValueChange={(v) => setSystem(f => ({ ...f, logRetentionDays: Number(v) }))}>
                  <SelectTrigger className="max-w-[200px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">4 days (default)</SelectItem>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Failed Transaction Cleanup</Label>
                <p className="text-xs text-muted-foreground">Auto-delete failed payment records older than this period (0 = keep forever)</p>
                <Select value={String(system.failedTxnRetentionDays)} onValueChange={(v) => setSystem(f => ({ ...f, failedTxnRetentionDays: Number(v) }))}>
                  <SelectTrigger className="max-w-[200px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Keep forever</SelectItem>
                    <SelectItem value="7">1 week</SelectItem>
                    <SelectItem value="30">1 month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/60 border text-xs text-muted-foreground">
                <Trash2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <p>Purges run in batches of 500 rows with 200ms pauses to avoid overloading the DB.</p>
              </div>
            </CardContent>
          </Card>

          <TabSaveButton
            isPending={sysUpdater.isPending}
            saved={sysSaved}
            label="Save System Limits"
            onClick={() => sysUpdater.mutate({ data: system as Parameters<typeof sysUpdater.mutate>[0]["data"] })}
          />
        </TabsContent>

        {/* ── BACKUP ───────────────────────────────────────────────────────── */}
        <TabsContent value="backup" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Download className="h-4 w-4 text-primary" />
                Export backup
              </CardTitle>
              <CardDescription>
                Download a full snapshot: users, VINs, catalog, payments, settings (including secrets),
                coupons, announcements, providers, email logs, and related links. Use this before migration.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-muted-foreground">
                <Database className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-600" />
                <p>
                  The file contains passwords hashes, API keys, and personal data. Store it privately.
                  Format: <code className="text-[10px] bg-muted px-1 rounded">.json.gz</code>
                </p>
              </div>
              <Button
                type="button"
                onClick={() => void handleBackupExport()}
                disabled={backupExporting || backupImporting}
                className="gap-2"
              >
                {backupExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {backupExporting ? "Preparing backup…" : "Download full backup"}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-destructive/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-destructive">
                <Upload className="h-4 w-4" />
                Restore backup
              </CardTitle>
              <CardDescription>
                Replaces <strong>all</strong> current admin data with the backup. Intended for a fresh
                migrate target. This cannot be undone from the UI.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="backup-file">Backup file</Label>
                <Input
                  id="backup-file"
                  type="file"
                  accept=".json,.gz,.json.gz,application/gzip,application/json"
                  disabled={backupImporting || backupExporting}
                  onChange={(e) => setBackupFile(e.target.files?.[0] ?? null)}
                />
                {backupFile ? (
                  <p className="text-xs text-muted-foreground truncate">{backupFile.name}</p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="backup-confirm">
                  Type <code className="text-xs bg-muted px-1 rounded">RESTORE BACKUP</code> to confirm
                </Label>
                <Input
                  id="backup-confirm"
                  value={backupConfirm}
                  onChange={(e) => setBackupConfirm(e.target.value)}
                  placeholder="RESTORE BACKUP"
                  disabled={backupImporting || backupExporting}
                  autoComplete="off"
                />
              </div>
              <Button
                type="button"
                variant="destructive"
                onClick={() => void handleBackupImport()}
                disabled={
                  backupImporting
                  || backupExporting
                  || !backupFile
                  || backupConfirm.trim() !== "RESTORE BACKUP"
                }
                className="gap-2"
              >
                {backupImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {backupImporting ? "Restoring… (do not close)" : "Restore and replace all data"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Mail className="h-4 w-4 text-primary" />
              Report Ready Email — Preview
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {previewLoading
              ? <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">Loading preview…</div>
              : <iframe srcDoc={previewHtml} title="Email preview" className="w-full h-full border-0" style={{ minHeight: "520px" }} sandbox="allow-same-origin" />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </AdminQueryFallback>
  );
}
