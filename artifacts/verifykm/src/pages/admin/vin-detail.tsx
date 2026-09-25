import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateVinReportCaches } from "@/lib/vin-report-cache";
import {
  useAdminGetVinCatalogByVin,
  useAdminUpdateVinCatalogByVin,
  useAdminAssignVinCatalogToUser,
  useAdminRefreshVinCatalog,
  useAdminGetUsers,
  getAdminGetVinCatalogByVinQueryKey,
  getAdminGetUsersQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, UserPlus, AlertTriangle, CheckCircle2,
  Search, Gauge, Users, ShieldCheck, ShieldAlert, Loader2, UserMinus, RefreshCw,
} from "lucide-react";
import { AdminVinSaveBar } from "@/components/admin/admin-vin-save-bar";
import {
  EMPTY_VIN_CATALOG_FORM,
  VinCatalogDataForm,
  vinCatalogFormFromData,
  vinCatalogPayloadFromForm,
  type VinCatalogData,
  type VinCatalogDataFormHandle,
  type VinCatalogFormState,
} from "@/components/admin/vin-catalog-data-form";

interface UserRow {
  id: string; email: string; name: string | null;
}

export default function AdminVinDetail({ params }: { params: { vin: string } }) {
  const vin = params.vin.toUpperCase();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  const [assignedPage, setAssignedPage] = useState(1);
  const { data: detail, isLoading, error: fetchError } = useAdminGetVinCatalogByVin(vin, { assignedPage });

  const [form, setForm] = useState<VinCatalogFormState>(EMPTY_VIN_CATALOG_FORM);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [refreshMsg, setRefreshMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [userSearch, setUserSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [assignMsg, setAssignMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const lastHydratedAtRef = useRef<string | null>(null);
  const formRef = useRef<VinCatalogDataFormHandle>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(userSearch), 300);
    return () => clearTimeout(t);
  }, [userSearch]);

  const searchActive = debouncedSearch.length >= 2;
  const searchParams = searchActive ? { search: debouncedSearch, limit: 8 } : undefined;
  const { data: userSearchResult, isFetching: userSearching } = useAdminGetUsers(
    searchParams,
    { query: { enabled: searchActive, queryKey: getAdminGetUsersQueryKey(searchParams) } }
  );
  const userResults = (userSearchResult?.items ?? []) as UserRow[];

  const refreshSourceLabel =
    detail?.providerName === "getcarapi"
    || (detail?.data as Record<string, unknown> | undefined)?.dataSource === "getcarapi"
      ? "GetCarAPI"
      : "Carstat";

  const refreshMutation = useAdminRefreshVinCatalog({
    mutation: {
      onSuccess: (result) => {
        const payload = result as {
          ok?: boolean;
          vin?: string;
          updatedAt?: string;
          refreshedFrom?: string;
          providerName?: string;
          data?: VinCatalogData;
          ownerHistoryLen?: number;
        };
        const fromLabel =
          payload.refreshedFrom === "getcarapi"
            ? "GetCarAPI"
            : payload.refreshedFrom === "carstat"
              ? "Carstat"
              : refreshSourceLabel;
        const ownerLen = typeof payload.ownerHistoryLen === "number"
          ? payload.ownerHistoryLen
          : (Array.isArray(payload.data?.ownerHistory) ? payload.data.ownerHistory.length : 0);
        const ownerCount = typeof payload.data?.ownerCount === "number" ? payload.data.ownerCount : null;
        const isGetCarApi = fromLabel === "GetCarAPI";
        if (ownerLen <= 0 && !isGetCarApi) {
          setRefreshMsg({
            ok: false,
            text: ownerCount && ownerCount > 0
              ? `Refreshed, but owner timeline is empty (provider ownerCount=${ownerCount}). Do not Save — owners were not extracted.`
              : "Refreshed, but 0 owner records were extracted. Do not Save until owners look correct.",
          });
        } else {
          setRefreshMsg({
            ok: true,
            text: ownerLen > 0
              ? `Refreshed from ${fromLabel} — ${ownerLen} owner record(s) saved. Catalog and lookups updated.`
              : `Refreshed from ${fromLabel}. Catalog and lookups updated.`,
          });
        }
        if (payload.data) {
          setForm(vinCatalogFormFromData(payload.data));
          lastHydratedAtRef.current = payload.updatedAt ?? new Date().toISOString();
          queryClient.setQueryData(
            getAdminGetVinCatalogByVinQueryKey(vin, { assignedPage }),
            (prev) => ({
              ...(prev ?? {}),
              data: payload.data,
              ...(payload.providerName ? { providerName: payload.providerName } : {}),
              ...(payload.updatedAt ? { updatedAt: payload.updatedAt } : {}),
            }),
          );
        }
        queryClient.invalidateQueries({ queryKey: getAdminGetVinCatalogByVinQueryKey(vin) });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/vin-catalog"] });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/vin"] });
        invalidateVinReportCaches(queryClient, vin);
      },
      onError: (err: unknown) => {
        const msg =
          (err as { data?: { error?: string } })?.data?.error ??
          (err as { message?: string })?.message ??
          "Refresh failed";
        setRefreshMsg({ ok: false, text: msg });
      },
    },
  });

  const updateMutation = useAdminUpdateVinCatalogByVin({
    mutation: {
      onSuccess: (updated) => {
        setSaveMsg({
          ok: true,
          text: "Saved — catalog and all VIN reports updated.",
        });
        if (updated?.data) {
          setForm(vinCatalogFormFromData((updated.data ?? {}) as VinCatalogData));
        }
        if (updated?.updatedAt) {
          lastHydratedAtRef.current = String(updated.updatedAt);
        }
        if (updated) {
          queryClient.setQueryData(
            getAdminGetVinCatalogByVinQueryKey(vin, { assignedPage }),
            (prev) => ({ ...(prev ?? {}), ...updated }),
          );
        }
        void queryClient.invalidateQueries({ queryKey: ["/api/admin/vin-catalog"] });
        void queryClient.invalidateQueries({ queryKey: ["/api/admin/vin"] });
        invalidateVinReportCaches(queryClient, vin);
      },
      onError: () => {
        setSaveMsg({ ok: false, text: "Save failed" });
      },
    },
  });

  useEffect(() => {
    lastHydratedAtRef.current = null;
  }, [vin]);

  useEffect(() => {
    if (!detail || updateMutation.isPending) return;
    const serverAt = detail.updatedAt;
    if (typeof serverAt !== "string") return;
    if (lastHydratedAtRef.current != null && serverAt <= lastHydratedAtRef.current) return;
    lastHydratedAtRef.current = serverAt;
    setForm(vinCatalogFormFromData((detail.data ?? {}) as VinCatalogData));
  }, [detail?.data, detail?.updatedAt, updateMutation.isPending]);

  const handleSave = () => {
    setSaveMsg(null);
    const photos = formRef.current?.flushPendingPhotos() ?? form.photos;
    updateMutation.mutate({
      vin,
      data: vinCatalogPayloadFromForm({ ...form, photos }) as Parameters<typeof updateMutation.mutate>[0]["data"],
    });
  };

  const [revoking, setRevoking] = useState<number | null>(null);

  const handleRevoke = async (userId: string, lookupId: number, email: string | null) => {
    if (!confirm(`Revoke access to this VIN for ${email ?? userId}?`)) return;
    setRevoking(lookupId);
    try {
      const res = await fetch(`${basePath}/api/admin/users/${encodeURIComponent(userId)}/lookups/${lookupId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert((body as { error?: string }).error ?? "Revoke failed");
        return;
      }
      queryClient.invalidateQueries({ queryKey: getAdminGetVinCatalogByVinQueryKey(vin) });
    } catch {
      alert("Revoke failed — network error");
    } finally {
      setRevoking(null);
    }
  };

  const assignMutation = useAdminAssignVinCatalogToUser({
    mutation: {
      onSuccess: () => {
        setAssignMsg({ ok: true, text: `Report assigned to ${selectedUser?.email}` });
        setSelectedUser(null); setUserSearch(""); setDebouncedSearch("");
        queryClient.invalidateQueries({ queryKey: getAdminGetVinCatalogByVinQueryKey(vin) });
      },
      onError: () => {
        setAssignMsg({ ok: false, text: "Assignment failed" });
      },
    },
  });

  const handleAssign = () => {
    if (!selectedUser) return;
    setAssignMsg(null);
    assignMutation.mutate({ vin, data: { userId: selectedUser.id } });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (fetchError || !detail) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <AlertTriangle className="h-10 w-10 text-destructive/60" />
        <p className="text-muted-foreground">VIN not found in catalog</p>
        <Button variant="outline" onClick={() => setLocation("/adminx/vin-catalog")}>
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Catalog
        </Button>
      </div>
    );
  }

  const data = (detail.data ?? {}) as VinCatalogData;
  const vehicle = [data.year, data.make, data.model].filter(Boolean).join(" ") || "Unknown Vehicle";
  const hasAccidents = (data.accidentCount ?? 0) > 0;
  const assignedUsers = (detail.assignedUsers ?? []) as Array<{
    id: number; user_id: string; created_at: string; email: string | null; name: string | null;
  }>;

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-col gap-4">
        <Link href="/adminx/vin-catalog">
          <Button variant="ghost" size="sm" className="gap-1.5 -ml-2 w-fit">
            <ArrowLeft className="h-4 w-4" /> Catalog
          </Button>
        </Link>
        <div className="flex flex-col lg:flex-row lg:items-start gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold break-words">{vehicle}</h1>
            <p className="font-mono text-sm text-muted-foreground mt-0.5 break-all">{vin}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {data.isSalvage && <Badge variant="outline" className="border-orange-400 text-orange-600">Salvage</Badge>}
            {data.isTaxi && <Badge variant="outline" className="border-amber-400 text-amber-700">Taxi</Badge>}
            {hasAccidents && <Badge variant="destructive">{data.accidentCount} accident{(data.accidentCount ?? 0) > 1 ? "s" : ""}</Badge>}
            {!hasAccidents && !data.isSalvage && <Badge variant="outline" className="border-[#00a5fd] text-[#0088d4]"><ShieldCheck className="h-3 w-3 mr-1" />Clean</Badge>}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 w-full sm:w-auto"
              disabled={refreshMutation.isPending}
              onClick={() => { setRefreshMsg(null); refreshMutation.mutate({ vin }); }}
            >
              {refreshMutation.isPending
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <RefreshCw className="h-3.5 w-3.5" />}
              {refreshMutation.isPending ? "Refreshing…" : `Refresh from ${refreshSourceLabel}`}
            </Button>
          </div>
        </div>
      </div>
      {refreshMsg && (
        <div className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm ${refreshMsg.ok ? "border-[#b3e3fe] bg-[#e6f6ff] text-[#0369a1]" : "border-destructive/20 bg-destructive/5 text-destructive"}`}>
          {refreshMsg.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
          {refreshMsg.text}
          <button className="ml-auto text-xs opacity-60 hover:opacity-100" onClick={() => setRefreshMsg(null)}>✕</button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border bg-background p-4 text-center">
          <div className="text-2xl font-bold">{detail.lookupCount ?? 0}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Total Lookups</div>
        </div>
        <div className="rounded-xl border bg-background p-4 text-center">
          <div className="text-2xl font-bold">{detail.assignedTotal ?? assignedUsers.length}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Assigned Users</div>
        </div>
        <div className="rounded-xl border bg-background p-4 text-center">
          <div className="text-2xl font-bold text-sm font-mono">{detail.providerName ?? "—"}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Provider</div>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Gauge className="h-4 w-4" />Edit Data
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Changes save to the catalog and sync to every user report for this VIN. The public VIN page refreshes on the next load.
          </p>
        </CardHeader>
        <CardContent className="space-y-0 pb-0">
          <VinCatalogDataForm
            ref={formRef}
            form={form}
            onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
          />

          <AdminVinSaveBar
            onSave={handleSave}
            saving={updateMutation.isPending}
            saveMsg={saveMsg}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="h-4 w-4" />Assign Report to User
          </CardTitle>
          <p className="text-xs text-muted-foreground">Grants the user access to this VIN report without a payment.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                ref={searchRef} type="text"
                className="w-full rounded-lg border bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Search by email or name…"
                value={userSearch}
                onChange={e => { setUserSearch(e.target.value); setSelectedUser(null); }}
              />
              {userSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            </div>
            <Button onClick={handleAssign} disabled={!selectedUser || assignMutation.isPending} className="gap-1.5 shrink-0">
              {assignMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Assign
            </Button>
          </div>

          {userResults.length > 0 && !selectedUser && (
            <div className="border rounded-xl overflow-hidden">
              {userResults.map(u => (
                <button
                  key={u.id}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted transition-colors border-b last:border-0"
                  onClick={() => { setSelectedUser(u); setUserSearch(u.email); setDebouncedSearch(""); }}
                >
                  <div className="h-7 w-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                    {(u.name ?? u.email)[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    {u.name && <div className="text-sm font-medium truncate">{u.name}</div>}
                    <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {selectedUser && (
            <div className="flex items-center gap-3 px-4 py-2.5 bg-primary/5 border border-primary/20 rounded-xl">
              <div className="h-7 w-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                {(selectedUser.name ?? selectedUser.email)[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                {selectedUser.name && <div className="text-sm font-medium">{selectedUser.name}</div>}
                <div className="text-xs text-muted-foreground">{selectedUser.email}</div>
              </div>
              <button className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => { setSelectedUser(null); setUserSearch(""); }}>Clear</button>
            </div>
          )}

          {assignMsg && (
            <p className={`text-sm flex items-center gap-1.5 ${assignMsg.ok ? "text-[#0088d4]" : "text-destructive"}`}>
              {assignMsg.ok ? <CheckCircle2 className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
              {assignMsg.text}
            </p>
          )}
        </CardContent>
      </Card>

      {((detail.assignedTotal ?? 0) > 0 || assignedUsers.length > 0) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />Users with Access
              <Badge variant="secondary" className="ml-auto">{detail.assignedTotal ?? assignedUsers.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {assignedUsers.map(u => (
                <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="h-7 w-7 rounded-full bg-muted text-muted-foreground text-xs font-bold flex items-center justify-center shrink-0">
                    {((u.name ?? u.email ?? "?")[0]).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    {u.name && <div className="text-sm font-medium truncate">{u.name}</div>}
                    <div className="text-xs text-muted-foreground truncate">{u.email ?? u.user_id}</div>
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(u.created_at).toLocaleDateString()}
                  </div>
                  {u.user_id && (
                    <Link href={`/adminx/users/${u.user_id}`}>
                      <Button size="sm" variant="ghost" className="h-7 text-xs">View User</Button>
                    </Link>
                  )}
                  <Button
                    size="sm" variant="ghost"
                    className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                    disabled={revoking === u.id}
                    onClick={() => handleRevoke(u.user_id, u.id, u.email)}
                  >
                    {revoking === u.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <UserMinus className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              ))}
            </div>
            {(detail.assignedTotal ?? 0) > 50 && (
              <div className="flex items-center justify-between px-4 py-3 border-t text-sm">
                <span className="text-xs text-muted-foreground">
                  Page {assignedPage} of {Math.ceil((detail.assignedTotal ?? 0) / 50)}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm" variant="outline" className="h-7 px-2 text-xs"
                    disabled={assignedPage <= 1}
                    onClick={() => setAssignedPage(p => p - 1)}
                  >Prev</Button>
                  <Button
                    size="sm" variant="outline" className="h-7 px-2 text-xs"
                    disabled={assignedPage >= Math.ceil((detail.assignedTotal ?? 0) / 50)}
                    onClick={() => setAssignedPage(p => p + 1)}
                  >Next</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground pb-4">
        ID #{detail.id} · Imported {new Date(detail.importedAt!).toLocaleString()} · Updated {new Date(detail.updatedAt!).toLocaleString()}
      </p>
    </div>
  );
}
