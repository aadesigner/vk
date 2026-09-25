import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAdminGetLogs, AdminGetLogsLevel } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Save, ShieldAlert, Shield, RefreshCw, Trash2, AlertTriangle, User,
  Lock, Zap, CheckCircle2, Loader2, Search,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type SecuritySettings = {
  maxFailedLogins: number;
  lockoutMinutes: number;
  adminMaxFailedLogins: number;
  adminLockoutMinutes: number;
  registerMaxPerHour: number;
  vinRatePerMinute: number;
  recaptchaMinScore: number;
};

type LockoutEntry = {
  email: string; ip: string; context: string;
  failCount: number; lastAttempt: string; expiresAt: string;
};
type TopIp = { ip: string; failCount: number };
type LockoutsData = { lockedOut: LockoutEntry[]; topIps: TopIp[]; total24h: number };

type AccessBlockItem = {
  id: number;
  blockType: "ip" | "country" | "device";
  blockValue: string;
  reason: string | null;
  source: string;
  userId: string | null;
  userEmail?: string | null;
  createdAt: string;
};

type BlocksData = {
  items: AccessBlockItem[];
  ips: AccessBlockItem[];
  countries: AccessBlockItem[];
  devices: AccessBlockItem[];
};

const DEFAULTS: SecuritySettings = {
  maxFailedLogins: 5, lockoutMinutes: 30,
  adminMaxFailedLogins: 3, adminLockoutMinutes: 60,
  registerMaxPerHour: 5, vinRatePerMinute: 20,
  recaptchaMinScore: 0.5,
};

const LEVEL_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  info: "secondary", warn: "outline", error: "destructive",
};
const LEVEL_COLORS: Record<string, string> = {
  info: "text-blue-600", warn: "text-yellow-600", error: "text-red-600",
};

