import { useState } from "react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Megaphone, ExternalLink, Edit2, Check, X, Globe } from "lucide-react";
import { LANG_PICKER_OPTIONS, type Language } from "@/lib/languages";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

/** Site languages — same source as navbar / i18n (includes ka, zh, …). */
const SUPPORTED_LANGUAGES = LANG_PICKER_OPTIONS;
const DEFAULT_LANG_TAB: Language = SUPPORTED_LANGUAGES[0]?.code ?? "en";

type LangOverride = {
  message?: string;
  linkText?: string;
  linkUrl?: string;
  hidden?: boolean;
};

type Announcement = {
  id: number;
  message: string;
  linkText: string | null;
  linkUrl: string | null;
  isActive: boolean;
  showTo: string;
  pages: string;
  endsAt: string | null;
  createdAt: string;
  translations: Record<string, LangOverride> | null;
};

type FormState = {
  message: string;
  linkText: string;
  linkUrl: string;
  isActive: boolean;
  showTo: string;
  pages: string[];
  endsAt: string;
  translations: Record<string, LangOverride>;
};

const PAGE_OPTIONS = [
  { value: "home",    label: "Home" },
  { value: "pricing", label: "Pricing" },
  { value: "checkout",label: "Checkout" },
  { value: "decoder", label: "Free VIN Decoder" },
  { value: "country", label: "Country pages" },
  { value: "auth",    label: "Sign in / Sign up" },
];

const BLANK: FormState = {
  message: "",
  linkText: "",
  linkUrl: "",
  isActive: true,
  showTo: "all",
  pages: [],
  endsAt: "",
  translations: {},
};

function pagesDisplay(pages: string) {
  if (pages === "all") return "All pages";
  return pages.split(",").map(p => PAGE_OPTIONS.find(o => o.value === p)?.label ?? p).join(", ");
}

function translationCount(translations: Record<string, LangOverride> | null): number {
  if (!translations) return 0;
  return Object.values(translations).filter(v => v.hidden || v.message || v.linkText || v.linkUrl).length;
}

function useAnnouncements() {
  return useQuery<Announcement[]>({
    queryKey: ["/api/admin/announcements"],
    queryFn: async () => {
      const r = await fetch(`${basePath}/api/admin/announcements`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load");
      return r.json();
    },
  });
}

function buildBody(form: FormState) {
  return {
    message: form.message,
    linkText: form.linkText || null,
    linkUrl: form.linkUrl || null,
    isActive: form.isActive,
    showTo: form.showTo,
    pages: form.pages.length === 0 ? "all" : form.pages.join(","),
    endsAt: form.endsAt || null,
    translations: Object.keys(form.translations).length ? form.translations : null,
  };
}

function useCreate(onSuccess: () => void) {
  return useMutation({
    mutationFn: async (form: FormState) => {
      const r = await fetch(`${basePath}/api/admin/announcements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(buildBody(form)),
      });
      if (!r.ok) throw new Error("Failed to create");
      return r.json();
    },
    onSuccess,
  });
}

function useUpdate(onSuccess: () => void) {
  return useMutation({
    mutationFn: async ({ id, ...form }: FormState & { id: number }) => {
      const r = await fetch(`${basePath}/api/admin/announcements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(buildBody(form)),
      });
      if (!r.ok) throw new Error("Failed to update");
      return r.json();
    },
    onSuccess,
  });
}

