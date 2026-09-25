import { useState, useEffect, useCallback, useRef } from "react";
import { useAdminGetSettings, useAdminUpdateSettings } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "wouter";
import {
  Mail, Settings, CheckCircle2, Globe, Zap, Shield, ShoppingCart,
  Save, ExternalLink, Loader2, FileText, Send, RotateCcw, AlertTriangle, Gift, Banknote,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import AdminEmailLogs from "./email-logs";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type EmailType = "welcome" | "vinready" | "reset" | "abandoned" | "noinfo" | "noinforefund";

type TemplateData = {
  subject: string;
  contentHtml: string;
  isCustom: boolean;
  variables: string[];
};

type TriggersForm = {
  emailSendWelcome: boolean;
  emailSendVinReady: boolean;
  emailSendPasswordReset: boolean;
  emailSendAbandonedCart: boolean;
  emailSendNoinfo: boolean;
  emailSendNoinforefund: boolean;
  emailSendAdminPendingVin: boolean;
};

const EMAIL_TYPES: {
  type: EmailType;
  triggerKey: keyof TriggersForm;
  label: string;
  description: string;
  trigger: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    type: "welcome",
    triggerKey: "emailSendWelcome",
    label: "Welcome Email",
    description: "Greets a new user and links them to run their first VIN check.",
    trigger: "Fires when a new account is registered.",
    icon: Zap,
  },
  {
    type: "vinready",
    triggerKey: "emailSendVinReady",
    label: "Report Ready & Payment",
    description: "Single email confirming the payment and delivering the finished report.",
    trigger: "Fires once per report — instant API fulfillment or manual publish.",
    icon: FileText,
  },
  {
    type: "reset",
    triggerKey: "emailSendPasswordReset",
    label: "Password Reset",
    description: "Delivers a secure one-time reset link (expires in 1 hour).",
    trigger: "Fires when the user submits Forgot Password.",
    icon: Shield,
  },
  {
    type: "abandoned",
    triggerKey: "emailSendAbandonedCart",
    label: "Abandoned Cart Reminder",
    description: "Reminds users who started checkout but did not pay.",
    trigger: "Sent manually from Admin → Users.",
    icon: ShoppingCart,
  },
  {
    type: "noinfo",
    triggerKey: "emailSendNoinfo",
    label: "No info / free credit",
    description: "Tells the customer we found no data for their VIN and credited 1 free report check.",
    trigger: "Sent from Pending VIN detail → Credit user.",
    icon: Gift,
  },
  {
    type: "noinforefund",
    triggerKey: "emailSendNoinforefund",
    label: "No info / refund",
    description: "Tells the customer we found no data for their VIN and refunded them in full.",
    trigger: "Sent from Pending VIN detail → Remove pending + refunded.",
    icon: Banknote,
  },
];

