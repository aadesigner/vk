import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ChevronRight, Download, Upload, Loader2, CheckCircle2, Copy, Check } from "lucide-react";
import { formatCountryName } from "@/lib/format-country-name";
import { ADMIN_PENDING_COUNT_QUERY_KEY } from "@/lib/admin-pending-count";

function waitLabel(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "just now";
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function vehicleTitle(data: Record<string, unknown> | null): string | null {
  if (!data) return null;
  const year = data.year != null ? String(data.year) : "";
  const make = typeof data.make === "string" ? data.make : "";
  const model = typeof data.model === "string" ? data.model : "";
  const parts = [year, make, model].filter(Boolean);
  return parts.length ? parts.join(" ") : null;
}

type PendingRequest = {
  id: number;
  userId: string;
  email: string | null;
  name: string | null;
  lookupId: number;
  createdAt: string;
};

type PendingItem = {
  id: number;
  vin: string;
  status: string;
  draftData: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  requests: PendingRequest[];
};

export default function AdminPendingVinChecks() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [exportLoading, setExportLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copiedVin, setCopiedVin] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const exportLinkRef = useRef<HTMLAnchorElement>(null);
  const limit = 50;
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  const { data, isLoading } = useQuery({
    queryKey: ["/api/admin/pending-vin-checks", page, limit],
    queryFn: async () => {
      const r = await fetch(`${basePath}/api/admin/pending-vin-checks?page=${page}&limit=${limit}`, {
        credentials: "include",
      });
      if (!r.ok) throw new Error("Failed to load pending VIN checks");
      return r.json() as Promise<{ items: PendingItem[]; total: number; page: number; limit: number }>;
    },
  });

  const items = (data?.items ?? []).filter((row) => {
    if (!search.trim()) return true;
    const q = search.trim().toUpperCase();
    if (row.vin.toUpperCase().includes(q)) return true;
    const title = vehicleTitle(row.draftData)?.toUpperCase() ?? "";
    if (title.includes(q)) return true;
    return row.requests.some(
      (r) =>
        (r.email ?? "").toUpperCase().includes(q) ||
        (r.name ?? "").toUpperCase().includes(q),
    );
  });
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit) || 1;

  const handleExportAll = async () => {
    setExportLoading(true);
    setImportMsg(null);
    try {
      const r = await fetch(`${basePath}/api/admin/pending-vin-checks/export.json`, { credentials: "include" });
      if (!r.ok) throw new Error("Export failed");
      const blob = await r.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = exportLinkRef.current!;
      a.href = objectUrl;
      a.download = `pending-vin-checks-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
    } catch {
      setImportMsg({ ok: false, text: "JSON export failed." });
    } finally {
      setExportLoading(false);
    }
  };

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (importInputRef.current) importInputRef.current.value = "";
    if (!file) return;
    setImportLoading(true);
    setImportMsg(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const r = await fetch(`${basePath}/api/admin/pending-vin-checks/import-json`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        setImportMsg({ ok: false, text: (body as { error?: string }).error ?? "Import failed" });
        return;
      }
      const result = body as { updated?: number; skipped?: number };
      setImportMsg({
        ok: true,
        text: `Imported ${result.updated ?? 0} draft(s)${result.skipped ? ` · ${result.skipped} skipped` : ""}.`,
      });
      void queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-vin-checks"] });
      void queryClient.invalidateQueries({ queryKey: ADMIN_PENDING_COUNT_QUERY_KEY });
    } catch {
      setImportMsg({ ok: false, text: "Import failed — network error" });
    } finally {
      setImportLoading(false);
    }
  };

  const handleCopyVin = async (e: React.MouseEvent, vin: string) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(vin);
      setCopiedVin(vin);
      window.setTimeout(() => setCopiedVin((cur) => (cur === vin ? null : cur)), 1500);
    } catch {
      setImportMsg({ ok: false, text: `Could not copy ${vin}.` });
    }
  };

  return (
    <div className="space-y-6">
      <a ref={exportLinkRef} className="hidden" aria-hidden="true" />
      <input ref={importInputRef} type="file" accept=".json,application/json" className="hidden" onChange={handleImportJson} />

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pending VIN checks</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {total} waiting · open a row, fill the report, publish
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-muted-foreground" onClick={handleExportAll} disabled={exportLoading || importLoading || total === 0}>
            {exportLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Export
          </Button>
          <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-muted-foreground" onClick={() => importInputRef.current?.click()} disabled={exportLoading || importLoading}>
            {importLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Import
          </Button>
        </div>
      </div>

      {importMsg && (
        <div className={`text-sm px-4 py-2 rounded-lg border flex items-center gap-2 ${importMsg.ok ? "bg-[#e6f6ff] border-[#b3e3fe] text-[#075985] dark:bg-[#003a5c]/40/30 dark:border-[#006aa8] dark:text-[#7dd3fc]" : "bg-red-50 border-red-200 text-red-800 dark:bg-red-950/30 dark:border-red-800 dark:text-red-300"}`}>
          {importMsg.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : null}
          {importMsg.text}
        </div>
      )}

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="VIN, car, or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border bg-background p-12 text-center text-muted-foreground">
          {search.trim() ? "No match on this page." : "Nothing waiting."}
        </div>
      ) : (
        <div className="rounded-2xl border bg-card overflow-hidden divide-y">
          {items.map((row) => {
            const title = vehicleTitle(row.draftData);
            const country = typeof row.draftData?.country === "string" ? row.draftData.country : null;
            const buyer = row.requests[0]?.email || row.requests[0]?.name || null;
            const waited = waitLabel(row.requests[0]?.createdAt ?? row.createdAt);
            return (
              <div
                key={row.id}
                className="flex items-center gap-2 px-4 sm:px-5 py-3.5 hover:bg-muted/40 transition-colors"
              >
                <button
                  type="button"
                  className="flex-1 min-w-0 text-left flex items-center gap-3"
                  onClick={() => setLocation(`/adminx/pending-vin-checks/${row.id}`)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-mono text-[13px] font-semibold tracking-wide truncate">{row.vin}</p>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {title ?? "No vehicle data yet"}
                      {country ? ` · ${formatCountryName(country, "en", { usa: "USA", korea: "Korea" })}` : ""}
                      {buyer ? ` · ${buyer}` : ""}
                      {row.requests.length > 1 ? ` · +${row.requests.length - 1}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                    {waited}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-8 w-8"
                  title={`Copy ${row.vin}`}
                  onClick={(e) => handleCopyVin(e, row.vin)}
                >
                  {copiedVin === row.vin ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground px-2">
            Page {page} of {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Published VINs move to{" "}
        <Link href="/adminx/vin-catalog" className="text-primary hover:underline">VIN Catalog</Link>{" "}
        (provider <span className="font-mono">admin</span>) — not while still pending here.
      </p>
    </div>
  );
}