function useDelete(onSuccess: () => void) {
  return useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`${basePath}/api/admin/announcements/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) throw new Error("Failed to delete");
    },
    onSuccess,
  });
}

function LangOverrideTab({
  lang,
  override,
  onChange,
}: {
  lang: (typeof SUPPORTED_LANGUAGES)[number];
  override: LangOverride;
  onChange: (v: LangOverride) => void;
}) {
  const set = (patch: Partial<LangOverride>) => onChange({ ...override, ...patch });

  return (
    <div className="space-y-3 pt-1">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <img src={`https://flagcdn.com/${lang.flag}.svg`} alt="" className="h-4 w-auto rounded-sm" />
          <span className="text-sm font-medium">{lang.label}</span>
          <span className="text-[11px] text-muted-foreground uppercase">{lang.code}</span>
        </div>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <Switch
            checked={override.hidden === true}
            onCheckedChange={v => set({ hidden: v })}
          />
          <span className="text-sm text-muted-foreground">Hide bar for this language</span>
        </label>
      </div>

      {!override.hidden && (
        <div className="space-y-3 pl-1">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Message override <span className="italic">(leave empty to use default)</span></Label>
            <Textarea
              value={override.message ?? ""}
              onChange={e => set({ message: e.target.value || undefined })}
              placeholder="Leave empty to use the default message…"
              rows={2}
              className="resize-none text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Button label override</Label>
              <Input
                value={override.linkText ?? ""}
                onChange={e => set({ linkText: e.target.value || undefined })}
                placeholder="Leave empty to use default"
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Button URL override</Label>
              <Input
                value={override.linkUrl ?? ""}
                onChange={e => set({ linkUrl: e.target.value || undefined })}
                placeholder="Leave empty to use default"
                className="text-sm"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AnnouncementForm({
  initial,
  onSubmit,
  onCancel,
  busy,
  submitLabel,
}: {
  initial: FormState;
  onSubmit: (f: FormState) => void;
  onCancel?: () => void;
  busy: boolean;
  submitLabel: string;
}) {
  const [form, setForm] = useState<FormState>(initial);
  const [activeLangTab, setActiveLangTab] = useState<string | null>(null);
  const allPages = form.pages.length === 0;

  const togglePage = (val: string) => {
    setForm(f => ({
      ...f,
      pages: f.pages.includes(val) ? f.pages.filter(p => p !== val) : [...f.pages, val],
    }));
  };

  const setLangOverride = (code: string, v: LangOverride) => {
    setForm(f => {
      const next = { ...f.translations, [code]: v };
      const isEmpty = !v.hidden && !v.message && !v.linkText && !v.linkUrl;
      if (isEmpty) delete next[code];
      return { ...f, translations: next };
    });
  };

  return (
    <div className="space-y-5">
      {/* Default message */}
      <div className="space-y-1.5">
        <Label>Default message <span className="text-destructive">*</span> <span className="text-xs text-muted-foreground font-normal">(shown when no language override applies)</span></Label>
        <Textarea
          value={form.message}
          onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
          placeholder="🎉 Use code SAVE20 for 20% off your first report!"
          rows={2}
          className="resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Default button label <span className="text-muted-foreground text-xs">(optional)</span></Label>
          <Input
            value={form.linkText}
            onChange={e => setForm(f => ({ ...f, linkText: e.target.value }))}
            placeholder="Get discount"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Default button URL <span className="text-muted-foreground text-xs">(optional)</span></Label>
          <Input
            value={form.linkUrl}
            onChange={e => setForm(f => ({ ...f, linkUrl: e.target.value }))}
            placeholder="/en/pricing or https://..."
          />
        </div>
      </div>

      {/* Per-language overrides */}
      <div className="rounded-xl border bg-muted/20 overflow-hidden">
        <button
          type="button"
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold hover:bg-muted/40 transition-colors"
          onClick={() => setActiveLangTab(t => (t ? null : DEFAULT_LANG_TAB))}
        >
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            Per-language overrides
            {Object.keys(form.translations).length > 0 && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                {Object.keys(form.translations).length} set
              </Badge>
            )}
            <span className="text-[11px] font-normal text-muted-foreground">
              ({SUPPORTED_LANGUAGES.length} languages)
            </span>
          </div>
          <span className="text-muted-foreground text-xs">{activeLangTab ? "▲ collapse" : "▼ expand"}</span>
        </button>

        {activeLangTab && (
          <div className="border-t">
            {/* Language tab strip — all site langs; scroll if needed */}
            <div className="flex border-b bg-muted/10 overflow-x-auto">
              {SUPPORTED_LANGUAGES.map(lang => {
                const hasOverride = !!form.translations[lang.code];
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => setActiveLangTab(lang.code)}
                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors shrink-0 ${
                      activeLangTab === lang.code
                        ? "border-primary text-primary bg-background"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
                    }`}
                  >
                    <img src={`https://flagcdn.com/${lang.flag}.svg`} alt="" className="h-3 w-auto rounded-sm" />
                    {lang.code.toUpperCase()}
                    {hasOverride && <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
                  </button>
                );
              })}
            </div>

            {/* Active tab content */}
            {SUPPORTED_LANGUAGES.map(lang => (
              activeLangTab === lang.code && (
                <div key={lang.code} className="p-4">
                  <LangOverrideTab
                    lang={lang}
                    override={form.translations[lang.code] ?? {}}
                    onChange={v => setLangOverride(lang.code, v)}
                  />
                </div>
              )
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Show to</Label>
          <select
            value={form.showTo}
            onChange={e => setForm(f => ({ ...f, showTo: e.target.value }))}
            className="w-full h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="all">Everyone</option>
            <option value="guests">Visitors (not signed in)</option>
            <option value="users">Signed-in users</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Expires</Label>
          <Input
            type="datetime-local"
            value={form.endsAt}
            onChange={e => setForm(f => ({ ...f, endsAt: e.target.value }))}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Show on pages</Label>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setForm(f => ({ ...f, pages: [] }))}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              allPages
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:border-primary"
            }`}
          >
            All pages
          </button>
          {PAGE_OPTIONS.map(opt => {
            const active = form.pages.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => togglePage(opt.value)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:border-primary"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <Switch
          id="ann-active"
          checked={form.isActive}
          onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))}
        />
        <Label htmlFor="ann-active" className="cursor-pointer">Active (visible to visitors)</Label>
      </div>

      <div className="flex gap-2 pt-1">
        <Button
          onClick={() => onSubmit(form)}
          disabled={busy || !form.message.trim()}
          className="gap-2"
        >
          <Check className="h-4 w-4" />
          {submitLabel}
        </Button>
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}

export default function AdminAnnouncements() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/admin/announcements"] });

  const { data, isLoading } = useAnnouncements();
  const createMut = useCreate(invalidate);
  const updateMut = useUpdate(invalidate);
  const deleteMut = useDelete(invalidate);

  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const handleCreate = (form: FormState) => {
    createMut.mutate(form, { onSuccess: () => setShowCreate(false) });
  };

  const handleUpdate = (id: number, form: FormState) => {
    updateMut.mutate({ id, ...form }, { onSuccess: () => setEditingId(null) });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Announcements</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage the promo bar shown at the top of every page.</p>
        </div>
        <Button onClick={() => setShowCreate(s => !s)} className="gap-2">
          <Plus className="h-4 w-4" />
          New announcement
        </Button>
      </div>

      {showCreate && (
        <Card className="border-primary/30 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Create announcement</CardTitle>
          </CardHeader>
          <CardContent>
            <AnnouncementForm
              initial={BLANK}
              onSubmit={handleCreate}
              onCancel={() => setShowCreate(false)}
              busy={createMut.isPending}
              submitLabel="Create"
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-primary" />
            All announcements
          </CardTitle>
          <CardDescription>Only active (non-expired) announcements are shown to visitors.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
            </div>
          ) : !data?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <Megaphone className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No announcements yet. Create one above.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.map(ann => (
                <div key={ann.id} className="rounded-xl border bg-muted/20 overflow-hidden">
                  {editingId === ann.id ? (
                    <div className="p-4">
                      <p className="text-sm font-semibold mb-3">Edit announcement #{ann.id}</p>
                      <AnnouncementForm
                        initial={{
                          message: ann.message,
                          linkText: ann.linkText ?? "",
                          linkUrl: ann.linkUrl ?? "",
                          isActive: ann.isActive,
                          showTo: ann.showTo,
                          pages: ann.pages === "all" ? [] : ann.pages.split(","),
                          endsAt: ann.endsAt ? ann.endsAt.slice(0, 16) : "",
                          translations: ann.translations ?? {},
                        }}
                        onSubmit={form => handleUpdate(ann.id, form)}
                        onCancel={() => setEditingId(null)}
                        busy={updateMut.isPending}
                        submitLabel="Save changes"
                      />
                    </div>
                  ) : (
                    <div className="flex items-start gap-3 p-4">
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <p className="text-sm font-medium leading-snug">{ann.message}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={ann.isActive ? "default" : "secondary"} className="text-[10px]">
                            {ann.isActive ? "Active" : "Inactive"}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {ann.showTo === "all" ? "Everyone" : ann.showTo === "guests" ? "Visitors" : "Users"}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {pagesDisplay(ann.pages)}
                          </Badge>
                          {ann.linkUrl && (
                            <Badge variant="outline" className="text-[10px] gap-1">
                              <ExternalLink className="h-2.5 w-2.5" />
                              {ann.linkText || ann.linkUrl}
                            </Badge>
                          )}
                          {translationCount(ann.translations) > 0 && (
                            <Badge variant="outline" className="text-[10px] gap-1">
                              <Globe className="h-2.5 w-2.5" />
                              {translationCount(ann.translations)} lang override{translationCount(ann.translations) !== 1 ? "s" : ""}
                            </Badge>
                          )}
                          {ann.endsAt && (
                            <span className="text-[10px] text-muted-foreground">
                              Expires {new Date(ann.endsAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => setEditingId(ann.id)}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          disabled={deleteMut.isPending}
                          onClick={() => deleteMut.mutate(ann.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
