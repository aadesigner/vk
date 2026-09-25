import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useAdminGetUsers, useAdminBanUser, useAdminUnbanUser, useAdminImportUsers,
  adminExportUsers,
  type UserImportResult,
  type ApiError,
  type AdminGetUsersChecks,
  type AdminGetUsersStatus,
  type AdminGetUsersHasPhone,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, Ban, CheckCircle2, Settings2, Download, Upload, X, AlertCircle, RefreshCw, AtSign } from "lucide-react";
import { Link } from "wouter";
import { adminUsersQuery } from "@/lib/admin-query-options";
import { AdminQueryFallback } from "@/components/admin-query-fallback";
import { queryErrorMessage, showFatalQueryError } from "@/lib/query-error";
import { useQueryRecovery } from "@/hooks/use-query-recovery";
import { userCountryLabel } from "@/lib/user-countries";
import { UserCountrySelect } from "@/components/user-country-select";
import { FlagImg } from "@/components/flag-img";
import { formatPhoneDisplay } from "@/lib/user-phone";
import { AdminUserQuickEdit } from "@/components/admin/admin-user-quick-edit";

function userHasPhone(user: { phonePrefix?: string | null; phoneNational?: string | null }) {
  return Boolean(user.phonePrefix?.trim() && user.phoneNational?.trim());
}

const COUNTRY_UNSET = "unset";
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type EmailDomainRow = { domain: string; count: number };