function useSave(
  fields: Partial<SecuritySettings>,
  form: SecuritySettings,
  onSuccess: () => void,
) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = Object.fromEntries(
        Object.keys(fields).map(k => [k, form[k as keyof SecuritySettings]])
      );
      const resp = await fetch(`${basePath}/api/admin/security/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const body = await resp.json() as { error?: string };
        setError(body.error ?? "Save failed");
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/security/settings"] });
        onSuccess();
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  return { save, saving, saved, error };
}

function SaveBtn({ saving, saved, error, onClick, label }: {
  saving: boolean; saved: boolean; error: string | null; onClick: () => void; label: string;
}) {
  return (
    <div className="space-y-1">
      {error && <p className="text-xs text-destructive font-medium text-right">{error}</p>}
      <div className="flex justify-end">
        <Button disabled={saving} className="h-10 px-6 font-semibold gap-2" onClick={onClick}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" />
            : saved ? <CheckCircle2 className="h-4 w-4" />
            : <Save className="h-4 w-4" />}
          {saved ? "Saved!" : saving ? "Saving…" : label}
        </Button>
      </div>
    </div>
  );
}

export default function AdminSecurity() {
  const [form, setForm] = useState<SecuritySettings>(DEFAULTS);
  const [isLoading, setIsLoading] = useState(true);
  const [lockoutsData, setLockoutsData] = useState<LockoutsData | null>(null);
  const [lockoutsLoading, setLockoutsLoading] = useState(false);
  const [blocksData, setBlocksData] = useState<BlocksData | null>(null);
  const [blocksLoading, setBlocksLoading] = useState(false);
  const [newIp, setNewIp] = useState("");
  const [newIpReason, setNewIpReason] = useState("");
  const [newCountry, setNewCountry] = useState("");
  const [newCountryReason, setNewCountryReason] = useState("");
  const [blockActionError, setBlockActionError] = useState<string | null>(null);
  const [blockSaving, setBlockSaving] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [clearPhrase, setClearPhrase] = useState("");
  const CLEAR_LOCKOUTS_PHRASE = "CLEAR ALL LOCKOUTS";
  const [clearing, setClearing] = useState(false);

  const loadSecuritySettings = useCallback(async () => {
    const r = await fetch(`${basePath}/api/admin/security/settings`, { credentials: "include" });
    if (!r.ok) throw new Error("Failed to load security settings");
    const data = await r.json() as SecuritySettings;
    setForm({
      maxFailedLogins: data.maxFailedLogins ?? DEFAULTS.maxFailedLogins,
      lockoutMinutes: data.lockoutMinutes ?? DEFAULTS.lockoutMinutes,
      adminMaxFailedLogins: data.adminMaxFailedLogins ?? DEFAULTS.adminMaxFailedLogins,
      adminLockoutMinutes: data.adminLockoutMinutes ?? DEFAULTS.adminLockoutMinutes,
      registerMaxPerHour: data.registerMaxPerHour ?? DEFAULTS.registerMaxPerHour,
      vinRatePerMinute: data.vinRatePerMinute ?? DEFAULTS.vinRatePerMinute,
      recaptchaMinScore: Number(data.recaptchaMinScore) || DEFAULTS.recaptchaMinScore,
    });
  }, []);

  const thresholdsSave = useSave(
    { maxFailedLogins: 0, lockoutMinutes: 0, adminMaxFailedLogins: 0, adminLockoutMinutes: 0 },
    form,
    () => { void loadSecuritySettings(); },
  );
  const rateSave = useSave(
    { registerMaxPerHour: 0, vinRatePerMinute: 0 },
    form,
    () => { void loadSecuritySettings(); },
  );
  const recaptchaSave = useSave(
    { recaptchaMinScore: 0 },
    form,
    () => { void loadSecuritySettings(); },
  );

  const [logPage, setLogPage] = useState(1);
  const [logLevel, setLogLevel] = useState<"all" | AdminGetLogsLevel>("all");
  const [logSearch, setLogSearch] = useState("");
  const [logFrom, setLogFrom] = useState("");
  const [logTo, setLogTo] = useState("");

  const { data: logsData, isLoading: logsLoading, refetch: refetchLogs } = useAdminGetLogs({
    page: logPage,
    limit: 50,
    level: logLevel === "all" ? undefined : logLevel,
    message: logSearch || undefined,
    from: logFrom || undefined,
    to: logTo || undefined,
  });

  const logs = logsData?.items ?? [];
  const logTotalPages = logsData ? Math.ceil(logsData.total / 50) : 1;
  const hasLogFilters = logLevel !== "all" || logSearch || logFrom || logTo;

  useEffect(() => {
    loadSecuritySettings()
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [loadSecuritySettings]);

  const fetchLockouts = useCallback(async () => {
    setLockoutsLoading(true);
    try {
      const resp = await fetch(`${basePath}/api/admin/security/lockouts`);
      const data = await resp.json() as LockoutsData;
      setLockoutsData(data);
    } catch {
      setLockoutsData(null);
    } finally {
      setLockoutsLoading(false);
    }
  }, []);

  useEffect(() => { void fetchLockouts(); }, [fetchLockouts]);

  const fetchBlocks = useCallback(async () => {
    setBlocksLoading(true);
    try {
      const resp = await fetch(`${basePath}/api/admin/security/blocks`, { credentials: "include" });
      const data = await resp.json() as BlocksData;
      setBlocksData(data);
    } catch {
      setBlocksData(null);
    } finally {
      setBlocksLoading(false);
    }
  }, []);

  useEffect(() => { void fetchBlocks(); }, [fetchBlocks]);

  const addIpBlock = async (ip: string, reason?: string) => {
    setBlockSaving(true);
    setBlockActionError(null);
    try {
      const resp = await fetch(`${basePath}/api/admin/security/blocks/ip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ip, reason: reason || undefined }),
      });
      if (!resp.ok) {
        const body = await resp.json() as { error?: string };
        setBlockActionError(body.error ?? "Failed to block IP");
        return;
      }
      setNewIp("");
      setNewIpReason("");
      await fetchBlocks();
    } catch {
      setBlockActionError("Network error");
    } finally {
      setBlockSaving(false);
    }
  };

  const removeIpBlock = async (ip: string) => {
    setBlockSaving(true);
    setBlockActionError(null);
    try {
      await fetch(`${basePath}/api/admin/security/blocks/ip/${encodeURIComponent(ip)}`, {
        method: "DELETE",
        credentials: "include",
      });
      await fetchBlocks();
    } finally {
      setBlockSaving(false);
    }
  };

  const addCountryBlock = async () => {
    setBlockSaving(true);
    setBlockActionError(null);
    try {
      const resp = await fetch(`${basePath}/api/admin/security/blocks/country`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ countryCode: newCountry, reason: newCountryReason || undefined }),
      });
      if (!resp.ok) {
        const body = await resp.json() as { error?: string };
        setBlockActionError(body.error ?? "Failed to block country");
        return;
      }
      setNewCountry("");
      setNewCountryReason("");
      await fetchBlocks();
    } catch {
      setBlockActionError("Network error");
    } finally {
      setBlockSaving(false);
    }
  };

  const removeCountryBlock = async (code: string) => {
    setBlockSaving(true);
    try {
      await fetch(`${basePath}/api/admin/security/blocks/country/${encodeURIComponent(code)}`, {
        method: "DELETE",
        credentials: "include",
      });
      await fetchBlocks();
    } finally {
      setBlockSaving(false);
    }
  };

  const removeDeviceBlock = async (deviceHash: string) => {
    setBlockSaving(true);
    try {
      await fetch(`${basePath}/api/admin/security/blocks/device/${encodeURIComponent(deviceHash)}`, {
        method: "DELETE",
        credentials: "include",
      });
      await fetchBlocks();
    } finally {
      setBlockSaving(false);
    }
  };

  const handleClearLockouts = async () => {
    setClearing(true);
    try {
      await fetch(`${basePath}/api/admin/security/lockouts`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ confirmPhrase: clearPhrase.trim() }),
      });
      await fetchLockouts();
    } finally {
      setClearing(false);
      setClearConfirm(false);
      setClearPhrase("");
    }
  };

  const num = (key: keyof SecuritySettings, opts?: { step?: number; min?: number; max?: number }) => (
    <Input
      type="number"
      min={opts?.min ?? 0}
      max={opts?.max}
      step={opts?.step ?? 1}
      value={form[key]}
      onChange={(e) => setForm(f => ({ ...f, [key]: parseFloat(e.target.value) || 0 }))}
      className="max-w-[160px]"
    />
  );

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-extrabold">Security</h1>
          <p className="text-muted-foreground mt-1">Login thresholds, rate limits, and live monitoring</p>
        </div>
        <Skeleton className="h-10 w-full rounded-lg" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}><CardContent className="pt-6 space-y-4">
            {Array.from({ length: 3 }).map((_, j) => <Skeleton key={j} className="h-14" />)}
          </CardContent></Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl min-w-0 w-full">
      <div>
        <h1 className="text-2xl font-extrabold">Security</h1>
        <p className="text-muted-foreground mt-1">Login thresholds, rate limits, and live monitoring</p>
      </div>

      <Tabs defaultValue="thresholds">
        <TabsList className="w-full h-auto gap-1 p-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          <TabsTrigger value="thresholds" className="text-xs py-2">Thresholds</TabsTrigger>
          <TabsTrigger value="ratelimits" className="text-xs py-2">Rate Limits</TabsTrigger>
          <TabsTrigger value="recaptcha" className="text-xs py-2">reCAPTCHA</TabsTrigger>
          <TabsTrigger value="blocks" className="text-xs py-2">IP & Country</TabsTrigger>
          <TabsTrigger value="monitoring" className="text-xs py-2">Monitoring</TabsTrigger>
          <TabsTrigger value="logs" className="text-xs py-2">Logs</TabsTrigger>
        </TabsList>

        {/* ── THRESHOLDS ────────────────────────────────────────────────────── */}
        <TabsContent value="thresholds" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4 text-primary" />
                User Login Security
              </CardTitle>
              <CardDescription>Lockout thresholds for regular user accounts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Max Failed Attempts</Label>
                <p className="text-xs text-muted-foreground">Number of failed logins before user is locked out</p>
                {num("maxFailedLogins", { min: 1, max: 100 })}
              </div>
              <div className="space-y-1.5">
                <Label>Lockout Duration (minutes)</Label>
                <p className="text-xs text-muted-foreground">How long the lockout lasts after too many failures</p>
                {num("lockoutMinutes", { min: 1, max: 1440 })}
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-200 dark:border-amber-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-amber-700 dark:text-amber-400">
                <Shield className="h-4 w-4" />
                Admin Login Security
              </CardTitle>
              <CardDescription>Stricter thresholds for the admin account — tracked separately from user lockouts.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Max Failed Attempts (admin)</Label>
                <p className="text-xs text-muted-foreground">Recommend keeping this low (3 or less)</p>
                {num("adminMaxFailedLogins", { min: 1, max: 100 })}
              </div>
              <div className="space-y-1.5">
                <Label>Lockout Duration (minutes, admin)</Label>
                <p className="text-xs text-muted-foreground">Should be longer than user lockout to slow brute-force</p>
                {num("adminLockoutMinutes", { min: 1, max: 1440 })}
              </div>
            </CardContent>
          </Card>

          <SaveBtn {...thresholdsSave} onClick={thresholdsSave.save} label="Save Thresholds" />
        </TabsContent>

        {/* ── RATE LIMITS ───────────────────────────────────────────────────── */}
        <TabsContent value="ratelimits" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Zap className="h-4 w-4 text-primary" />
                Request Rate Limits
              </CardTitle>
              <CardDescription>Per-IP rate controls for registration and VIN lookups</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Max Registrations per Hour per IP</Label>
                <p className="text-xs text-muted-foreground">Block account farming — 0 = no limit</p>
                {num("registerMaxPerHour")}
              </div>
              <div className="space-y-1.5">
                <Label>Max VIN Lookups per Minute per IP</Label>
                <p className="text-xs text-muted-foreground">Protect provider API quota — 0 = no limit</p>
                {num("vinRatePerMinute")}
              </div>
              <p className="text-xs text-muted-foreground rounded-lg border bg-muted/40 px-3 py-2">
                Free VIN decoder daily limit is configured in{" "}
                <a href="/adminx/settings" className="font-medium text-primary hover:underline">Settings → System Limits</a>.
              </p>
            </CardContent>
          </Card>

          <SaveBtn {...rateSave} onClick={rateSave.save} label="Save Rate Limits" />
        </TabsContent>

        {/* ── RECAPTCHA ─────────────────────────────────────────────────────── */}
        <TabsContent value="recaptcha" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldAlert className="h-4 w-4 text-primary" />
                reCAPTCHA v3 Score Threshold
              </CardTitle>
              <CardDescription>
                Minimum score to allow a request through. Score 0.0 = likely bot, 1.0 = likely human.
                Google's default recommendation is 0.5. Keys are configured in Settings → Bot Protection.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1.5">
              <Label>Min Score (0.0 – 1.0)</Label>
              {num("recaptchaMinScore", { step: 0.05, min: 0, max: 1 })}
              <p className="text-xs text-muted-foreground">Only applies when reCAPTCHA is enabled in Settings</p>
            </CardContent>
          </Card>

          <SaveBtn {...recaptchaSave} onClick={recaptchaSave.save} label="Save reCAPTCHA" />
        </TabsContent>

        {/* ── IP & COUNTRY BLOCKS ───────────────────────────────────────────── */}
        <TabsContent value="blocks" className="space-y-4 mt-4">
          <p className="text-sm text-muted-foreground rounded-lg border bg-muted/30 px-3 py-2.5">
            Manual IP and country blocks live here. Banning a user blocks their account and remembered
            devices only — not their IP. Device bans appear under Blocked devices (source &quot;User ban&quot;).
            Signup / last-login IPs stay on the user profile as records.
          </p>
          {blockActionError && (
            <p className="text-sm text-destructive font-medium">{blockActionError}</p>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Block IP address</CardTitle>
              <CardDescription>Deny all public API access from this IP (login, VIN, checkout).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col sm:flex-row flex-wrap gap-2 min-w-0">
                <Input
                  placeholder="203.0.113.10"
                  value={newIp}
                  onChange={(e) => setNewIp(e.target.value)}
                  className="font-mono w-full sm:max-w-[220px] min-w-0"
                />
                <Input
                  placeholder="Reason (optional)"
                  value={newIpReason}
                  onChange={(e) => setNewIpReason(e.target.value)}
                  className="flex-1 min-w-0 w-full sm:min-w-[160px]"
                />
                <Button
                  disabled={blockSaving || !newIp.trim()}
                  onClick={() => void addIpBlock(newIp.trim(), newIpReason.trim())}
                  className="w-full sm:w-auto shrink-0"
                >
                  Block IP
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                Blocked IPs
                {blocksData && blocksData.ips.length > 0 && (
                  <Badge variant="secondary">{blocksData.ips.length}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {blocksLoading ? (
                <Skeleton className="h-20" />
              ) : !blocksData?.ips.length ? (
                <p className="text-sm text-muted-foreground py-2">No blocked IPs</p>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>IP</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {blocksData.ips.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-mono text-sm">{row.blockValue}</TableCell>
                          <TableCell>
                            <Badge variant={row.source === "user_ban" ? "destructive" : "outline"} className="text-xs">
                              {row.source === "user_ban" ? "User ban" : "Manual"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">
                            {row.userEmail ?? (row.userId ? row.userId.slice(0, 8) : "—")}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                            {row.reason ?? "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={blockSaving}
                              onClick={() => void removeIpBlock(row.blockValue)}
                            >
                              Unblock
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Block country</CardTitle>
              <CardDescription>ISO 3166-1 alpha-2 code (e.g. RU, CN). Requires CDN country header or GeoIP.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col sm:flex-row flex-wrap gap-2 min-w-0">
                <Input
                  placeholder="RU"
                  value={newCountry}
                  onChange={(e) => setNewCountry(e.target.value.toUpperCase())}
                  className="font-mono w-full sm:max-w-[100px] uppercase min-w-0"
                  maxLength={2}
                />
                <Input
                  placeholder="Reason (optional)"
                  value={newCountryReason}
                  onChange={(e) => setNewCountryReason(e.target.value)}
                  className="flex-1 min-w-0 w-full sm:min-w-[160px]"
                />
                <Button
                  disabled={blockSaving || newCountry.trim().length !== 2}
                  onClick={() => void addCountryBlock()}
                  className="w-full sm:w-auto shrink-0"
                >
                  Block country
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                Blocked countries
                {blocksData && blocksData.countries.length > 0 && (
                  <Badge variant="secondary">{blocksData.countries.length}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {blocksLoading ? (
                <Skeleton className="h-16" />
              ) : !blocksData?.countries.length ? (
                <p className="text-sm text-muted-foreground py-2">No blocked countries</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {blocksData.countries.map((row) => (
                    <div
                      key={row.id}
                      className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm"
                    >
                      <span className="font-mono font-bold">{row.blockValue}</span>
                      {row.reason && <span className="text-xs text-muted-foreground truncate max-w-[120px]">{row.reason}</span>}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        disabled={blockSaving}
                        onClick={() => void removeCountryBlock(row.blockValue)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                Blocked devices
                {blocksData && (blocksData.devices?.length ?? 0) > 0 && (
                  <Badge variant="secondary">{blocksData.devices.length}</Badge>
                )}
              </CardTitle>
              <CardDescription>
                Browser identities blocked when a user is banned (httpOnly device cookie). Unban removes these.
                IPs are not auto-blocked — use Block IP above for that.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {blocksLoading ? (
                <Skeleton className="h-16" />
              ) : !(blocksData?.devices?.length) ? (
                <p className="text-sm text-muted-foreground py-2">No blocked devices</p>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Device id</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {blocksData.devices.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-mono text-xs truncate max-w-[280px]" title={row.blockValue}>
                            {row.blockValue.slice(0, 16)}…
                          </TableCell>
                          <TableCell>
                            <Badge variant={row.source === "user_ban" ? "destructive" : "outline"} className="text-xs">
                              {row.source === "user_ban" ? "User ban" : "Manual"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">
                            {row.userEmail ?? (row.userId ? row.userId.slice(0, 8) : "—")}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={blockSaving}
                              onClick={() => void removeDeviceBlock(row.blockValue)}
                            >
                              Unblock
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => void fetchBlocks()} disabled={blocksLoading}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${blocksLoading ? "animate-spin" : ""}`} />
              Refresh blocks
            </Button>
          </div>
        </TabsContent>

        {/* ── MONITORING ────────────────────────────────────────────────────── */}
        <TabsContent value="monitoring" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Lock className="h-4 w-4 text-destructive" />
                    Active Lockouts
                    {lockoutsData && lockoutsData.lockedOut.length > 0 && (
                      <Badge variant="destructive" className="text-xs">{lockoutsData.lockedOut.length}</Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    Currently locked-out accounts based on recent failed login attempts
                    {lockoutsData && ` — ${lockoutsData.total24h} total attempts in last 24h`}
                  </CardDescription>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button variant="outline" size="sm" onClick={fetchLockouts} disabled={lockoutsLoading} className="gap-1.5">
                    <RefreshCw className={`h-3.5 w-3.5 ${lockoutsLoading ? "animate-spin" : ""}`} />
                    Refresh
                  </Button>
                  {lockoutsData && lockoutsData.total24h > 0 && (
                    <Button variant="destructive" size="sm" onClick={() => setClearConfirm(true)} className="gap-1.5">
                      <Trash2 className="h-3.5 w-3.5" />
                      Clear All
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {lockoutsLoading ? (
                <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
              ) : lockoutsData?.lockedOut.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
                  <ShieldAlert className="h-4 w-4 text-[#00a5fd]" />
                  No active lockouts
                </div>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>IP</TableHead>
                        <TableHead className="text-center">Context</TableHead>
                        <TableHead className="text-right">Fails</TableHead>
                        <TableHead className="text-right">Expires</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lockoutsData?.lockedOut.map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs">{row.email}</TableCell>
                          <TableCell className="font-mono text-xs">{row.ip}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={row.context === "admin" ? "destructive" : "secondary"} className="text-xs">{row.context}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold text-destructive">{row.failCount}</TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">{new Date(row.expiresAt).toLocaleTimeString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {lockoutsData && lockoutsData.topIps.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Top Failed IPs — Last 24h
                </CardTitle>
                <CardDescription>IPs with the most failed login attempts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>IP Address</TableHead>
                        <TableHead className="text-right">Failed Attempts</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lockoutsData.topIps.map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-sm">{row.ip}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <span className={`font-semibold ${row.failCount >= 10 ? "text-destructive" : row.failCount >= 5 ? "text-amber-600 dark:text-amber-400" : ""}`}>
                                {row.failCount}
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                disabled={blockSaving}
                                onClick={() => void addIpBlock(row.ip, "Blocked from failed-login monitoring")}
                              >
                                Block IP
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── LOGS & AUDIT ─────────────────────────────────────────────────── */}
        <TabsContent value="logs" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{logsData?.total ?? 0} total log entries</p>
            <Button variant="outline" size="sm" onClick={() => refetchLogs()}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Refresh
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-stretch sm:items-end min-w-0">
            <div className="relative flex-1 min-w-0 w-full sm:min-w-44">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search messages..."
                className="pl-9"
                value={logSearch}
                onChange={(e) => { setLogSearch(e.target.value); setLogPage(1); }}
              />
            </div>
            <Select value={logLevel} onValueChange={(v) => { setLogLevel(v as "all" | AdminGetLogsLevel); setLogPage(1); }}>
              <SelectTrigger className="w-full sm:w-[140px]"><SelectValue placeholder="Level" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All levels</SelectItem>
                <SelectItem value={AdminGetLogsLevel.info}>Info</SelectItem>
                <SelectItem value={AdminGetLogsLevel.warn}>Warn</SelectItem>
                <SelectItem value={AdminGetLogsLevel.error}>Error</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1.5 min-w-0 w-full sm:w-auto">
              <span className="text-sm text-muted-foreground whitespace-nowrap shrink-0">From</span>
              <Input type="date" className="w-full sm:w-[160px] min-w-0" value={logFrom} onChange={(e) => { setLogFrom(e.target.value); setLogPage(1); }} />
            </div>
            <div className="flex items-center gap-1.5 min-w-0 w-full sm:w-auto">
              <span className="text-sm text-muted-foreground whitespace-nowrap shrink-0">To</span>
              <Input type="date" className="w-full sm:w-[160px] min-w-0" value={logTo} onChange={(e) => { setLogTo(e.target.value); setLogPage(1); }} />
            </div>
            {hasLogFilters && (
              <Button variant="ghost" size="sm" onClick={() => { setLogLevel("all"); setLogSearch(""); setLogFrom(""); setLogTo(""); setLogPage(1); }}>
                Clear filters
              </Button>
            )}
          </div>

          <Card>
            <CardContent className="p-0">
              {logsLoading ? (
                <div className="p-6 space-y-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
              ) : logs.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">No logs found</p>
              ) : (
                <div className="divide-y">
                  {logs.map((log) => {
                    let contextData: unknown = null;
                    if (log.context) {
                      try { contextData = JSON.parse(log.context); } catch { contextData = log.context; }
                    }
                    return (
                      <div key={log.id} className="flex items-start gap-4 p-4 hover:bg-muted/20 transition-colors">
                        <Badge
                          variant={LEVEL_VARIANTS[log.level] ?? "secondary"}
                          className={`shrink-0 text-xs w-14 justify-center ${LEVEL_COLORS[log.level] ?? ""}`}
                        >
                          {log.level}
                        </Badge>
                        <div className="flex-1 min-w-0 space-y-1">
                          <p className="text-sm font-medium leading-tight">{log.message}</p>
                          {contextData !== null && (
                            <pre className="text-xs text-muted-foreground font-mono bg-muted rounded p-2 overflow-auto max-h-24">
                              {typeof contextData === "string" ? contextData : JSON.stringify(contextData, null, 2)}
                            </pre>
                          )}
                        </div>
                        <time className="text-xs text-muted-foreground shrink-0 tabular-nums">
                          {new Date(log.createdAt).toLocaleString()}
                        </time>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {logTotalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Page {logPage} of {logTotalPages}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={logPage <= 1} onClick={() => setLogPage(p => p - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={logPage >= logTotalPages} onClick={() => setLogPage(p => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog open={clearConfirm} onOpenChange={(open) => { setClearConfirm(open); if (!open) setClearPhrase(""); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all login attempts?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes all failed login attempt records and immediately unblocks any locked-out accounts. Type{" "}
              <span className="font-mono font-semibold">{CLEAR_LOCKOUTS_PHRASE}</span> to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={clearPhrase}
            onChange={(e) => setClearPhrase(e.target.value)}
            placeholder={CLEAR_LOCKOUTS_PHRASE}
            className="font-mono text-sm"
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={clearing || clearPhrase.trim() !== CLEAR_LOCKOUTS_PHRASE}
              onClick={handleClearLockouts}
            >
              {clearing ? "Clearing…" : "Clear All"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
