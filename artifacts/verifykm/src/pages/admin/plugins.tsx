import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Puzzle, Globe2, Loader2, Save, CheckCircle2, Plus, Trash2, Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_PLUGINS_FORM,
  GEO_PLUGIN_COUNTRIES,
  PLUGIN_LANGUAGE_OPTIONS,
  type PluginsForm,
  type GeoLanguageRuleForm,
} from "@/lib/plugin-config";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function normalizeForm(data: unknown): PluginsForm {
  if (!data || typeof data !== "object") return DEFAULT_PLUGINS_FORM;
  const d = data as Record<string, unknown>;
  const geo = d.geoLanguageRedirect;
  if (!geo || typeof geo !== "object") return DEFAULT_PLUGINS_FORM;
  const g = geo as Record<string, unknown>;
  const rules = Array.isArray(g.rules)
    ? g.rules.map((r): GeoLanguageRuleForm => {
      const row = r as Record<string, unknown>;
      const language = typeof row.language === "string" ? row.language : "sq";
      const countries = Array.isArray(row.countries)
        ? row.countries.filter((c): c is string => typeof c === "string")
        : [];
      return {
        language: (PLUGIN_LANGUAGE_OPTIONS.some((o) => o.code === language) ? language : "sq") as GeoLanguageRuleForm["language"],
        countries,
      };
    })
    : DEFAULT_PLUGINS_FORM.geoLanguageRedirect.rules;

  return {
    geoLanguageRedirect: {
      enabled: g.enabled === true,
      rememberUserChoice: g.rememberUserChoice !== false,
      rules: rules.length > 0 ? rules : DEFAULT_PLUGINS_FORM.geoLanguageRedirect.rules,
    },
  };
}

