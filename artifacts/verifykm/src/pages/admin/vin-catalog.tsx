import { useState, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useAdminGetVinCatalog, useAdminImportVinCatalog, useAdminImportVinCatalogJson, useAdminCreateVinCatalog } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search, Trash2, Download, Database, Upload,
  ChevronDown, AlertTriangle, CheckSquare, Square, ImageOff,
  CheckCircle2, ArrowRight, Loader2, Plus, X,
} from "lucide-react";
import {
  EMPTY_VIN_CATALOG_FORM,
  VinCatalogDataForm,
  vinCatalogPayloadFromForm,
  type VinCatalogFormState,
} from "@/components/admin/vin-catalog-data-form";
import { mileageColor } from "@/lib/mileage-color";

interface BulkDeleteDialogProps {
  onConfirm: (opts: { all?: boolean; provider?: string; confirmPhrase?: string }) => void;
  onClose: () => void;
  providers: string[];
  isLoading: boolean;
}

function BulkDeleteDialog({ onConfirm, onClose, providers, isLoading }: BulkDeleteDialogProps) {
  const [mode, setMode] = useState<"all" | "provider">("all");
  const [provider, setProvider] = useState(providers[0] ?? "");
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const requiredPhrase = "DELETE ALL CATALOG";
  const phraseOk = confirmPhrase.trim() === requiredPhrase;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-background rounded-2xl shadow-xl border p-6 max-w-sm w-full mx-4">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
          <h2 className="text-lg font-semibold">Bulk Delete VIN Catalog</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          This removes VIN entries from the catalog and revokes client access to those reports. Future lookups for those VINs will hit the provider API again.
        </p>
        <div className="space-y-2 mb-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" checked={mode === "all"} onChange={() => setMode("all")} />
            <span className="text-sm font-medium">All entries</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" checked={mode === "provider"} onChange={() => setMode("provider")} />
            <span className="text-sm font-medium">By provider</span>
          </label>
          {mode === "provider" && (
            <select
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            >
              {providers.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          )}
        </div>
        <div className="mb-6 space-y-2">
          <p className="text-xs text-muted-foreground">
            Type <span className="font-mono font-semibold">{requiredPhrase}</span> to confirm.
          </p>
          <Input
            value={confirmPhrase}
            onChange={(e) => setConfirmPhrase(e.target.value)}
            placeholder={requiredPhrase}
            className="font-mono text-sm"
          />
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={() => onConfirm(
              mode === "all"
                ? { all: true, confirmPhrase: confirmPhrase.trim() }
                : { all: true, provider, confirmPhrase: confirmPhrase.trim() },
            )}
            disabled={isLoading || !phraseOk}
          >
            {isLoading ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface VinData {
  make?: string;
  model?: string;
  year?: number;
  odometer?: number;
  accidentCount?: number;
  isSalvage?: boolean;
  isStolen?: boolean;
  isTaxi?: boolean;
  photos?: string[];
  ownerCount?: number;
}

interface CreateVinModalProps {
  onClose: () => void;
  onCreated: (vin: string) => void;
}

function CreateVinModal({ onClose, onCreated }: CreateVinModalProps) {
  const [vin, setVin] = useState("");
  const [form, setForm] = useState<VinCatalogFormState>(EMPTY_VIN_CATALOG_FORM);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const createMutation = useAdminCreateVinCatalog({
    mutation: {
      onSuccess: () => {
        onCreated(vin.trim().toUpperCase());
      },
      onError: (err: unknown) => {
        const msg =
          (err as { data?: { error?: string } })?.data?.error ??
          (err as { message?: string })?.message ??
          "Failed to create VIN entry";
        setErrorMsg(msg);
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const vinVal = vin.trim().toUpperCase();
    if (vinVal.length !== 17) { setErrorMsg("VIN must be exactly 17 characters"); return; }

    createMutation.mutate({
      data: {
        vin: vinVal,
        ...vinCatalogPayloadFromForm(form),
      } as Parameters<typeof createMutation.mutate>[0]["data"],
    });
  };

  const vinUpper = vin.toUpperCase();
  const vinValid = vinUpper.length === 17;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-background rounded-2xl shadow-xl border w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div>
            <h2 className="text-lg font-semibold">Create VIN Entry</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Full report fields — same shape as provider normalization. Use Refresh on the detail page to auto-fill from the VIN’s source provider (Carstat or GetCarAPI).
            </p>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div className="space-y-1">
            <label className="text-sm font-medium">VIN <span className="text-destructive">*</span></label>
            <div className="flex items-center gap-2">
              <input
                className={`flex-1 rounded-lg border bg-background px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-ring tracking-widest ${vinUpper.length > 0 && !vinValid ? "border-destructive" : ""}`}
                value={vinUpper}
                onChange={e => setVin(e.target.value.toUpperCase())}
                placeholder="17-character VIN"
                maxLength={17}
                spellCheck={false}
                required
              />
              <span className={`text-xs font-mono shrink-0 w-10 text-right ${vinValid ? "text-[#0088d4]" : "text-muted-foreground"}`}>
                {vinUpper.length}/17
              </span>
            </div>
          </div>

          <VinCatalogDataForm
            form={form}
            onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
            compact
          />

          {errorMsg && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {errorMsg}
            </div>
          )}
        </form>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t shrink-0">
          <Button variant="outline" onClick={onClose} disabled={createMutation.isPending}>Cancel</Button>
          <Button
            onClick={handleSubmit as unknown as React.MouseEventHandler}
            disabled={createMutation.isPending || !vinValid}
            className="gap-1.5"
          >
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {createMutation.isPending ? "Creating…" : "Create VIN Entry"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function VinThumb({ photos }: { photos?: string[] }) {
  const [err, setErr] = useState(false);
  const url = photos?.[0];
  if (!url || err) {
    return (
      <div className="h-9 w-14 rounded bg-muted flex items-center justify-center shrink-0">
        <ImageOff className="h-3 w-3 text-muted-foreground/30" />
      </div>
    );
  }
  return (
    <img src={url} alt="" className="h-9 w-14 rounded object-cover shrink-0" onError={() => setErr(true)} />
  );
}

interface ImportResult {
  inserted: number;
  updated: number;
  skipped: number;
  total: number;
  invalidSkipped?: number;
  batchErrors?: number;
  conflictsTruncated?: boolean;
  conflicts: Array<{ vin: string; existing: string; incoming: string }>;
}

export default function AdminVinCatalog() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [providerFilter, setProviderFilter] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState<"csv" | "json" | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const exportLinkRef = useRef<HTMLAnchorElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const importJsonInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const limit = 50;
  const importMutation = useAdminImportVinCatalog({
    mutation: {
      onSuccess: (data) => {
        setImportResult(data as ImportResult);
        queryClient.invalidateQueries({ queryKey: ["/api/admin/vin-catalog"] });
      },
      onError: (err) => {
        setImportError(err.message ?? "Import failed");
      },
    },
  });
  const importJsonMutation = useAdminImportVinCatalogJson({
    mutation: {
      onSuccess: (data) => {
        setImportResult(data as ImportResult);
        queryClient.invalidateQueries({ queryKey: ["/api/admin/vin-catalog"] });
      },
      onError: (err) => {
        setImportError(err.message ?? "JSON import failed");
      },
    },
  });

  const { data, isLoading } = useAdminGetVinCatalog({
    page, limit,
    vin: search || undefined,
    provider: providerFilter || undefined,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit) || 1;
  const allProviders = (data?.providerStats ?? [])
    .map((s) => s.provider ?? "Unknown")
    .filter(Boolean);

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === items.length && items.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map(i => i.id)));
    }
  };

  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  const handleDeleteSelected = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} selected VIN${selected.size > 1 ? "s" : ""} from catalog?`)) return;
    setBulkLoading(true);
    try {
      await fetch(`${basePath}/api/admin/vin-catalog/bulk-delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/admin/vin-catalog"] });
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkDelete = async (opts: { all?: boolean; provider?: string; confirmPhrase?: string }) => {
    setBulkLoading(true);
    try {
      await fetch(`${basePath}/api/admin/vin-catalog/bulk-delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(opts),
      });
      setSelected(new Set());
      setShowBulkDialog(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/vin-catalog"] });
    } finally {
      setBulkLoading(false);
    }
  };

  const handleDeleteOne = async (id: number) => {
    if (!confirm("Remove this VIN from the catalog?")) return;
    await fetch(`${basePath}/api/admin/vin-catalog/${id}`, { method: "DELETE", credentials: "include" });
    setSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/vin-catalog"] });
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!importInputRef.current) return;
    importInputRef.current.value = "";
    if (!file) return;
    setImportResult(null); setImportError(null);
    importMutation.mutate({ data: { file } });
  };

  const handleImportJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!importJsonInputRef.current) return;
    importJsonInputRef.current.value = "";
    if (!file) return;
    setImportResult(null); setImportError(null);
    importJsonMutation.mutate({ data: { file } });
  };

  const handleExport = async (format: "csv" | "json") => {
    setExportLoading(format);
    try {
      const params = new URLSearchParams({ format });
      if (providerFilter) params.set("provider", providerFilter);
      const url = `${basePath}/api/admin/vin-catalog/export?${params}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = exportLinkRef.current!;
      a.href = objectUrl;
      a.download = `vin-catalog-${new Date().toISOString().split("T")[0]}.${format}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
    } finally {
      setExportLoading(null);
    }
  };

  const allSelected = items.length > 0 && selected.size === items.length;
  const someSelected = selected.size > 0 && !allSelected;

  return (
    <div className="space-y-6">
      <a ref={exportLinkRef} className="hidden" aria-hidden="true" />
      <input ref={importInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleImportFile} />
      <input ref={importJsonInputRef} type="file" accept=".json,application/json" className="hidden" onChange={handleImportJsonFile} />

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">VIN Catalog</h1>
          <p className="text-muted-foreground mt-1">
            {total} unique VIN{total !== 1 ? "s" : ""} — canonical cache from paid lookups
          </p>
          <p className="text-xs text-muted-foreground mt-1 max-w-3xl">
            <strong>JSON</strong> export/import is the full server migration format (all histories, registry, market data).
            <strong> CSV</strong> includes the same fields as flat columns plus JSON columns for nested arrays — round-trip safe on a new server.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Add VIN
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={importMutation.isPending || importJsonMutation.isPending}
            onClick={() => importInputRef.current?.click()}
          >
            {importMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {importMutation.isPending ? "Importing…" : "Import CSV"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={importMutation.isPending || importJsonMutation.isPending}
            onClick={() => importJsonInputRef.current?.click()}
          >
            {importJsonMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {importJsonMutation.isPending ? "Importing…" : "Import JSON"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!!exportLoading}
            className="gap-1.5"
            onClick={() => handleExport("csv")}
          >
            <Download className="h-3.5 w-3.5" />
            {exportLoading === "csv" ? "Exporting…" : "CSV"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!!exportLoading}
            className="gap-1.5"
            onClick={() => handleExport("json")}
          >
            <Download className="h-3.5 w-3.5" />
            {exportLoading === "json" ? "Exporting…" : "JSON"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={() => setShowBulkDialog(true)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Bulk Delete
            <ChevronDown className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Import result / error */}
      {importResult && (
        <div className="flex flex-col gap-1 px-4 py-3 bg-[#00a5fd]/10 border border-[#00a5fd]/30 rounded-xl text-sm">
          <div className="flex items-center gap-2 font-medium text-[#0369a1] dark:text-[#33bbfd]">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Import complete — {importResult.total} VIN{importResult.total !== 1 ? "s" : ""} processed
          </div>
          <div className="text-muted-foreground text-xs pl-6">
            {importResult.inserted} inserted · {importResult.updated} updated · {importResult.skipped} skipped (conflict)
            {(importResult.invalidSkipped ?? 0) > 0 && (
              <> · {importResult.invalidSkipped} invalid VIN{importResult.invalidSkipped !== 1 ? "s" : ""} skipped</>
            )}
            {(importResult.batchErrors ?? 0) > 0 && (
              <> · {importResult.batchErrors} batch error{importResult.batchErrors !== 1 ? "s" : ""}</>
            )}
          </div>
          {importResult.conflicts.length > 0 && (
            <details className="pl-6 mt-1">
              <summary className="text-xs cursor-pointer text-muted-foreground hover:text-foreground">
                {importResult.conflicts.length} conflict{importResult.conflicts.length !== 1 ? "s" : ""} — click to view
              </summary>
              <ul className="mt-1 space-y-0.5">
                {importResult.conflicts.map(c => (
                  <li key={c.vin} className="text-xs font-mono">
                    <span className="font-medium">{c.vin}</span>: existing "{c.existing}" vs incoming "{c.incoming}"
                  </li>
                ))}
              </ul>
            </details>
          )}
          <button className="pl-6 text-xs text-muted-foreground hover:text-foreground self-start" onClick={() => setImportResult(null)}>Dismiss</button>
        </div>
      )}
      {importError && (
        <div className="flex items-center gap-2 px-4 py-3 bg-destructive/10 border border-destructive/30 rounded-xl text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {importError}
          <button className="ml-auto text-xs opacity-60 hover:opacity-100" onClick={() => setImportError(null)}>✕</button>
        </div>
      )}

      {/* Provider stats */}
      {(data?.providerStats ?? []).length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { setProviderFilter(""); setPage(1); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors ${
              !providerFilter ? "bg-primary text-primary-foreground border-primary" : "border bg-background hover:bg-muted"
            }`}
          >
            <Database className="h-3.5 w-3.5" />
            All ({total})
          </button>
          {(data?.providerStats ?? []).map((s) => (
            <button
              key={s.provider ?? "unknown"}
              onClick={() => { setProviderFilter(s.provider ?? ""); setPage(1); }}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                providerFilter === (s.provider ?? "")
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border bg-background hover:bg-muted"
              }`}
            >
              {s.provider ?? "Unknown"} ({s.cnt})
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter by VIN…"
            className="pl-9 font-mono"
            value={search}
            onChange={(e) => { setSearch(e.target.value.toUpperCase()); setPage(1); setSelected(new Set()); }}
          />
        </div>
      </div>

      {/* Bulk selection bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-primary/10 border border-primary/30 rounded-xl">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <Button
            size="sm"
            variant="destructive"
            onClick={handleDeleteSelected}
            disabled={bulkLoading}
            className="ml-auto"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Delete Selected
          </Button>
          <Button size="sm" variant="outline" onClick={() => setSelected(new Set())}>
            Deselect All
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Database className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-muted-foreground">No VINs in catalog yet. They populate automatically after paid lookups.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr>
                    <th className="p-4 w-10">
                      <button onClick={toggleAll} className="text-muted-foreground hover:text-foreground transition-colors">
                        {allSelected ? <CheckSquare className="h-4 w-4" /> : someSelected ? <CheckSquare className="h-4 w-4 opacity-50" /> : <Square className="h-4 w-4" />}
                      </button>
                    </th>
                    <th className="text-left p-4 font-medium text-muted-foreground w-16">Photo</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">VIN</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Vehicle</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Mileage</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Flags</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Provider</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Imported</th>
                    <th className="text-right p-4 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const d = (item.data ?? {}) as VinData;
                    const make = String(d.make ?? "").trim();
                    const model = String(d.model ?? "").trim();
                    const year = d.year ? String(d.year) : "";
                    const vehicle = [year, make, model].filter(Boolean).join(" ") || "—";
                    const isChecked = selected.has(item.id);
                    const vinPath = `/adminx/vin/${item.vin}`;
                    const odoCol = d.odometer != null ? mileageColor(d.odometer) : null;
                    const odoMax = 300_000; // same fill scale as VIN reports

                    return (
                      <tr
                        key={item.id}
                        className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${isChecked ? "bg-primary/5" : ""}`}
                      >
                        <td className="p-4 w-10">
                          <button onClick={() => toggleSelect(item.id)} className="text-muted-foreground hover:text-foreground transition-colors">
                            {isChecked ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}
                          </button>
                        </td>
                        <td className="p-4">
                          <VinThumb photos={d.photos} />
                        </td>
                        <td className="p-4 font-mono font-medium text-xs tracking-wide">{item.vin}</td>
                        <td className="p-4 max-w-[160px]">
                          <span className="text-sm font-medium truncate block">{vehicle}</span>
                          {d.ownerCount != null && (
                            <span className="text-[10px] text-muted-foreground">{d.ownerCount} owner{d.ownerCount !== 1 ? "s" : ""}</span>
                          )}
                        </td>
                        <td className="p-4">
                          {d.odometer != null && odoCol ? (
                            <div className="flex flex-col gap-0.5">
                              <span className={`text-xs tabular-nums font-medium ${odoCol.text}`}>
                                {d.odometer.toLocaleString()} km
                              </span>
                              <div className="w-16 h-1 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${odoCol.bar}`}
                                  style={{ width: `${Math.min(100, (d.odometer / odoMax) * 100)}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col gap-0.5">
                            {(d.accidentCount ?? 0) > 0 && (
                              <Badge variant="destructive" className="text-[10px] py-0 h-4 w-fit">
                                {d.accidentCount} accident{d.accidentCount! > 1 ? "s" : ""}
                              </Badge>
                            )}
                            {d.isSalvage && (
                              <Badge variant="outline" className="text-[10px] py-0 h-4 w-fit border-orange-400 text-orange-600">
                                Salvage
                              </Badge>
                            )}
                            {d.isTaxi && (
                              <Badge variant="outline" className="text-[10px] py-0 h-4 w-fit border-amber-400 text-amber-700">
                                Taxi
                              </Badge>
                            )}
                            {!(d.accidentCount ?? 0) && !d.isSalvage && (
                              <span className="text-[10px] text-[#0088d4] font-medium">Clean</span>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-muted-foreground text-sm">
                          {item.providerName === "manual_pending" ? "admin" : (item.providerName ?? "—")}
                        </td>
                        <td className="p-4 text-muted-foreground text-xs whitespace-nowrap">
                          {new Date(item.importedAt).toLocaleString()}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center gap-1 justify-end">
                            <Link href={vinPath}>
                              <Button size="sm" variant="ghost" className="gap-1 text-xs h-7">
                                Manage <ArrowRight className="h-3 w-3" />
                              </Button>
                            </Link>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 w-7 p-0"
                              onClick={() => handleDeleteOne(item.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
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

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Page {page} of {totalPages} · {total} total</p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => { setPage(1); setSelected(new Set()); }}
            >
              Latest
            </Button>
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => { setPage(p => p - 1); setSelected(new Set()); }}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => { setPage(p => p + 1); setSelected(new Set()); }}>
              Next
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => { setPage(totalPages); setSelected(new Set()); }}
            >
              Last
            </Button>
          </div>
        </div>
      )}

      {showBulkDialog && (
        <BulkDeleteDialog
          providers={allProviders}
          isLoading={bulkLoading}
          onConfirm={handleBulkDelete}
          onClose={() => setShowBulkDialog(false)}
        />
      )}

      {showCreateModal && (
        <CreateVinModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(vin) => {
            setShowCreateModal(false);
            queryClient.invalidateQueries({ queryKey: ["/api/admin/vin-catalog"] });
            setLocation(`/adminx/vin/${vin}`);
          }}
        />
      )}
    </div>
  );
}
