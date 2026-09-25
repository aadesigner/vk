import { useState, useMemo } from "react";
import {
  useAdminGetVinLookups,
  useAdminRefreshVin,
  useAdminBulkDeleteVin,
  AdminGetVinLookupsStatus,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { adminVinLookupsQuery } from "@/lib/admin-query-options";
import { invalidateVinReportCaches } from "@/lib/vin-report-cache";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Search, RefreshCw, Trash2, ImageOff, AlertTriangle, Download } from "lucide-react";

const STATUS_VARIANTS: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  complete: "default",
  pending: "secondary",
  error: "destructive",
};

const STATUS_OPTIONS = ["complete", "error", "pending"] as const;

interface VinData {
  make?: string;
  model?: string;
  year?: number;
  odometer?: number;
  accidentCount?: number;
  isSalvage?: boolean;
  photos?: string[];
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
    <img
      src={url}
      alt=""
      className="h-9 w-14 rounded object-cover shrink-0"
      onError={() => setErr(true)}
    />
  );
}

type DialogCategory = "errors" | "pending" | "cache" | "provider";

export default function AdminLookups() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [fromCacheFilter, setFromCacheFilter] = useState<string>("");
  const [providerFilter, setProviderFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);

  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [dialogCategory, setDialogCategory] = useState<DialogCategory | "">("");
  const [dialogProvider, setDialogProvider] = useState<string>("");

  const queryClient = useQueryClient();
  const limit = 25;

  const params = {
    page,
    limit,
    vin: search || undefined,
    status: (statusFilter || undefined) as AdminGetVinLookupsStatus | undefined,
    fromCache:
      fromCacheFilter === "true"
        ? true
        : fromCacheFilter === "false"
          ? false
          : undefined,
    provider: providerFilter || undefined,
  };

  const { data, isLoading } = useAdminGetVinLookups(params, { query: adminVinLookupsQuery() });

  const refreshVin = useAdminRefreshVin({
    mutation: {
      onSuccess: (lookup) => {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/vin"] });
        if (lookup?.vin) {
          invalidateVinReportCaches(queryClient, lookup.vin, lookup.id);
        }
      },
    },
  });

  const bulkDelete = useAdminBulkDeleteVin({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/vin"] });
        setBulkDialogOpen(false);
        setDialogCategory("");
        setDialogProvider("");
      },
    },
  });

  const allProviders = useMemo(() => {
    if (!data?.items) return [];
    const names = data.items
      .map((l) => l.providerName)
      .filter((n): n is string => Boolean(n));
    return [...new Set(names)].sort();
  }, [data?.items]);

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
      const body: Record<string, unknown> = {};
      if (search) body.vin = search;
      if (statusFilter) body.status = statusFilter;
      if (fromCacheFilter !== "") body.fromCache = fromCacheFilter === "true";
      if (providerFilter) body.provider = providerFilter;

      const res = await fetch(`${basePath}/api/admin/vin/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "vin-lookups.csv";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Permanently delete this VIN lookup record from the database?")) return;
    setDeletingId(id);
    try {
      const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
      await fetch(`${basePath}/api/admin/vin/${id}`, { method: "DELETE" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/vin"] });
    } finally {
      setDeletingId(null);
    }
  };

  const openBulkDialog = () => {
    setDialogCategory("");
    setDialogProvider("");
    setBulkDialogOpen(true);
  };

  const handleBulkDelete = () => {
    if (!dialogCategory) return;

    const body: Record<string, unknown> = {};

    if (dialogCategory === "errors") body.status = "error";
    else if (dialogCategory === "pending") body.status = "pending";
    else if (dialogCategory === "cache") body.fromCache = true;
    else if (dialogCategory === "provider") body.provider = dialogProvider;

    if (statusFilter && body.status === undefined) body.status = statusFilter;
    if (fromCacheFilter !== "" && body.fromCache === undefined) {
      body.fromCache = fromCacheFilter === "true";
    }
    if (providerFilter && body.provider === undefined) {
      body.provider = providerFilter;
    }

    bulkDelete.mutate({ data: body });
  };

  const bulkDeleteReady =
    dialogCategory !== "" &&
    (dialogCategory !== "provider" || Boolean(dialogProvider));

  const bulkDeleteSummary = useMemo(() => {
    const parts: string[] = [];
    if (dialogCategory === "errors") parts.push("status = error");
    else if (dialogCategory === "pending") parts.push("status = pending");
    else if (dialogCategory === "cache") parts.push("from cache");
    else if (dialogCategory === "provider" && dialogProvider)
      parts.push(`provider = ${dialogProvider}`);
    if (statusFilter && dialogCategory !== "errors" && dialogCategory !== "pending")
      parts.push(`status = ${statusFilter}`);
    if (fromCacheFilter !== "" && dialogCategory !== "cache")
      parts.push(fromCacheFilter === "true" ? "from cache" : "live fetches");
    if (providerFilter && dialogCategory !== "provider")
      parts.push(`provider = ${providerFilter}`);
    return parts.join(" AND ");
  }, [dialogCategory, dialogProvider, statusFilter, fromCacheFilter, providerFilter]);

  const hasActiveFilters =
    Boolean(statusFilter) || fromCacheFilter !== "" || Boolean(providerFilter) || Boolean(search);

  const lookups = data?.items ?? [];
  const totalPages = data ? Math.ceil(data.total / limit) : 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">VIN Lookups</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{data?.total ?? 0} total lookups</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={exporting}
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            {exporting ? "Exporting…" : "Export CSV"}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={openBulkDialog}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Bulk Delete
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row flex-wrap gap-3 min-w-0">
        <div className="relative flex-1 min-w-0 w-full sm:min-w-[180px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter by VIN..."
            className="pl-9 font-mono"
            value={search}
            onChange={(e) => { setSearch(e.target.value.toUpperCase()); setPage(1); }}
          />
        </div>

        <Select
          value={statusFilter || "all"}
          onValueChange={(v) => { setStatusFilter(v === "all" ? "" : v); setPage(1); }}
        >
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={fromCacheFilter === "" ? "all" : fromCacheFilter}
          onValueChange={(v) => { setFromCacheFilter(v === "all" ? "" : v); setPage(1); }}
        >
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            <SelectItem value="true">From cache</SelectItem>
            <SelectItem value="false">Live fetch</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={providerFilter || "all"}
          onValueChange={(v) => { setProviderFilter(v === "all" ? "" : v); setPage(1); }}
        >
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Provider" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All providers</SelectItem>
            {allProviders.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              setStatusFilter("");
              setFromCacheFilter("");
              setProviderFilter("");
              setPage(1);
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          ) : lookups.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">No lookups found</p>
          ) : (
            <>
            <div className="md:hidden divide-y">
              {lookups.map((lookup) => {
                const vd = lookup.data as VinData | null | undefined;
                const vehicleName = vd?.make && vd?.model
                  ? `${vd.year ? vd.year + " " : ""}${vd.make} ${vd.model}`
                  : null;
                return (
                  <div key={lookup.id} className="p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <VinThumb photos={vd?.photos} />
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-xs font-semibold break-all">{lookup.vin}</p>
                        {vehicleName && <p className="text-xs text-muted-foreground mt-0.5">{vehicleName}</p>}
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          <Badge variant={STATUS_VARIANTS[lookup.status] ?? "secondary"} className="text-[10px]">{lookup.status}</Badge>
                          {lookup.fromCache ? <Badge variant="outline" className="text-[10px]">cache</Badge> : null}
                          {lookup.providerName && <Badge variant="secondary" className="text-[10px]">{lookup.providerName}</Badge>}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                      {vd?.odometer != null && <span>{vd.odometer.toLocaleString()} km</span>}
                      {(vd?.accidentCount ?? 0) > 0 && <span>{vd!.accidentCount} accidents</span>}
                      {vd?.isSalvage && <span className="text-orange-600">Salvage</span>}
                      <span className="ml-auto">{new Date(lookup.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => refreshVin.mutate({ id: lookup.id })} disabled={refreshVin.isPending}>
                        <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(lookup.id)} disabled={deletingId === lookup.id}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr>
                    <th className="text-left p-4 font-medium text-muted-foreground w-16">Photo</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">VIN / Vehicle</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">User</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Provider</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Source</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Details</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Date</th>
                    <th className="text-right p-4 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {lookups.map((lookup) => {
                    const vd = lookup.data as VinData | null | undefined;
                    const vehicleName = vd?.make && vd?.model
                      ? `${vd.year ? vd.year + " " : ""}${vd.make} ${vd.model}`
                      : null;
                    return (
                      <tr key={lookup.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="p-4">
                          <VinThumb photos={vd?.photos} />
                        </td>
                        <td className="p-4">
                          <p className="font-mono font-medium text-xs">{lookup.vin}</p>
                          {vehicleName && (
                            <p className="text-xs text-muted-foreground mt-0.5">{vehicleName}</p>
                          )}
                        </td>
                        <td className="p-4 text-muted-foreground text-xs max-w-[130px] truncate">
                          {lookup.userId}
                        </td>
                        <td className="p-4">
                          <Badge variant={STATUS_VARIANTS[lookup.status] ?? "secondary"}>
                            {lookup.status}
                          </Badge>
                        </td>
                        <td className="p-4 text-muted-foreground text-xs">
                          {lookup.providerName ?? "—"}
                        </td>
                        <td className="p-4">
                          {lookup.fromCache ? (
                            <Badge variant="outline" className="text-xs">cache</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">live</span>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col gap-0.5">
                            {vd?.odometer != null && (
                              <span className="text-xs text-muted-foreground tabular-nums">
                                {vd.odometer.toLocaleString()} km
                              </span>
                            )}
                            {(vd?.accidentCount ?? 0) > 0 && (
                              <Badge variant="destructive" className="text-[10px] py-0 h-4 w-fit">
                                {vd!.accidentCount} accident{vd!.accidentCount! > 1 ? "s" : ""}
                              </Badge>
                            )}
                            {vd?.isSalvage && (
                              <Badge variant="outline" className="text-[10px] py-0 h-4 w-fit border-orange-400 text-orange-600">
                                Salvage
                              </Badge>
                            )}
                            {!vd && <span className="text-xs text-muted-foreground">—</span>}
                          </div>
                        </td>
                        <td className="p-4 text-muted-foreground text-xs whitespace-nowrap">
                          {new Date(lookup.createdAt).toLocaleString()}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => refreshVin.mutate({ id: lookup.id })}
                              disabled={refreshVin.isPending}
                            >
                              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                              Refresh
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDelete(lookup.id)}
                              disabled={deletingId === lookup.id}
                              title="Delete record from database"
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
            </>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}

      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk Delete VIN Lookups</DialogTitle>
            <DialogDescription>
              Choose a category to delete. Active table filters (except VIN search) apply as additional conditions.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-1">
            <div className="space-y-3">
              <p className="text-sm font-medium">Delete category</p>
              <RadioGroup
                value={dialogCategory}
                onValueChange={(v) => setDialogCategory(v as DialogCategory)}
                className="gap-3"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="errors" id="cat-errors" />
                  <Label htmlFor="cat-errors" className="cursor-pointer">All errors</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="pending" id="cat-pending" />
                  <Label htmlFor="cat-pending" className="cursor-pointer">All pending</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="cache" id="cat-cache" />
                  <Label htmlFor="cat-cache" className="cursor-pointer">All from cache</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="provider" id="cat-provider" />
                  <Label htmlFor="cat-provider" className="cursor-pointer">By provider</Label>
                </div>
              </RadioGroup>

              {dialogCategory === "provider" && (
                <div className="pl-6">
                  <Select
                    value={dialogProvider || "none"}
                    onValueChange={(v) => setDialogProvider(v === "none" ? "" : v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select provider…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" disabled>Select a provider</SelectItem>
                      {allProviders.map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {(statusFilter || fromCacheFilter !== "" || providerFilter) && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Additional active filters</p>
                <div className="flex flex-wrap gap-1.5">
                  {statusFilter && (
                    <Badge variant="secondary" className="text-xs">Status: {statusFilter}</Badge>
                  )}
                  {fromCacheFilter === "true" && (
                    <Badge variant="secondary" className="text-xs">From cache only</Badge>
                  )}
                  {fromCacheFilter === "false" && (
                    <Badge variant="secondary" className="text-xs">Live fetches only</Badge>
                  )}
                  {providerFilter && (
                    <Badge variant="secondary" className="text-xs">Provider: {providerFilter}</Badge>
                  )}
                </div>
              </div>
            )}

            {search && (
              <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  VIN search (<span className="font-mono font-medium">{search}</span>) is not applied to bulk delete — it targets categories across all matching rows.
                </span>
              </div>
            )}

            {bulkDeleteReady && bulkDeleteSummary && (
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Will delete: </span>
                <span className="font-medium">{bulkDeleteSummary}</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkDialogOpen(false)}
              disabled={bulkDelete.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={!bulkDeleteReady || bulkDelete.isPending}
            >
              {bulkDelete.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