export default function AdminPlugins() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<PluginsForm>(DEFAULT_PLUGINS_FORM);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/admin/plugins"],
    queryFn: async () => {
      const r = await fetch(`${basePath}/api/admin/plugins`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load plugins");
      return r.json();
    },
  });

  useEffect(() => {
    if (data) setForm(normalizeForm(data));
  }, [data]);

  const updateGeo = (patch: Partial<PluginsForm["geoLanguageRedirect"]>) => {
    setForm((f) => ({
      ...f,
      geoLanguageRedirect: { ...f.geoLanguageRedirect, ...patch },
    }));
    setSaved(false);
  };

  const updateRule = (index: number, patch: Partial<GeoLanguageRuleForm>) => {
    setForm((f) => {
      const rules = f.geoLanguageRedirect.rules.map((r, i) => (i === index ? { ...r, ...patch } : r));
      return { ...f, geoLanguageRedirect: { ...f.geoLanguageRedirect, rules } };
    });
    setSaved(false);
  };

  const toggleCountry = (ruleIndex: number, code: string, checked: boolean) => {
    setForm((f) => {
      const rules = f.geoLanguageRedirect.rules.map((r, i) => {
        let countries = r.countries;
        if (checked) {
          if (i === ruleIndex) {
            countries = countries.includes(code)
              ? countries
              : [...countries, code];
          } else {
            countries = countries.filter((c) => c !== code);
          }
        } else if (i === ruleIndex) {
          countries = countries.filter((c) => c !== code);
        }
        return { ...r, countries };
      });
      return { ...f, geoLanguageRedirect: { ...f.geoLanguageRedirect, rules } };
    });
    setSaved(false);
  };

  const addRule = () => {
    setForm((f) => ({
      ...f,
      geoLanguageRedirect: {
        ...f.geoLanguageRedirect,
        rules: [...f.geoLanguageRedirect.rules, { countries: [], language: "en" }],
      },
    }));
    setSaved(false);
  };

  const removeRule = (index: number) => {
    setForm((f) => ({
      ...f,
      geoLanguageRedirect: {
        ...f.geoLanguageRedirect,
        rules: f.geoLanguageRedirect.rules.filter((_, i) => i !== index),
      },
    }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const r = await fetch(`${basePath}/api/admin/plugins`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Save failed");
      }
      const updated = await r.json();
      setForm(normalizeForm(updated));
      queryClient.invalidateQueries({ queryKey: ["/api/admin/plugins"] });
      setSaved(true);
      toast({ title: "Saved", description: "Plugin settings updated." });
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Save failed",
        description: err instanceof Error ? err.message : "Could not save plugins.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const geo = form.geoLanguageRedirect;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Puzzle className="h-7 w-7 text-primary" />
          Plugins
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Official verifykm extensions. Enable only what you need.
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-blue-200/60 bg-blue-50/80 dark:bg-blue-950/30 dark:border-blue-800/40 px-4 py-3 text-sm text-blue-900 dark:text-blue-100">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <p>
          Geo language redirect runs on <code className="text-xs bg-muted px-1 rounded">/</code> and unprefixed paths like <code className="text-xs bg-muted px-1 rounded">/cars/usa</code> (never as a server redirect).
          Prefixed deep links (e.g. <code className="text-xs bg-muted px-1 rounded">/en/cars/korea</code> from Google) are never language-swapped.
          Search engine crawlers are excluded. After the first geo choice (or a manual language switch), preference sticks on this device for homepage and unprefixed URLs.
          {" "}Local test: open <code className="text-xs bg-muted px-1 rounded">/?geo_country=AL</code> (dev only).
          {" "}Palestine (<code className="text-xs bg-muted px-1 rounded">PS</code>) is in the Arabic rule; Israel (<code className="text-xs bg-muted px-1 rounded">IL</code>) is never redirected.
          {" "}Chinese-speaking regions (<code className="text-xs bg-muted px-1 rounded">CN</code>, <code className="text-xs bg-muted px-1 rounded">TW</code>, <code className="text-xs bg-muted px-1 rounded">HK</code>, <code className="text-xs bg-muted px-1 rounded">MO</code>, <code className="text-xs bg-muted px-1 rounded">SG</code>) default to 中文 — editable below.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Globe2 className="h-4 w-4 text-primary" />
                Country IP language redirect
                <Badge variant="outline" className="text-xs font-normal">Official</Badge>
              </CardTitle>
              <CardDescription className="mt-1.5">
                Suggest a site language from visitor country on first visit to <code className="text-xs">/</code> or unprefixed paths (<code className="text-xs">/cars/usa</code> → <code className="text-xs">/sq/cars/usa</code>). Manual language picks are remembered and stop further geo redirects.
              </CardDescription>
            </div>
            <Switch
              checked={geo.enabled}
              onCheckedChange={(v) => updateGeo({ enabled: v })}
              aria-label="Enable geo language redirect"
            />
          </div>
        </CardHeader>
        <CardContent className={`space-y-6 ${!geo.enabled ? "opacity-50 pointer-events-none" : ""}`}>
          <div className="flex items-start gap-3 p-3 border rounded-xl">
            <Switch
              id="rememberUserChoice"
              checked={geo.rememberUserChoice}
              onCheckedChange={(v) => updateGeo({ rememberUserChoice: v })}
              className="mt-0.5"
            />
            <div>
              <Label htmlFor="rememberUserChoice" className="cursor-pointer">Remember manual language choice</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                When a visitor switches language in the menu, store their preference in local storage so geo redirect never overrides it again.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Country → language rules</Label>
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addRule}>
                <Plus className="h-3.5 w-3.5" /> Add rule
              </Button>
            </div>

            {geo.rules.map((rule, ruleIndex) => (
              <div key={ruleIndex} className="rounded-xl border p-4 space-y-4 bg-muted/20">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                  <div className="flex items-center gap-3">
                    <Label className="text-xs text-muted-foreground shrink-0">Redirect to</Label>
                    <Select
                      value={rule.language}
                      onValueChange={(v) => updateRule(ruleIndex, { language: v as GeoLanguageRuleForm["language"] })}
                    >
                      <SelectTrigger className="w-full sm:w-[200px] h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PLUGIN_LANGUAGE_OPTIONS.map((o) => (
                          <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {geo.rules.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive gap-1.5"
                      onClick={() => removeRule(ruleIndex)}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remove rule
                    </Button>
                  )}
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-2">When visitor country is:</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {GEO_PLUGIN_COUNTRIES.map((c) => {
                      const blocked = c.code === "IL";
                      return (
                      <label
                        key={c.code}
                        className={cn(
                          "flex items-center gap-2 text-sm rounded-lg border bg-background px-2.5 py-2",
                          blocked
                            ? "opacity-60 cursor-not-allowed"
                            : "cursor-pointer hover:bg-muted/40",
                        )}
                        title={blocked ? "Israel is never geo-redirected (stays on English unless the visitor picks a language)" : undefined}
                      >
                        <Checkbox
                          checked={!blocked && rule.countries.includes(c.code)}
                          disabled={blocked}
                          onCheckedChange={(checked) => toggleCountry(ruleIndex, c.code, !!checked)}
                        />
                        <span className="truncate">{c.name}</span>
                        <span className="text-[10px] text-muted-foreground ml-auto">{c.code}</span>
                      </label>
                    );})}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            Default rules are pre-configured for Albanian, Ukrainian, Arabic, Russian, and Chinese-speaking regions.
            Use <strong>Restore default rules</strong> after upgrades, then enable the switch and save.
            Requires a country header from your CDN (e.g. Cloudflare <code className="bg-muted px-1 rounded">CF-IPCountry</code>).
            Without it, no redirect occurs. QA locally with{" "}
            <code className="bg-muted px-1 rounded">X-VerifyKM-Debug-Country: AL</code>.
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setForm((f) => ({
              ...f,
              geoLanguageRedirect: {
                ...f.geoLanguageRedirect,
                rules: DEFAULT_PLUGINS_FORM.geoLanguageRedirect.rules,
              },
            }));
            setSaved(false);
            toast({ title: "Defaults loaded", description: "Review rules and save to apply." });
          }}
        >
          Restore default rules
        </Button>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" />
            : saved ? <CheckCircle2 className="h-4 w-4" />
            : <Save className="h-4 w-4" />}
          {saved ? "Saved!" : saving ? "Saving…" : "Save plugins"}
        </Button>
      </div>
    </div>
  );
}