export default function AdminUsers() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | AdminGetUsersStatus>("");
  const [checksFilter, setChecksFilter] = useState<"" | AdminGetUsersChecks>("");
  const [countryFilter, setCountryFilter] = useState("");
  const [hasPhoneFilter, setHasPhoneFilter] = useState<"" | AdminGetUsersHasPhone>("");
  const [emailDomainFilter, setEmailDomainFilter] = useState("");
  const [page, setPage] = useState(1);
  const [importResult, setImportResult] = useState<UserImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const limit = 20;

  const listParams = {
    page,
    limit,
    search: search || undefined,
    status: statusFilter || undefined,
    checks: checksFilter || undefined,
    country: countryFilter || undefined,
    hasPhone: hasPhoneFilter || undefined,
    emailDomain: emailDomainFilter || undefined,
  };

  const { data, isLoading, isError, error, refetch, isFetching } = useAdminGetUsers(listParams, {
    query: adminUsersQuery(),
  });

  const { data: emailDomainsData } = useQuery({
    queryKey: ["admin", "users", "email-domains"],
    queryFn: async (): Promise<EmailDomainRow[]> => {
      const res = await fetch(`${basePath}/api/admin/users/email-domains`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load email domains");
      const json = await res.json() as { domains?: EmailDomainRow[] };
      return Array.isArray(json.domains) ? json.domains : [];
    },
    staleTime: 60_000,
  });
  const emailDomains = emailDomainsData ?? [];

  const banUser = useAdminBanUser({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] }) },
  });
  const unbanUser = useAdminUnbanUser({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] }) },
  });
  const importUsers = useAdminImportUsers({
    mutation: {
      onSuccess: (result) => {
        setImportResult(result);
        queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
        queryClient.invalidateQueries({ queryKey: ["admin", "users", "email-domains"] });
      },
      onError: (err: unknown) => {
        const apiErr = err as ApiError<{ error?: string }>;
        setImportError(apiErr?.data?.error ?? apiErr.message ?? "Import failed");
      },
    },
  });

  const users = data?.items ?? [];
  const totalPages = data ? Math.ceil(data.total / limit) : 1;
  const hasActiveFilters = Boolean(search) || Boolean(statusFilter) || Boolean(checksFilter)
    || Boolean(countryFilter) || Boolean(hasPhoneFilter) || Boolean(emailDomainFilter);
  useQueryRecovery(isError, isFetching, refetch);
  const loadError = showFatalQueryError(isError, isFetching, !!data)
    ? queryErrorMessage(error, "Failed to load users")
    : null;

  const countryFilterLabel =
    countryFilter === COUNTRY_UNSET
      ? "No country set"
      : userCountryLabel(countryFilter) ?? countryFilter;

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    try {
      const csv = await adminExportUsers({
        search: search || undefined,
        status: statusFilter || undefined,
        checks: checksFilter || undefined,
        country: countryFilter || undefined,
        hasPhone: hasPhoneFilter || undefined,
        emailDomain: emailDomainFilter || undefined,
      });
      const blob = new Blob([csv.startsWith("\uFEFF") ? csv : `\uFEFF${csv}`], {
        type: "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const parts = ["users"];
      if (emailDomainFilter) parts.push(emailDomainFilter.replace(/\./g, "-"));
      if (countryFilter && countryFilter !== COUNTRY_UNSET) parts.push(countryFilter.toLowerCase());
      if (countryFilter === COUNTRY_UNSET) parts.push("no-country");
      if (hasPhoneFilter === "yes") parts.push("has-phone");
      if (hasPhoneFilter === "no") parts.push("no-phone");
      if (checksFilter) parts.push(checksFilter);
      if (statusFilter) parts.push(statusFilter);
      a.download = `${parts.join("-")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const apiErr = err as ApiError<{ error?: string }>;
      setExportError(apiErr?.data?.error ?? apiErr.message ?? "Export failed");
    } finally {
      setExporting(false);
    }
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setImportResult(null);
    setImportError(null);
    importUsers.mutate({ data: { file } });
  }

  function clearFilters() {
    setSearch("");
    setStatusFilter("");
    setChecksFilter("");
    setCountryFilter("");
    setHasPhoneFilter("");
    setEmailDomainFilter("");
    setPage(1);
  }

  const statusColor: Record<string, string> = {
    inserted: "text-[#0369a1]",
    updated: "text-blue-700",
    skipped: "text-yellow-700",
    error: "text-red-700",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Users</h1>
          <p className="text-muted-foreground mt-1">{data?.total ?? 0} matching users</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
            <Download className="h-4 w-4 mr-1.5" />
            {exporting ? "Exporting…" : "Export CSV"}
          </Button>
          <Button
            variant="outline" size="sm"
            onClick={handleImportClick}
            disabled={importUsers.isPending}
          >
            <Upload className="h-4 w-4 mr-1.5" />
            {importUsers.isPending ? "Importing…" : "Import CSV"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-0 w-full sm:min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by email or name..."
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Select
          value={statusFilter || "all"}
          onValueChange={(v) => { setStatusFilter(v === "all" ? "" : v as AdminGetUsersStatus); setPage(1); }}
        >
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="banned">Banned</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={checksFilter || "all"}
          onValueChange={(v) => { setChecksFilter(v === "all" ? "" : v as AdminGetUsersChecks); setPage(1); }}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="VIN checks" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All users</SelectItem>
            <SelectItem value="checked">Has VIN checks</SelectItem>
            <SelectItem value="unchecked">No VIN checks</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={hasPhoneFilter || "all"}
          onValueChange={(v) => { setHasPhoneFilter(v === "all" ? "" : v as AdminGetUsersHasPhone); setPage(1); }}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Phone number" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Phone number: any</SelectItem>
            <SelectItem value="yes">Phone number: yes</SelectItem>
            <SelectItem value="no">Phone number: no</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={emailDomainFilter || "all"}
          onValueChange={(v) => { setEmailDomainFilter(v === "all" ? "" : v); setPage(1); }}
        >
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue placeholder="Email domain" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="all">All email domains</SelectItem>
            {emailDomains.map(({ domain, count }) => (
              <SelectItem key={domain} value={domain}>
                @{domain} ({count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <UserCountrySelect
          value={countryFilter}
          onValueChange={(v) => {
            setCountryFilter(v);
            setPage(1);
          }}
          allLabel="All countries"
          emptyLabel="No country set"
          emptyValue={COUNTRY_UNSET}
          className="w-full sm:w-[240px]"
        />
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="shrink-0">
            <X className="h-4 w-4 mr-1" />
            Clear filters
          </Button>
        )}
      </div>

      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          {search && <Badge variant="secondary">Search: {search}</Badge>}
          {statusFilter && <Badge variant="secondary">Status: {statusFilter}</Badge>}
          {checksFilter && (
            <Badge variant="secondary">
              {checksFilter === "checked" ? "Has VIN checks" : "No VIN checks"}
            </Badge>
          )}
          {hasPhoneFilter && (
            <Badge variant="secondary">
              Phone number: {hasPhoneFilter === "yes" ? "yes" : "no"}
            </Badge>
          )}
          {emailDomainFilter && (
            <Badge variant="secondary" className="inline-flex items-center gap-1">
              <AtSign className="h-3 w-3" />
              {emailDomainFilter}
            </Badge>
          )}
          {countryFilter && (
            <Badge variant="secondary" className="inline-flex items-center gap-1.5">
              <span>Country / Nationality:</span>
              <span>{countryFilterLabel}</span>
            </Badge>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground -mt-2">
        Filters combine (AND). Export CSV uses the same filters — e.g. one email domain, or country + has phone.
        Import needs an <span className="font-mono">email</span> column (optional{" "}
        <span className="font-mono">name</span>, <span className="font-mono">phone_prefix</span>,{" "}
        <span className="font-mono">phone_national</span>).
      </p>

      <Card>
        <CardContent className="p-0">
          {loadError ? (
            <div className="py-12 px-6 text-center space-y-3">
              <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
              <p className="font-medium text-destructive">{loadError}</p>
              <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
                <RefreshCw className={`h-4 w-4 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
                Retry
              </Button>
            </div>
          ) : isLoading && !data ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : users.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">No users found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr>
                    <th className="text-left p-4 font-medium text-muted-foreground">Email</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Country</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Phone number</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Checks</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Joined</th>
                    <th className="text-right p-4 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-4">
                        <AdminUserQuickEdit user={user} />
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {user.countryCode ? (
                          <span className="inline-flex items-center gap-1.5">
                            <FlagImg code={user.countryCode.toLowerCase()} size={14} className="rounded-[2px]" />
                            <span>{userCountryLabel(user.countryCode)}</span>
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {userHasPhone(user) ? (
                          <div>
                            <Badge variant="secondary" className="bg-[#ccebfe] text-[#075985] border-0">Yes</Badge>
                            <p className="text-xs mt-1 font-mono">
                              {formatPhoneDisplay(user.phonePrefix, user.phoneNational)}
                            </p>
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">No</Badge>
                        )}
                      </td>
                      <td className="p-4">
                        {user.isAdmin ? (
                          <Badge variant="secondary" className="bg-primary/10 text-primary border-0">Admin</Badge>
                        ) : (
                          <Badge variant={user.isBanned ? "destructive" : "default"} className={!user.isBanned ? "bg-[#ccebfe] text-[#075985] border-0" : ""}>
                            {user.isBanned ? "Banned" : "Active"}
                          </Badge>
                        )}
                      </td>
                      <td className="p-4 text-muted-foreground">{user.totalChecks ?? 0}</td>
                      <td className="p-4 text-muted-foreground">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link href={`/adminx/users/${user.id}`}>
                            <Button size="sm" variant="outline">
                              <Settings2 className="h-3.5 w-3.5 mr-1.5" />
                              Manage
                            </Button>
                          </Link>
                          {!user.isAdmin && (
                            user.isBanned ? (
                              <Button
                                size="sm" variant="outline"
                                onClick={() => unbanUser.mutate({ userId: user.id })}
                                disabled={unbanUser.isPending}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                                Unban
                              </Button>
                            ) : (
                              <Button
                                size="sm" variant="destructive"
                                onClick={() => banUser.mutate({ userId: user.id, data: { reason: "Admin action" } })}
                                disabled={banUser.isPending}
                              >
                                <Ban className="h-3.5 w-3.5 mr-1.5" />
                                Ban
                              </Button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}


      {exportError && (
        <div className="fixed bottom-4 right-4 z-50 flex items-start gap-3 bg-destructive text-destructive-foreground rounded-lg px-4 py-3 shadow-lg max-w-sm">
          <p className="text-sm flex-1">{exportError}</p>
          <button type="button" onClick={() => setExportError(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      {importError && (
        <div className="fixed bottom-4 right-4 z-50 flex items-start gap-3 bg-destructive text-destructive-foreground rounded-lg px-4 py-3 shadow-lg max-w-sm">
          <p className="text-sm flex-1">{importError}</p>
          <button type="button" onClick={() => setImportError(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      <Dialog open={importResult !== null} onOpenChange={(open) => { if (!open) setImportResult(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Import Results</DialogTitle>
          </DialogHeader>
          {importResult && (
            <>
              <div className="flex gap-6 py-2 text-sm flex-wrap">
                <span className="text-[#0369a1] font-medium">✓ {importResult.inserted} inserted</span>
                <span className="text-blue-700 font-medium">↻ {importResult.updated} updated</span>
                <span className="text-yellow-700 font-medium">⏭ {importResult.skipped} skipped</span>
                {importResult.errors > 0 && (
                  <span className="text-red-700 font-medium">✗ {importResult.errors} errors</span>
                )}
                <span className="text-muted-foreground ml-auto">{importResult.total} total rows</span>
              </div>
              <div className="overflow-auto flex-1 border rounded-md">
                <table className="w-full text-sm">
                  <thead className="border-b sticky top-0 bg-background">
                    <tr>
                      <th className="text-left p-3 font-medium text-muted-foreground w-12">#</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Email</th>
                      <th className="text-left p-3 font-medium text-muted-foreground w-24">Status</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importResult.rows.map((row) => (
                      <tr key={row.row} className="border-b last:border-0">
                        <td className="p-3 text-muted-foreground">{row.row}</td>
                        <td className="p-3 font-mono text-xs">{row.email}</td>
                        <td className={`p-3 font-medium capitalize ${statusColor[row.status] ?? ""}`}>{row.status}</td>
                        <td className="p-3 text-muted-foreground text-xs">{row.reason ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
