import { useState, useEffect } from "react";
import {
  useAdminGetProviders,
  useAdminCreateProvider,
  useAdminUpdateProvider,
  useAdminDeleteProvider,
  useGetCountries,
} from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Wifi, WifiOff, Loader2, CheckCircle2, Key, Globe } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type Provider = {
  id: number;
  name: string;
  countryCode: string;
  baseUrl?: string;
  apiKey?: string;
  isActive: boolean;
  rateLimit?: number;
};

function providerPayload(data: Partial<Provider>) {
  return {
    name: data.name,
    countryCode: data.countryCode,
    baseUrl: data.baseUrl,
    apiKey: data.apiKey,
    rateLimit: data.rateLimit,
    isActive: data.isActive,
  };
}

type TestStatus = "idle" | "testing" | "ok" | "warn" | "error";
type TestState = { status: TestStatus; message: string };

function ProviderForm({
  initial,
  countries,
  onSave,
  onCancel,
  isLoading,
}: {
  initial?: Partial<Provider>;
  countries: { code: string; name: string }[];
  onSave: (data: Partial<Provider>) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [form, setForm] = useState<Partial<Provider>>({
    name: "",
    countryCode: "",
    baseUrl: "",
    apiKey: "",
    isActive: true,
    ...initial,
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Name</Label>
          <Input value={form.name ?? ""} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>Country</Label>
          <Select value={form.countryCode ?? ""} onValueChange={(v) => setForm(f => ({ ...f, countryCode: v }))}>
            <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
            <SelectContent>
              {countries.map((c) => (
                <SelectItem key={c.code} value={c.code}>{c.name} ({c.code})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>API URL</Label>
        <Input value={form.baseUrl ?? ""} onChange={(e) => setForm(f => ({ ...f, baseUrl: e.target.value }))} placeholder="https://api.example.com" />
      </div>
      <div className="space-y-1.5">
        <Label>API Key</Label>
        <Input type="password" value={form.apiKey ?? ""} onChange={(e) => setForm(f => ({ ...f, apiKey: e.target.value }))} placeholder="••••••••" />
      </div>
      <div className="flex items-center gap-2 pb-0.5">
        <Switch checked={!!form.isActive} onCheckedChange={(v) => setForm(f => ({ ...f, isActive: v }))} id="active-toggle" />
        <Label htmlFor="active-toggle">Active</Label>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave(providerPayload(form))} disabled={isLoading || !form.name || !form.countryCode}>
          {isLoading ? "Saving..." : "Save"}
        </Button>
      </DialogFooter>
    </div>
  );
}

const COUNTRY_NAMES: Record<string, string> = {
  US: "United States", DE: "Germany", UA: "Ukraine", PL: "Poland",
  KR: "South Korea", JP: "Japan", GB: "United Kingdom", FR: "France",
  NL: "Netherlands", RU: "Russia",
};

export default function AdminProviders() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Provider | null>(null);
  const [creating, setCreating] = useState(false);
  const [testStates, setTestStates] = useState<Record<number, TestState>>({});

  const [carstatKey, setCarstatKey] = useState("");
  const [carstatSaving, setCarstatSaving] = useState(false);
  const [carstatMsg, setCarstatMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [getcarApiEnabled, setGetcarApiEnabled] = useState(true);
  const [getcarApiSaving, setGetcarApiSaving] = useState(false);
  const [getcarApiMsg, setGetcarApiMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [getcarApiKeyPresent, setGetcarApiKeyPresent] = useState<boolean | null>(null);

  const { data: providers = [], isLoading } = useAdminGetProviders();
  const { data: countries = [] } = useGetCountries();
  const { data: adminSettings, isLoading: getcarApiLoading } = useQuery({
    queryKey: ["/api/admin/settings"],
    queryFn: async () => {
      const resp = await fetch(`${basePath}/api/admin/settings`, { credentials: "include" });
      if (!resp.ok) throw new Error("Failed to load settings");
      return resp.json() as Promise<{ getcarApiEnabled?: boolean; getcarApiKeyConfigured?: boolean }>;
    },
  });

  useEffect(() => {
    if (typeof adminSettings?.getcarApiEnabled === "boolean") {
      setGetcarApiEnabled(adminSettings.getcarApiEnabled);
    }
    if (typeof adminSettings?.getcarApiKeyConfigured === "boolean") {
      setGetcarApiKeyPresent(adminSettings.getcarApiKeyConfigured);
    }
  }, [adminSettings]);

  const createProvider = useAdminCreateProvider({
    mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/providers"] }); setCreating(false); } }
  });
  const updateProvider = useAdminUpdateProvider({
    mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/providers"] }); setEditing(null); } }
  });
  const deleteProvider = useAdminDeleteProvider({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/providers"] }) }
  });

  const countryList = countries.map((c) => ({ code: c.code, name: c.name }));
  if (countryList.length === 0) {
    countryList.push(
      { code: "US", name: "United States" }, { code: "DE", name: "Germany" },
      { code: "GB", name: "United Kingdom" }, { code: "UA", name: "Ukraine" },
      { code: "PL", name: "Poland" }, { code: "FR", name: "France" },
    );
  }

  const carstatProviders = providers.filter(p => p.name === "Carstat");
  const otherProviders = providers.filter(p => p.name !== "Carstat");
  const carstatActiveCount = carstatProviders.filter(p => p.isActive).length;

  async function toggleGetCarApi(next: boolean) {
    setGetcarApiSaving(true);
    setGetcarApiMsg(null);
    const prev = getcarApiEnabled;
    setGetcarApiEnabled(next);
    try {
      const resp = await fetch(`${basePath}/api/admin/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ getcarApiEnabled: next }),
      });
      if (!resp.ok) {
        setGetcarApiEnabled(prev);
        setGetcarApiMsg({ ok: false, text: "Failed to update GetCarAPI. Try again." });
        return;
      }
      const saved = await resp.json() as { getcarApiEnabled?: boolean; getcarApiKeyConfigured?: boolean };
      if (typeof saved.getcarApiEnabled === "boolean") setGetcarApiEnabled(saved.getcarApiEnabled);
      if (typeof saved.getcarApiKeyConfigured === "boolean") setGetcarApiKeyPresent(saved.getcarApiKeyConfigured);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      setGetcarApiMsg({
        ok: true,
        text: next
          ? "GetCarAPI enabled — checks and retrieves will run before Carstat."
          : "GetCarAPI disabled — lookups skip it (catalog → Carstat → pending).",
      });
    } catch {
      setGetcarApiEnabled(prev);
      setGetcarApiMsg({ ok: false, text: "Request failed." });
    } finally {
      setGetcarApiSaving(false);
    }
  }

  async function saveCarstatKey(activate: boolean) {
    if (!carstatKey.trim()) return;
    setCarstatSaving(true);
    setCarstatMsg(null);
    try {
      const resp = await fetch(`${basePath}/api/admin/providers/carstat-bulk`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ apiKey: carstatKey.trim(), isActive: activate }),
      });
      if (resp.ok) {
        const saved = await resp.json() as unknown[];
        queryClient.invalidateQueries({ queryKey: ["/api/admin/providers"] });
        queryClient.invalidateQueries({ queryKey: ["/api/countries"] });
        setCarstatKey("");
        if (saved.length === 0) {
          setCarstatMsg({ ok: false, text: "No providers were saved. Try again or restart the API server." });
        } else {
          setCarstatMsg({ ok: true, text: activate ? `Key saved — ${saved.length} countries activated.` : `Key saved for ${saved.length} countries (inactive).` });
        }
      } else {
        setCarstatMsg({ ok: false, text: "Failed to save. Try again." });
      }
    } catch {
      setCarstatMsg({ ok: false, text: "Request failed." });
    } finally {
      setCarstatSaving(false);
    }
  }

  async function toggleCarstatCountry(provider: Provider) {
    updateProvider.mutate({ id: provider.id, data: { isActive: !provider.isActive } as Parameters<typeof updateProvider.mutate>[0]["data"] });
  }

  async function handleTest(providerId: number) {
    setTestStates(s => ({ ...s, [providerId]: { status: "testing", message: "" } }));
    try {
      const resp = await fetch(`${basePath}/api/admin/providers/${providerId}/test`, {
        method: "POST",
        credentials: "include",
      });
      const data = await resp.json() as { ok: boolean; message?: string; error?: string };
      if (data.ok) {
        const isWarn = data.message?.toLowerCase().includes("subscription");
        setTestStates(s => ({
          ...s,
          [providerId]: { status: isWarn ? "warn" : "ok", message: data.message ?? "Connected" },
        }));
      } else {
        setTestStates(s => ({
          ...s,
          [providerId]: { status: "error", message: data.error ?? "Unknown error" },
        }));
      }
    } catch {
      setTestStates(s => ({
        ...s,
        [providerId]: { status: "error", message: "Request failed — check your network." },
      }));
    }
  }

  function TestButton({ id }: { id: number }) {
    const state = testStates[id] ?? { status: "idle", message: "" };
    if (state.status === "testing") return <Button size="sm" variant="outline" disabled><Loader2 className="h-3.5 w-3.5 animate-spin" /></Button>;
    if (state.status === "ok") return <Button size="sm" variant="outline" className="text-[#0088d4] border-[#b3e3fe] hover:bg-[#e6f6ff]" onClick={() => handleTest(id)}><CheckCircle2 className="h-3.5 w-3.5" /></Button>;
    if (state.status === "warn") return <Button size="sm" variant="outline" className="text-yellow-600 border-yellow-200 hover:bg-yellow-50" onClick={() => handleTest(id)}><Wifi className="h-3.5 w-3.5" /></Button>;
    if (state.status === "error") return <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleTest(id)}><WifiOff className="h-3.5 w-3.5" /></Button>;
    return <Button size="sm" variant="outline" onClick={() => handleTest(id)}><Wifi className="h-3.5 w-3.5" /></Button>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Providers</h1>
          <p className="text-muted-foreground mt-1">{providers.length} providers configured</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Provider
        </Button>
      </div>

      {/* ── Carstat global config ─────────────────────────────────────────── */}
      <Card className="border-2 border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Carstat — VIN Data Provider</CardTitle>
          </div>
          <CardDescription>
            Paste your API key once to enable all {carstatProviders.length} countries.
            Currently <span className="font-medium text-foreground">{carstatActiveCount} active</span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="password"
                className="pl-9"
                placeholder="Paste your Carstat API key here…"
                value={carstatKey}
                onChange={e => { setCarstatKey(e.target.value); setCarstatMsg(null); }}
              />
            </div>
            <Button
              onClick={() => saveCarstatKey(true)}
              disabled={carstatSaving || !carstatKey.trim()}
            >
              {carstatSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save &amp; Activate All
            </Button>
            <Button
              variant="outline"
              onClick={() => saveCarstatKey(false)}
              disabled={carstatSaving || !carstatKey.trim()}
            >
              Save Only
            </Button>
          </div>
          {carstatMsg && (
            <p className={`text-sm ${carstatMsg.ok ? "text-[#0088d4]" : "text-red-500"}`}>{carstatMsg.text}</p>
          )}

          {/* Per-country toggles */}
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
              {carstatProviders.map(p => (
                <div
                  key={p.id}
                  className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${p.isActive ? "border-[#b3e3fe] bg-[#e6f6ff]/50" : "border-muted bg-muted/30"}`}
                >
                  <span className="font-medium">{COUNTRY_NAMES[p.countryCode] ?? p.countryCode}</span>
                  <Switch
                    checked={p.isActive}
                    onCheckedChange={() => toggleCarstatCountry(p as Provider)}
                    disabled={updateProvider.isPending}
                  />
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Base URL: <code className="bg-muted px-1 rounded">https://carstat.dev</code> · Auth: <code className="bg-muted px-1 rounded">x-api-key</code> header · Endpoints: <code className="bg-muted px-1 rounded">/api/local-exists/&#123;vin&#125;</code>, <code className="bg-muted px-1 rounded">/api/local-report/&#123;vin&#125;</code> · Get your key at <a href="https://carstat.dev" target="_blank" rel="noreferrer" className="underline underline-offset-2">carstat.dev</a>
          </p>
        </CardContent>
      </Card>

      {/* ── GetCarAPI global toggle ─────────────────────────────────────────── */}
      <Card className="border-2 border-sky-500/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <Globe className="h-5 w-5 text-sky-600 shrink-0" />
              <div className="min-w-0">
                <CardTitle className="text-lg">GetCarAPI — VIN Data Provider</CardTitle>
                <CardDescription className="mt-1">
                  Free existence check + paid retrieve before Carstat. When disabled, lookups skip GetCarAPI
                  entirely: local catalog → Carstat → pending.
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Badge
                variant={getcarApiEnabled ? "default" : "secondary"}
                className={getcarApiEnabled ? "bg-[#ccebfe] text-[#075985] border-0" : ""}
              >
                {getcarApiEnabled ? "Enabled" : "Disabled"}
              </Badge>
              <Switch
                id="getcarapi-enabled"
                checked={getcarApiEnabled}
                disabled={getcarApiLoading || getcarApiSaving}
                onCheckedChange={(v) => void toggleGetCarApi(v)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {getcarApiMsg && (
            <p className={`text-sm ${getcarApiMsg.ok ? "text-[#0088d4]" : "text-red-500"}`}>{getcarApiMsg.text}</p>
          )}
          <p className="text-xs text-muted-foreground">
            API key from env <code className="bg-muted px-1 rounded">GETCARAPI_API_KEY</code>
            {getcarApiKeyPresent === true && " (configured)"}
            {getcarApiKeyPresent === false && " (missing — enable will not call GetCarAPI until the key is set)"}
            {" "}· Docs:{" "}
            <a href="https://getcarapi.com/api/" target="_blank" rel="noreferrer" className="underline underline-offset-2">
              getcarapi.com/api
            </a>
          </p>
        </CardContent>
      </Card>

      {/* ── Other providers ───────────────────────────────────────────────── */}
      {(otherProviders.length > 0 || !isLoading) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Other Providers</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
              </div>
            ) : otherProviders.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">No other providers</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left p-4 font-medium text-muted-foreground">Name</th>
                      <th className="text-left p-4 font-medium text-muted-foreground">Country</th>
                      <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                      <th className="text-left p-4 font-medium text-muted-foreground">Connection</th>
                      <th className="text-right p-4 font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {otherProviders.map((p) => {
                      const ts = testStates[p.id] ?? { status: "idle", message: "" };
                      return (
                        <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="p-4 font-medium">{p.name}</td>
                          <td className="p-4 text-muted-foreground">{p.countryCode}</td>
                          <td className="p-4">
                            <Badge variant={p.isActive ? "default" : "secondary"} className={p.isActive ? "bg-[#ccebfe] text-[#075985] border-0" : ""}>
                              {p.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <TestButton id={p.id} />
                              {ts.status !== "idle" && ts.status !== "testing" && (
                                <span className={`text-xs max-w-[180px] truncate ${ts.status === "ok" ? "text-[#0088d4]" : ts.status === "warn" ? "text-yellow-600" : "text-red-500"}`} title={ts.message}>{ts.message}</span>
                              )}
                            </div>
                          </td>
                          <td className="p-4 text-right space-x-2">
                            <Button size="sm" variant="outline" onClick={() => setEditing(p as Provider)}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button size="sm" variant="destructive" onClick={() => deleteProvider.mutate({ id: p.id })} disabled={deleteProvider.isPending}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create dialog */}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Provider</DialogTitle></DialogHeader>
          <ProviderForm
            countries={countryList}
            onSave={(data) => createProvider.mutate({ data: data as Parameters<typeof createProvider.mutate>[0]["data"] })}
            onCancel={() => setCreating(false)}
            isLoading={createProvider.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Provider</DialogTitle></DialogHeader>
          {editing && (
            <ProviderForm
              initial={editing}
              countries={countryList}
              onSave={(data) => updateProvider.mutate({ id: editing.id, data: data as Parameters<typeof updateProvider.mutate>[0]["data"] })}
              onCancel={() => setEditing(null)}
              isLoading={updateProvider.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