export default function AdminEmails() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: settings, isLoading } = useAdminGetSettings();

  const [general, setGeneral] = useState({ siteUrl: "https://verifykm.com" });
  const [triggers, setTriggers] = useState<TriggersForm>({
    emailSendWelcome: true,
    emailSendVinReady: true,
    emailSendPasswordReset: true,
    emailSendAbandonedCart: false,
    emailSendNoinfo: true,
    emailSendNoinforefund: true,
    emailSendAdminPendingVin: false,
  });
  const [logRetention, setLogRetention] = useState(true);

  const [templates, setTemplates] = useState<Record<EmailType, TemplateData> | null>(null);
  const [selectedType, setSelectedType] = useState<EmailType>("welcome");
  const [draftSubject, setDraftSubject] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewSubject, setPreviewSubject] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);

  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateMsg, setTemplateMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [generalSaved, setGeneralSaved] = useState(false);
  const [triggersSaved, setTriggersSaved] = useState(false);

  const [testEmail, setTestEmail] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string; hint?: string } | null>(null);

  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const generalUpdater = useAdminUpdateSettings({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
        setGeneralSaved(true);
        setTimeout(() => setGeneralSaved(false), 2500);
      },
      onError: (err: Error) => {
        toast({ variant: "destructive", title: "Save failed", description: err.message || "Could not save site URL." });
      },
    },
  });

  const triggersUpdater = useAdminUpdateSettings({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
        setTriggersSaved(true);
        setTimeout(() => setTriggersSaved(false), 2500);
      },
      onError: (err: Error) => {
        toast({ variant: "destructive", title: "Save failed", description: err.message || "Could not save email triggers." });
      },
    },
  });

  const retentionUpdater = useAdminUpdateSettings({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      },
      onError: (err: Error) => {
        toast({ variant: "destructive", title: "Save failed", description: err.message || "Could not save log retention." });
      },
    },
  });

  const handleRetentionChange = (value: boolean) => {
    setLogRetention(value);
    retentionUpdater.mutate({
      data: { emailLogRetentionEnabled: value } as Parameters<typeof retentionUpdater.mutate>[0]["data"],
    });
  };

  const loadTemplates = useCallback(async () => {
    const resp = await fetch(`${basePath}/api/admin/email/templates`, { credentials: "include" });
    if (!resp.ok) return;
    const data = await resp.json() as { templates: Record<EmailType, TemplateData> };
    setTemplates(data.templates);
  }, []);

  useEffect(() => {
    if (!settings) return;
    const s = settings as unknown as Record<string, unknown>;
    setGeneral({ siteUrl: (s.siteUrl as string) ?? "https://verifykm.com" });
    setTriggers({
      emailSendWelcome: (s.emailSendWelcome as boolean) ?? true,
      emailSendVinReady: (s.emailSendVinReady as boolean) ?? true,
      emailSendPasswordReset: (s.emailSendPasswordReset as boolean) ?? true,
      emailSendAbandonedCart: (s.emailSendAbandonedCart as boolean) ?? false,
      emailSendNoinfo: (s.emailSendNoinfo as boolean) ?? true,
      emailSendNoinforefund: (s.emailSendNoinforefund as boolean) ?? true,
      emailSendAdminPendingVin: (s.emailSendAdminPendingVin as boolean) ?? false,
    });
    setLogRetention((s.emailLogRetentionEnabled as boolean) ?? true);
    void loadTemplates();
  }, [settings, loadTemplates]);

  useEffect(() => {
    if (!templates) return;
    const t = templates[selectedType];
    setDraftSubject(t.subject);
    setDraftContent(t.contentHtml);
    setTemplateMsg(null);
    setTestMsg(null);
  }, [selectedType, templates]);

  const fetchPreview = useCallback(async (type: EmailType, subject: string, contentHtml: string, siteUrl: string) => {
    setPreviewLoading(true);
    try {
      const resp = await fetch(`${basePath}/api/admin/email/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ type, subject, contentHtml, siteUrl }),
      });
      const data = await resp.json() as { html?: string; subject?: string };
      setPreviewHtml(data.html ?? "");
      setPreviewSubject(data.subject ?? subject);
    } catch {
      setPreviewHtml("<p style='padding:24px;color:red'>Preview failed</p>");
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!draftSubject && !draftContent) return;
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(() => {
      void fetchPreview(selectedType, draftSubject, draftContent, general.siteUrl);
    }, 400);
    return () => { if (previewTimer.current) clearTimeout(previewTimer.current); };
  }, [draftSubject, draftContent, selectedType, general.siteUrl, fetchPreview]);

  const handleSaveTemplate = async () => {
    setSavingTemplate(true);
    setTemplateMsg(null);
    try {
      const resp = await fetch(`${basePath}/api/admin/email/templates/${selectedType}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ subject: draftSubject, contentHtml: draftContent }),
      });
      const data = await resp.json() as { template?: TemplateData; error?: string };
      if (!resp.ok) {
        setTemplateMsg({ ok: false, text: data.error ?? "Save failed" });
        return;
      }
      if (data.template) {
        setTemplates(prev => prev ? { ...prev, [selectedType]: data.template! } : prev);
      }
      setTemplateMsg({ ok: true, text: "Template saved" });
      await loadTemplates();
    } catch {
      setTemplateMsg({ ok: false, text: "Network error" });
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleResetTemplate = async () => {
    if (!confirm("Reset this template to the default? Your custom subject and content will be removed.")) return;
    setSavingTemplate(true);
    setTemplateMsg(null);
    try {
      const resp = await fetch(`${basePath}/api/admin/email/templates/${selectedType}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reset: true }),
      });
      const data = await resp.json() as { template?: TemplateData };
      if (data.template) {
        setDraftSubject(data.template.subject);
        setDraftContent(data.template.contentHtml);
        setTemplates(prev => prev ? { ...prev, [selectedType]: data.template! } : prev);
      }
      setTemplateMsg({ ok: true, text: "Reset to default" });
    } catch {
      setTemplateMsg({ ok: false, text: "Reset failed" });
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleTestSend = async () => {
    if (!testEmail.trim()) return;
    setTestSending(true);
    setTestMsg(null);
    try {
      const resp = await fetch(`${basePath}/api/admin/email/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          to: testEmail.trim(),
          type: selectedType,
          subject: draftSubject,
          contentHtml: draftContent,
        }),
      });
      const data = await resp.json().catch(() => ({})) as { ok?: boolean; error?: string; hint?: string };
      if (data.ok) {
        setTestMsg({ ok: true, text: `Test "${EMAIL_TYPES.find(e => e.type === selectedType)?.label}" sent to ${testEmail}` });
      } else {
        const gatewayTimeout = resp.status === 502 || resp.status === 504;
        setTestMsg({
          ok: false,
          text: data.error
            ?? (gatewayTimeout
              ? "Mail test timed out or SMTP host unreachable."
              : "Send failed — check SMTP settings"),
          hint: data.hint
            ?? (gatewayTimeout
              ? "Try port 465 (SSL) or 587 (STARTTLS). Railway often blocks or throttles outbound SMTP."
              : undefined),
        });
      }
    } catch {
      setTestMsg({ ok: false, text: "Network error" });
    } finally {
      setTestSending(false);
    }
  };

  const smtpEnabled = Boolean((settings as unknown as Record<string, unknown>)?.smtpEnabled);
  const smtpHost = (settings as unknown as Record<string, unknown>)?.smtpHost as string | undefined;
  const selectedMeta = EMAIL_TYPES.find(e => e.type === selectedType)!;
  const selectedTemplate = templates?.[selectedType];
  const triggerActive = triggers[selectedMeta.triggerKey];

  if (isLoading || !templates) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-extrabold">Emails</h1>
        <p className="text-muted-foreground mt-1">Customize templates, preview live, and test SMTP per trigger</p>
      </div>

      <Card className={cn(
        "border",
        smtpEnabled && smtpHost
          ? "border-[#b3e3fe] dark:border-[#006aa8] bg-[#e6f6ff]/60 dark:bg-[#003a5c]/40/20"
          : "border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/20"
      )}>
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                smtpEnabled && smtpHost ? "bg-[#ccebfe] dark:bg-[#004d7a]/40" : "bg-amber-100 dark:bg-amber-900"
              )}>
                <Mail className={cn("h-4 w-4", smtpEnabled && smtpHost ? "text-[#0088d4]" : "text-amber-600")} />
              </div>
              <div>
                <p className={cn("text-sm font-semibold", smtpEnabled && smtpHost ? "text-[#075985] dark:text-[#bae6fd]" : "text-amber-800 dark:text-amber-200")}>
                  {smtpEnabled && smtpHost ? `SMTP configured — ${smtpHost}` : "SMTP not configured"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Configure host, port, and credentials in Settings → Auth &amp; Access, then test each trigger below.
                </p>
              </div>
            </div>
            <Link href="/adminx/settings">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <Settings className="h-3.5 w-3.5" />
                SMTP Settings
                <ExternalLink className="h-3 w-3 opacity-50" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="templates">
        <TabsList className="w-full h-auto gap-1 p-1 grid grid-cols-1 sm:grid-cols-3">
          <TabsTrigger value="templates" className="text-xs sm:text-sm">Templates</TabsTrigger>
          <TabsTrigger value="general" className="text-xs sm:text-sm">General &amp; Triggers</TabsTrigger>
          <TabsTrigger value="logs" className="text-xs sm:text-sm">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Email triggers</CardTitle>
              </CardHeader>
              <CardContent className="p-2 space-y-1">
                {EMAIL_TYPES.map(({ type, label, icon: Icon, triggerKey }) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSelectedType(type)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left text-sm transition-colors",
                      selectedType === type ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="flex-1 truncate">{label}</span>
                    <span className={cn(
                      "h-1.5 w-1.5 rounded-full shrink-0",
                      triggers[triggerKey] ? "bg-[#00a5fd]" : "bg-muted-foreground/40",
                    )} />
                  </button>
                ))}
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <selectedMeta.icon className="h-4 w-4" />
                        {selectedMeta.label}
                        {selectedTemplate?.isCustom && (
                          <Badge variant="secondary" className="text-[10px]">Custom</Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="mt-1">{selectedMeta.trigger}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Trigger</span>
                      <Switch
                        checked={triggerActive}
                        onCheckedChange={(v) => setTriggers(f => ({ ...f, [selectedMeta.triggerKey]: v }))}
                      />
                      <Badge variant={triggerActive ? "default" : "secondary"} className="text-[10px]">
                        {triggerActive ? "On" : "Off"}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Subject line</Label>
                    <Input
                      value={draftSubject}
                      onChange={e => setDraftSubject(e.target.value)}
                      className="font-mono text-sm"
                      placeholder="Email subject…"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <Label>Body content (HTML)</Label>
                      <span className="text-[10px] text-muted-foreground">Wrapped in verifykm header/footer automatically</span>
                    </div>
                    <Textarea
                      value={draftContent}
                      onChange={e => setDraftContent(e.target.value)}
                      className="font-mono text-xs min-h-[200px] resize-y"
                      spellCheck={false}
                    />
                  </div>

                  {selectedTemplate?.variables && (
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-xs text-muted-foreground mr-1">Variables:</span>
                      {selectedTemplate.variables.map(v => (
                        <button
                          key={v}
                          type="button"
                          className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted hover:bg-muted/80"
                          onClick={() => setDraftContent(c => `${c}{{${v}}}`)}
                        >
                          {`{{${v}}}`}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Button onClick={handleSaveTemplate} disabled={savingTemplate} size="sm" className="gap-1.5">
                      {savingTemplate ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      Save template
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleResetTemplate} disabled={savingTemplate} className="gap-1.5">
                      <RotateCcw className="h-3.5 w-3.5" />
                      Reset default
                    </Button>
                    <Button
                      variant="outline" size="sm"
                      onClick={() => triggersUpdater.mutate({ data: triggers as Parameters<typeof triggersUpdater.mutate>[0]["data"] })}
                      disabled={triggersUpdater.isPending}
                    >
                      Save trigger toggle
                    </Button>
                    {templateMsg && (
                      <span className={cn("text-xs", templateMsg.ok ? "text-[#0088d4]" : "text-destructive")}>
                        {templateMsg.text}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Live preview</CardTitle>
                  {previewSubject && (
                    <p className="text-xs text-muted-foreground font-mono mt-1">Subject: {previewSubject}</p>
                  )}
                </CardHeader>
                <CardContent className="p-0">
                  <div className="h-[420px] relative bg-muted/30 border-t">
                    {previewLoading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    )}
                    {previewHtml ? (
                      <iframe
                        srcDoc={previewHtml}
                        className="w-full h-full border-0"
                        sandbox="allow-same-origin"
                        title="Email preview"
                      />
                    ) : null}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Send className="h-4 w-4" />
                    Test this trigger via SMTP
                  </CardTitle>
                  <CardDescription>
                    Sends a sample {selectedMeta.label.toLowerCase()} using your current draft (or saved template if unchanged).
                    Uses SMTP credentials from Settings.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="your@email.com"
                      value={testEmail}
                      onChange={e => setTestEmail(e.target.value)}
                      className="h-9"
                    />
                    <Button
                      onClick={handleTestSend}
                      disabled={testSending || !testEmail.trim() || !smtpEnabled}
                      size="sm"
                      className="gap-1.5 shrink-0"
                    >
                      {testSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      Send test
                    </Button>
                  </div>
                  {!smtpEnabled && (
                    <p className="text-xs text-amber-600 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Enable SMTP in Settings before sending tests.
                    </p>
                  )}
                  {testMsg && (
                    <div className="space-y-1">
                      <p className={cn("text-xs", testMsg.ok ? "text-[#0088d4]" : "text-destructive font-medium")}>{testMsg.text}</p>
                      {!testMsg.ok && testMsg.hint && (
                        <p className="text-xs text-muted-foreground">{testMsg.hint}</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="general" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Globe className="h-4 w-4 text-primary" />
                Site URL
              </CardTitle>
              <CardDescription>
                Used in email links (report URLs, reset links, checkout). Also used in live preview.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Input
                placeholder="https://verifykm.com"
                value={general.siteUrl}
                onChange={e => setGeneral({ siteUrl: e.target.value })}
                className="font-mono text-sm"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">All trigger toggles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {EMAIL_TYPES.map(({ triggerKey, label, description }) => (
                <div key={triggerKey} className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{description}</p>
                  </div>
                  <Switch
                    checked={triggers[triggerKey]}
                    onCheckedChange={v => setTriggers(f => ({ ...f, [triggerKey]: v }))}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Admin notifications</CardTitle>
              <CardDescription>Emails sent to admins, not customers.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Pending VIN alert</p>
                  <p className="text-xs text-muted-foreground">
                    Emails all admins when a customer pays for a VIN that needs a manual report. Off by default.
                  </p>
                </div>
                <Switch
                  checked={triggers.emailSendAdminPendingVin}
                  onCheckedChange={v => setTriggers(f => ({ ...f, emailSendAdminPendingVin: v }))}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              disabled={generalUpdater.isPending || triggersUpdater.isPending}
              className="gap-2"
              onClick={async () => {
                await generalUpdater.mutateAsync({ data: general as Parameters<typeof generalUpdater.mutate>[0]["data"] });
                await triggersUpdater.mutateAsync({ data: triggers as Parameters<typeof triggersUpdater.mutate>[0]["data"] });
              }}
            >
              {(generalUpdater.isPending || triggersUpdater.isPending)
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : (generalSaved || triggersSaved) ? <CheckCircle2 className="h-4 w-4" />
                : <Save className="h-4 w-4" />}
              Save General &amp; Triggers
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <AdminEmailLogs
            retentionEnabled={logRetention}
            onRetentionChange={handleRetentionChange}
            retentionSaving={retentionUpdater.isPending}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
