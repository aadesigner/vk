import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useAdminBanUser,
  useAdminUnbanUser,
  useAdminDeleteUser,
  useAdminGetUser,
  useAdminAdjustUserCredits,
  useAdminGetUserCreditPurchases,
  getAdminGetUserQueryKey,
  getAdminGetUserCreditPurchasesQueryKey,
} from "@workspace/api-client-react";
import type { ApiError } from "@workspace/api-client-react";
import { invalidateVinReportCaches } from "@/lib/vin-report-cache";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, Mail, Calendar, Clock, Key, Gift,
  Ban, CheckCircle2, Loader2, Save, Car,
  ShieldOff, AlertTriangle, ImageOff, ChevronLeft, ChevronRight, Trash2,
  DollarSign, Search, Globe, Phone, Coins, ReceiptText, Megaphone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserCountrySelect } from "@/components/user-country-select";
import { UserPhoneFields } from "@/components/user-phone-fields";
import { formatPhoneDisplay } from "@/lib/user-phone";
import { useAuth } from "@/lib/auth-context";
import { ADMIN_QUERY_OPTIONS, ADMIN_USER_DETAIL_QUERY, adminUserDetailQuery } from "@/lib/admin-query-options";
import { ACQUISITION_BUCKET_LABELS, type AcquisitionBucket } from "@/lib/admin-dashboard-stats";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function formatLastActive(iso: string): string {
  const at = new Date(iso);
  const secs = Math.max(0, Math.round((Date.now() - at.getTime()) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return at.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isOnlineNow(iso: string | null | undefined): boolean {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() < 5 * 60 * 1000;
}

export interface UserRow {
  id: string;
  email: string;
  name: string | null;
  isBanned: boolean;
  isAdmin: boolean;
  countryCode?: string | null;
  phonePrefix?: string | null;
  phoneNational?: string | null;
  lastLoginAt: string | null;
  lastLoginIp?: string | null;
  lastSeenAt?: string | null;
  signupIp?: string | null;
  createdAt: string;
  totalChecks?: number;
  totalSpent?: number;
  creditBalance?: number;
  acquisitionBucket?: string | null;
  acquisitionChannel?: string | null;
  acquisitionSource?: string | null;
  acquisitionMedium?: string | null;
  acquisitionCampaign?: string | null;
  acquisitionClickId?: string | null;
  acquisitionReferrer?: string | null;
  acquisitionCapturedAt?: string | null;
}

interface VinData {
  make?: string;
  model?: string;
  year?: number;
  odometer?: number;
  accidentCount?: number;
  isSalvage?: boolean;
  photos?: string[];
}

interface VinLookup {
  id: number;
  vin: string;
  status: string;
  providerName: string | null;
  createdAt: string;
  data?: VinData | null;
}

interface Msg { ok: boolean; text: string }

type UserPaymentRow = {
  id: number;
  vin?: string | null;
  amount: number;
  currency: string;
  status: string;
  kind?: string | null;
  credits?: number | null;
  couponCode?: string | null;
  paypalOrderId?: string | null;
  pokOrderId?: string | null;
  providerOrderId?: string | null;
  createdAt: string;
};

type UserPaymentsPage = {
  items: UserPaymentRow[];
  total: number;
  page: number;
  limit: number;
};

function kindLabel(kind: string | null | undefined): string {
  switch (kind) {
    case "credit_pack": return "Credit pack";
    case "credit_redemption": return "Credit redeem";
    case "vin_report": return "VIN report";
    default: return kind || "Payment";
  }
}

function VinPhoto({ photos }: { photos?: string[] }) {
  const [err, setErr] = useState(false);
  const url = photos?.[0];
  if (!url || err) {
    return (
      <div className="h-12 w-16 md:h-14 md:w-[4.5rem] rounded-lg bg-muted/80 flex items-center justify-center shrink-0 ring-1 ring-border/40">
        <ImageOff className="h-4 w-4 text-muted-foreground/40" />
      </div>
    );
  }
  return (
    <img
      src={url}
      alt="vehicle"
      className="h-12 w-16 md:h-14 md:w-[4.5rem] rounded-lg object-cover shrink-0 ring-1 ring-border/40"
      onError={() => setErr(true)}
    />
  );
}

function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-lg md:rounded-xl border border-border/50 bg-card shadow-sm", className)}>
      {children}
    </div>
  );
}

function SectionLabel({
  icon: Icon,
  title,
  hint,
}: {
  icon: React.ElementType;
  title: string;
  hint?: string;
}) {
  return (
    <div className="px-3.5 pt-3.5 pb-2.5 md:px-4 md:pt-4 md:pb-3 border-b border-border/40">
      <h2 className="text-sm md:text-base font-semibold flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary shrink-0" />
        {title}
      </h2>
      {hint && <p className="text-[11px] md:text-xs text-muted-foreground mt-1.5 leading-relaxed">{hint}</p>}
    </div>
  );
}

function userInitials(user: { name?: string | null; email: string }): string {
  const source = user.name?.trim() || user.email.trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function StatusMessage({ msg }: { msg: Msg }) {
  return (
    <p className={cn("text-xs font-medium", msg.ok ? "text-primary" : "text-destructive")}>
      {msg.text}
    </p>
  );
}

export default function AdminUserDetail({ params }: { params: { userId: string } }) {
  const userId = params.userId;
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { user: authUser, refreshUser } = useAuth();

  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editCountry, setEditCountry] = useState("");
  const [editPhonePrefix, setEditPhonePrefix] = useState("+355");
  const [editPhoneNational, setEditPhoneNational] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [grantVin, setGrantVin] = useState("");
  const [lookups, setLookups] = useState<VinLookup[]>([]);
  const [lookupsLoading, setLookupsLoading] = useState(false);
  const [lookupsTotal, setLookupsTotal] = useState(0);
  const [lookupsPage, setLookupsPage] = useState(1);
  const LOOKUPS_LIMIT = 5;
  const [savingDetails, setSavingDetails] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [granting, setGranting] = useState(false);
  const [revokingId, setRevokingId] = useState<number | null>(null);
  const [detailsMsg, setDetailsMsg] = useState<Msg | null>(null);
  const [passwordMsg, setPasswordMsg] = useState<Msg | null>(null);
  const [grantMsg, setGrantMsg] = useState<Msg | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [creditBalanceEdit, setCreditBalanceEdit] = useState("0");
  const [creditMsg, setCreditMsg] = useState<Msg | null>(null);

  const {
    data: user,
    isLoading: userLoading,
    isError: userLoadFailed,
    error: userLoadError,
    refetch: refetchUser,
  } = useAdminGetUser(userId, { query: adminUserDetailQuery() });

  const {
    data: creditPurchases,
    refetch: refetchCreditPurchases,
  } = useAdminGetUserCreditPurchases(userId, { page: 1, limit: 20 }, { query: adminUserDetailQuery() });

  const {
    data: userTransactions,
    refetch: refetchUserTransactions,
  } = useQuery<UserPaymentsPage>({
    ...ADMIN_QUERY_OPTIONS,
    ...ADMIN_USER_DETAIL_QUERY,
    queryKey: ["/api/admin/users", userId, "transactions"],
    queryFn: async () => {
      const r = await fetch(
        `${basePath}/api/admin/users/${encodeURIComponent(userId)}/transactions?page=1&limit=30`,
        { credentials: "include" },
      );
      if (!r.ok) throw new Error("Failed to load transactions");
      return r.json();
    },
    enabled: !!userId,
  });

  const userError = userLoadFailed
    ? ((userLoadError as ApiError<{ error?: string }>)?.data?.error
      ?? (userLoadError as Error)?.message
      ?? "Failed to load user")
    : null;

  const invalidateUsers = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    queryClient.invalidateQueries({ queryKey: getAdminGetUserQueryKey(userId) });
    queryClient.invalidateQueries({ queryKey: getAdminGetUserCreditPurchasesQueryKey(userId) });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/transactions"] });
  };

  const banUser = useAdminBanUser({ mutation: { onSuccess: invalidateUsers } });
  const unbanUser = useAdminUnbanUser({ mutation: { onSuccess: invalidateUsers } });
  const adjustCredits = useAdminAdjustUserCredits({
    mutation: {
      onSuccess: () => {
        invalidateUsers();
        void refetchUser();
        void refetchCreditPurchases();
        void refetchUserTransactions();
        // Same browser session as the edited user (e.g. admin editing self):
        // drop stale AuthContext / localStorage credit balance immediately.
        if (authUser?.id === userId) {
          void refreshUser();
        }
      },
    },
  });
  const deleteUser = useAdminDeleteUser({
    mutation: {
      onSuccess: () => {
        setDeleteOpen(false);
        invalidateUsers();
        setLocation("/adminx/users");
      },
      onError: (err: unknown) => {
        const apiErr = err as ApiError<{ error?: string }>;
        const msg = apiErr?.data?.error ?? (err as { message?: string })?.message ?? "Failed to delete user";
        setDeleteError(msg);
      },
    },
  });

  const loadHistory = (page: number) => {
    setLookupsLoading(true);
    fetch(`${basePath}/api/admin/users/${encodeURIComponent(userId)}/history?page=${page}&limit=${LOOKUPS_LIMIT}`, { credentials: "include" })
      .then(r => r.json())
      .then((d: { items?: VinLookup[]; total?: number }) => {
        setLookups(d.items ?? []);
        setLookupsTotal(d.total ?? 0);
      })
      .catch(() => setLookups([]))
      .finally(() => setLookupsLoading(false));
  };

  useEffect(() => {
    setNewPassword("");
    setGrantVin("");
    setDetailsMsg(null);
    setPasswordMsg(null);
    setGrantMsg(null);
    setDeleteOpen(false);
    setDeleteEmail("");
    setDeleteError(null);
    setCreditBalanceEdit("0");
    setCreditMsg(null);
    setLookupsPage(1);
  }, [userId]);

  useEffect(() => {
    if (!user) return;
    setEditName(user.name ?? "");
    setEditEmail(user.email);
    setEditCountry(user.countryCode ?? "");
    setEditPhonePrefix(user.phonePrefix || "+355");
    setEditPhoneNational(user.phoneNational ?? "");
    setCreditBalanceEdit(String(user.creditBalance ?? 0));
  }, [user?.id, user?.email, user?.name, user?.countryCode, user?.phonePrefix, user?.phoneNational, user?.creditBalance]);

  useEffect(() => {
    if (!user) return;
    loadHistory(lookupsPage);
  }, [user?.id, lookupsPage]);

  const totalPages = Math.ceil(lookupsTotal / LOOKUPS_LIMIT) || 1;
  const lookupPageNumbers = (() => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const start = Math.min(Math.max(1, lookupsPage - 2), totalPages - 4);
    return Array.from({ length: 5 }, (_, i) => start + i);
  })();
  const emailMatches = user ? deleteEmail.trim().toLowerCase() === user.email.toLowerCase() : false;

  const patch = async (body: Record<string, unknown>) => {
    const resp = await fetch(`${basePath}/api/admin/users/${encodeURIComponent(userId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    return resp.json() as Promise<UserRow & { error?: string }>;
  };

  const handleSaveDetails = async () => {
    setSavingDetails(true);
    setDetailsMsg(null);
    try {
      const data = await patch({
        name: editName || null,
        email: editEmail,
        countryCode: editCountry || null,
        phonePrefix: editPhoneNational ? editPhonePrefix : null,
        phoneNational: editPhoneNational || null,
      });
      if ("error" in data && data.error) { setDetailsMsg({ ok: false, text: data.error }); return; }
      setDetailsMsg({ ok: true, text: "Details updated" });
      invalidateUsers();
    } catch { setDetailsMsg({ ok: false, text: "Network error" }); }
    finally { setSavingDetails(false); }
  };

  const handleResetPassword = async () => {
    if (newPassword.length < 6) return;
    setSavingPassword(true);
    setPasswordMsg(null);
    try {
      const data = await patch({ password: newPassword });
      if ("error" in data && data.error) { setPasswordMsg({ ok: false, text: data.error }); return; }
      setNewPassword("");
      setPasswordMsg({ ok: true, text: "Password reset successfully" });
    } catch { setPasswordMsg({ ok: false, text: "Network error" }); }
    finally { setSavingPassword(false); }
  };

  const handleRevokeAccess = async (lookupId: number) => {
    if (!confirm("Revoke this user's access to the VIN report?\n\nThe report data stays in the database — only this user's access is removed.")) return;
    setRevokingId(lookupId);
    try {
      await fetch(`${basePath}/api/admin/users/${encodeURIComponent(userId)}/lookups/${lookupId}`, {
        method: "DELETE", credentials: "include",
      });
      loadHistory(lookupsPage);
      invalidateUsers();
      void refetchUser();
    } catch { /* silent */ }
    finally { setRevokingId(null); }
  };

  const handleGrantAnalysis = async () => {
    const vin = grantVin.trim().toUpperCase();
    if (vin.length !== 17) return;
    setGranting(true);
    setGrantMsg(null);
    try {
      const resp = await fetch(`${basePath}/api/admin/users/${encodeURIComponent(userId)}/grant-analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ vin }),
      });
      let data: { error?: string; fromCache?: boolean; lookupId?: number } = {};
      try {
        data = await resp.json() as { error?: string; fromCache?: boolean; lookupId?: number };
      } catch {
        setGrantMsg({
          ok: false,
          text: resp.ok
            ? "Invalid response from server"
            : `Grant failed (HTTP ${resp.status}). Often a provider timeout — if the VIN is already in catalog, redeploy the local-first fix.`,
        });
        return;
      }
      if (resp.status === 409) {
        setGrantMsg({ ok: false, text: data.error ?? "User already has this report" });
        return;
      }
      if (!resp.ok) { setGrantMsg({ ok: false, text: data.error ?? `Failed to grant (HTTP ${resp.status})` }); return; }
      setGrantVin("");
      const source = data.fromCache ? "from local database" : "fetched from provider";
      setGrantMsg({ ok: true, text: `Report added to account (${source})` });
      loadHistory(1);
      setLookupsPage(1);
      invalidateUsers();
      invalidateVinReportCaches(queryClient, vin);
      void refetchUser();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setGrantMsg({
        ok: false,
        text: msg.includes("fetch") || msg.includes("network") || msg.includes("Failed to fetch")
          ? "Request failed or timed out (often waiting on Carstat). Local catalog grants should be instant after deploy."
          : (msg || "Request failed"),
      });
    }
    finally { setGranting(false); }
  };

  const handleDeleteUser = () => {
    if (!emailMatches) return;
    setDeleteError(null);
    deleteUser.mutate({
      userId,
      data: { confirmEmail: deleteEmail.trim() },
    });
  };

  const handleSaveCredits = () => {
    const next = parseInt(creditBalanceEdit, 10);
    if (!Number.isFinite(next) || next < 0) {
      setCreditMsg({ ok: false, text: "Enter a non-negative whole number" });
      return;
    }
    const current = user?.creditBalance ?? 0;
    if (next === current) {
      setCreditMsg({ ok: true, text: "No change" });
      return;
    }
    setCreditMsg(null);
    adjustCredits.mutate(
      {
        userId,
        // Send absolute balance (new API) and delta (compat with older API processes).
        data: { creditBalance: next, delta: next - current },
      },
      {
        onSuccess: (data) => {
          setCreditBalanceEdit(String(data.creditBalance ?? next));
          setCreditMsg({
            ok: true,
            text: `Credits set to ${data.creditBalance ?? next}`,
          });
        },
        onError: (err: unknown) => {
          const apiErr = err as ApiError<{ error?: string }>;
          setCreditMsg({
            ok: false,
            text: apiErr?.data?.error ?? (err as Error)?.message ?? "Failed to update credits",
          });
        },
      },
    );
  };

  if (userLoading) {
    return (
      <div className="space-y-4 md:space-y-5 max-w-5xl">
        <Skeleton className="h-24 w-full rounded-xl" />
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 md:gap-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <div className="grid lg:grid-cols-2 gap-3 md:gap-4">
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
        </div>
      </div>
    );
  }

  if (userError || !user) {
    return (
      <Panel className="flex flex-col items-center justify-center py-16 md:py-20 px-4 text-center max-w-lg mx-auto">
        <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
          <AlertTriangle className="h-6 w-6 text-destructive/70" />
        </div>
        <p className="text-sm md:text-base font-medium">{userError ?? "User not found"}</p>
        <p className="text-xs md:text-sm text-muted-foreground mt-1">This account may have been removed or the link is invalid.</p>
        <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
          <Button variant="outline" size="sm" onClick={() => void refetchUser()}>Retry</Button>
          <Button variant="outline" size="sm" onClick={() => setLocation("/adminx/users")}>
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Users
          </Button>
        </div>
      </Panel>
    );
  }

  return (
    <div className="space-y-4 md:space-y-5 lg:space-y-6 max-w-5xl min-w-0 w-full">
      <Panel className="overflow-hidden min-w-0">
        <div className="p-3.5 md:p-5 min-w-0">
          <Link href="/adminx/users">
            <Button variant="ghost" size="sm" className="gap-1.5 -ml-2 mb-3 h-8 px-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Users
            </Button>
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-start gap-4 min-w-0">
            <div className="h-14 w-14 md:h-16 md:w-16 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-lg md:text-xl font-bold ring-2 ring-primary/10">
              {userInitials(user)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate max-w-full">
                  {user.name || user.email}
                </h1>
                <Badge
                  variant={user.isBanned ? "destructive" : "default"}
                  className={cn(!user.isBanned && "bg-primary/10 text-primary border-primary/20 hover:bg-primary/10")}
                >
                  {user.isBanned ? "Banned" : "Active"}
                </Badge>
                {user.isAdmin && <Badge variant="secondary">Admin</Badge>}
              </div>
              {user.name && (
                <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5 truncate">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  {user.email}
                </p>
              )}
              {!user.name && (
                <p className="text-sm text-muted-foreground mt-1 font-mono truncate">{user.id}</p>
              )}
            </div>
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 md:gap-3">
        <Panel className="px-3.5 py-3 md:px-4 md:py-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px] md:text-xs text-muted-foreground uppercase tracking-wide">VIN checks</span>
            <Search className="h-3.5 w-3.5 text-primary/60" />
          </div>
          <p className="text-xl md:text-2xl font-bold tabular-nums">{user.totalChecks ?? 0}</p>
        </Panel>
        <Panel className="px-3.5 py-3 md:px-4 md:py-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px] md:text-xs text-muted-foreground uppercase tracking-wide">Total spent</span>
            <DollarSign className="h-3.5 w-3.5 text-primary/60" />
          </div>
          <p className="text-xl md:text-2xl font-bold tabular-nums">€{(user.totalSpent ?? 0).toFixed(2)}</p>
        </Panel>
        <Panel className="px-3.5 py-3 md:px-4 md:py-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px] md:text-xs text-muted-foreground uppercase tracking-wide">Credits</span>
            <Coins className="h-3.5 w-3.5 text-primary/60" />
          </div>
          <p className="text-xl md:text-2xl font-bold tabular-nums text-primary">{user.creditBalance ?? 0}</p>
        </Panel>
        <Panel className="px-3.5 py-3 md:px-4 md:py-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px] md:text-xs text-muted-foreground uppercase tracking-wide">Joined</span>
            <Calendar className="h-3.5 w-3.5 text-primary/60" />
          </div>
          <p className="text-sm md:text-base font-semibold tabular-nums">
            {new Date(user.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
          </p>
          <p className="text-[11px] text-muted-foreground font-mono mt-1 truncate" title={user.signupIp ?? undefined}>
            {user.signupIp || "IP unknown"}
          </p>
        </Panel>
        <Panel className="px-3.5 py-3 md:px-4 md:py-4 col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px] md:text-xs text-muted-foreground uppercase tracking-wide">Last active</span>
            <Clock className="h-3.5 w-3.5 text-primary/60" />
          </div>
          <p className="text-sm md:text-base font-semibold tabular-nums">
            {user.lastSeenAt
              ? formatLastActive(user.lastSeenAt)
              : user.lastLoginAt
                ? formatLastActive(user.lastLoginAt)
                : "Never"}
          </p>
          {isOnlineNow(user.lastSeenAt) && (
            <p className="text-[11px] font-medium text-[#0088d4] dark:text-[#00a5fd] mt-1">Online now</p>
          )}
          <p className="text-[11px] text-muted-foreground mt-1">
            Last sign-in:{" "}
            {user.lastLoginAt
              ? new Date(user.lastLoginAt).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
              : "Never"}
          </p>
          <p className="text-[11px] text-muted-foreground font-mono mt-1 truncate" title={user.lastLoginIp ?? undefined}>
            {user.lastLoginIp || (user.lastLoginAt ? "IP unknown" : "—")}
          </p>
        </Panel>
      </div>

      <Panel className="overflow-hidden">
        <div className="px-3.5 py-3 md:px-4 md:py-3.5 flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Megaphone className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Acquisition</p>
            {user.acquisitionBucket ? (
              <>
                <p className="text-sm font-semibold text-foreground">
                  {ACQUISITION_BUCKET_LABELS[(user.acquisitionBucket as AcquisitionBucket)]
                    ?? user.acquisitionBucket}
                  {user.acquisitionChannel ? (
                    <span className="font-normal text-muted-foreground"> · {user.acquisitionChannel}</span>
                  ) : null}
                </p>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  {user.acquisitionCampaign ? <span>Campaign: {user.acquisitionCampaign}</span> : null}
                  {user.acquisitionSource || user.acquisitionMedium ? (
                    <span>
                      UTM: {[user.acquisitionSource, user.acquisitionMedium].filter(Boolean).join(" / ")}
                    </span>
                  ) : null}
                  {user.acquisitionReferrer ? <span>From: {user.acquisitionReferrer}</span> : null}
                  {user.acquisitionClickId ? (
                    <span className="font-mono truncate max-w-[14rem]" title={user.acquisitionClickId}>
                      Click id: {user.acquisitionClickId}
                    </span>
                  ) : null}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Unknown — signed up before attribution tracking, or no referrer was available.
              </p>
            )}
          </div>
        </div>
      </Panel>

      <div className="grid lg:grid-cols-2 gap-3 md:gap-4">
        <div className="space-y-3 md:space-y-4">
          <Panel className="overflow-hidden">
            <SectionLabel icon={Mail} title="Edit details" />
            <div className="p-3.5 md:p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Display name</Label>
                  <Input placeholder="Name" value={editName} onChange={e => setEditName(e.target.value)} className="h-9 md:h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Email</Label>
                  <Input type="email" placeholder="email@example.com" value={editEmail} onChange={e => setEditEmail(e.target.value)} className="h-9 md:h-10" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5" />
                  Country / Nationality
                </Label>
                <UserCountrySelect
                  value={editCountry}
                  onValueChange={setEditCountry}
                  emptyLabel="Not set"
                />
              </div>
              <div className="space-y-1.5 min-w-0">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5 min-w-0">
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  <span className="shrink-0">Phone</span>
                  {formatPhoneDisplay(user.phonePrefix, user.phoneNational) && (
                    <span className="ml-auto font-normal tabular-nums text-foreground truncate min-w-0">
                      {formatPhoneDisplay(user.phonePrefix, user.phoneNational)}
                    </span>
                  )}
                </Label>
                <UserPhoneFields
                  prefix={editPhonePrefix}
                  national={editPhoneNational}
                  onPrefixChange={setEditPhonePrefix}
                  onNationalChange={setEditPhoneNational}
                  searchPlaceholder="Search prefix…"
                  emptySearchLabel="No prefix found."
                  nationalPlaceholder="Insert your phone number..."
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <Button size="sm" onClick={handleSaveDetails} disabled={savingDetails} className="h-9">
                  {savingDetails ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  <span className="ml-1.5">Save details</span>
                </Button>
                {detailsMsg && <StatusMessage msg={detailsMsg} />}
              </div>
            </div>
          </Panel>

          <Panel className="overflow-hidden">
            <SectionLabel icon={Coins} title="Credits" />
            <div className="p-3.5 md:p-4 space-y-3">
              <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                <div className="space-y-1.5 flex-1">
                  <Label className="text-xs text-muted-foreground">Balance</Label>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={creditBalanceEdit}
                    onChange={(e) => setCreditBalanceEdit(e.target.value)}
                    className="h-9 md:h-10 tabular-nums"
                    onKeyDown={(e) => { if (e.key === "Enter") handleSaveCredits(); }}
                  />
                </div>
                <Button size="sm" onClick={handleSaveCredits} disabled={adjustCredits.isPending} className="h-9 md:h-10 shrink-0">
                  {adjustCredits.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  <span className="ml-1.5">Save credits</span>
                </Button>
              </div>
              {creditMsg && <StatusMessage msg={creditMsg} />}
            </div>
          </Panel>

          {!user.isAdmin && (
            <Panel className="overflow-hidden">
              <SectionLabel icon={Key} title="Reset password" />
              <div className="p-3.5 md:p-4 space-y-3">
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    type="password"
                    placeholder="New password (min 6 chars)"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="h-9 md:h-10 flex-1"
                    onKeyDown={e => { if (e.key === "Enter") handleResetPassword(); }}
                  />
                  <Button size="sm" onClick={handleResetPassword} disabled={savingPassword || newPassword.length < 6} className="h-9 md:h-10 shrink-0">
                    {savingPassword ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Set password"}
                  </Button>
                </div>
                {passwordMsg && <StatusMessage msg={passwordMsg} />}
              </div>
            </Panel>
          )}

          <Panel className="overflow-hidden">
            <SectionLabel
              icon={Gift}
              title="Grant free analysis"
              hint="Adds the full report to this user's account immediately. Uses catalog or existing cache when available — only fetches from the provider when no data exists yet."
            />
            <div className="p-3.5 md:p-4 space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  placeholder="17-character VIN"
                  value={grantVin}
                  onChange={e => setGrantVin(e.target.value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, ""))}
                  className="h-9 md:h-10 flex-1 font-mono text-xs tracking-wide"
                  maxLength={17}
                  onKeyDown={e => { if (e.key === "Enter" && grantVin.length === 17) handleGrantAnalysis(); }}
                />
                <Button size="sm" onClick={handleGrantAnalysis} disabled={granting || grantVin.length !== 17} className="h-9 md:h-10 shrink-0">
                  {granting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Gift className="h-3.5 w-3.5 mr-1" />}
                  Grant
                </Button>
              </div>
              {grantMsg && <StatusMessage msg={grantMsg} />}
            </div>
          </Panel>

          <Panel className="overflow-hidden">
            <SectionLabel
              icon={ReceiptText}
              title="Transaction history"
              hint="All payments for this user (VIN reports, packs, redemptions). Kept after pending credit/remove."
            />
            <div className="p-2 md:p-3">
              {(userTransactions?.items?.length ?? 0) === 0 ? (
                <p className="text-xs md:text-sm text-muted-foreground text-center py-6">No transactions yet</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border/40">
                  <table className="w-full text-xs md:text-sm">
                    <thead>
                      <tr className="border-b border-border/40 bg-muted/30 text-left text-muted-foreground">
                        <th className="px-3 py-2 font-medium">ID</th>
                        <th className="px-3 py-2 font-medium">Date</th>
                        <th className="px-3 py-2 font-medium">Type</th>
                        <th className="px-3 py-2 font-medium">VIN</th>
                        <th className="px-3 py-2 font-medium">Amount</th>
                        <th className="px-3 py-2 font-medium">Order ID</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {userTransactions!.items.map((row) => {
                        const orderId = row.providerOrderId ?? row.pokOrderId ?? row.paypalOrderId ?? null;
                        return (
                          <tr key={row.id}>
                            <td className="px-3 py-2 font-mono tabular-nums text-muted-foreground">
                              #{row.id}
                            </td>
                            <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                              {new Date(row.createdAt).toLocaleString(undefined, {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </td>
                            <td className="px-3 py-2">
                              <span className="text-foreground">{kindLabel(row.kind)}</span>
                              {row.credits != null && row.kind === "credit_pack" && (
                                <span className="text-muted-foreground"> · {row.credits} cr</span>
                              )}
                            </td>
                            <td className="px-3 py-2 font-mono text-[11px]">
                              {row.vin ? (
                                <Link href={`/adminx/vin/${row.vin}`}>
                                  <span className="hover:text-primary transition-colors">{row.vin}</span>
                                </Link>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                              {row.currency} {Number(row.amount).toFixed(2)}
                            </td>
                            <td
                              className="px-3 py-2 font-mono text-[11px] max-w-[140px] truncate text-muted-foreground"
                              title={orderId ?? undefined}
                            >
                              {orderId ?? "—"}
                            </td>
                            <td className="px-3 py-2">
                              <Badge
                                variant={row.status === "completed" ? "default" : "secondary"}
                                className="text-[10px]"
                              >
                                {row.status}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Panel>
        </div>

        <div className="space-y-3 md:space-y-4">
          <Panel className="overflow-hidden lg:row-span-2">
            <div className="px-3.5 pt-3.5 pb-2.5 md:px-4 md:pt-4 md:pb-3 border-b border-border/40 flex items-center justify-between gap-3">
              <h2 className="text-sm md:text-base font-semibold flex items-center gap-2 min-w-0">
                <Car className="h-4 w-4 text-primary shrink-0" />
                VIN lookups
                <span className="text-xs font-normal text-muted-foreground tabular-nums">({lookupsTotal})</span>
              </h2>
              {totalPages > 1 && (
                <div className="flex items-center gap-0.5 shrink-0">
                  <Button size="icon" variant="ghost" className="h-7 w-7" disabled={lookupsPage <= 1} onClick={() => setLookupsPage(p => p - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {lookupPageNumbers.map((pageNum) => (
                    <Button
                      key={pageNum}
                      size="sm"
                      variant={pageNum === lookupsPage ? "default" : "ghost"}
                      className={cn(
                        "h-7 min-w-7 px-2 text-xs tabular-nums",
                        pageNum === lookupsPage && "pointer-events-none",
                      )}
                      onClick={() => setLookupsPage(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  ))}
                  <Button size="icon" variant="ghost" className="h-7 w-7" disabled={lookupsPage >= totalPages} onClick={() => setLookupsPage(p => p + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            <div className="p-2 md:p-3">
              {lookupsLoading ? (
                <div className="space-y-2 px-1">
                  {[0, 1, 2, 3, 4].map(i => <Skeleton key={i} className="h-[4.5rem] rounded-lg" />)}
                </div>
              ) : lookups.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                  <div className="h-10 w-10 rounded-full bg-muted/60 flex items-center justify-center mb-3">
                    <Car className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-xs md:text-sm text-muted-foreground">No VIN lookups yet</p>
                </div>
              ) : (
                <div className="divide-y divide-border/40 rounded-lg overflow-hidden border border-border/40">
                  {lookups.map(lookup => {
                    const vd = lookup.data;
                    const vehicleName = vd?.make && vd?.model
                      ? `${vd.year ? vd.year + " " : ""}${vd.make} ${vd.model}`
                      : null;

                    return (
                      <div
                        key={lookup.id}
                        className="flex items-center gap-3 p-2.5 md:p-3 bg-card hover:bg-muted/30 transition-colors"
                      >
                        <VinPhoto photos={vd?.photos} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Link href={`/adminx/vin/${lookup.vin}`}>
                              <span className="font-mono text-xs font-semibold hover:text-primary transition-colors">{lookup.vin}</span>
                            </Link>
                            <Badge
                              variant={lookup.status === "complete" ? "default" : "secondary"}
                              className="text-[10px] py-0 h-4 shrink-0"
                            >
                              {lookup.status}
                            </Badge>
                          </div>
                          {vehicleName && (
                            <p className="text-xs md:text-sm text-foreground font-medium mt-0.5 truncate">{vehicleName}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {vd?.odometer != null && (
                              <span className="text-[10px] md:text-xs text-muted-foreground tabular-nums">{vd.odometer.toLocaleString()} km</span>
                            )}
                            {(vd?.accidentCount ?? 0) > 0 && (
                              <Badge variant="destructive" className="text-[10px] py-0 h-4">
                                {vd!.accidentCount} accident{vd!.accidentCount! > 1 ? "s" : ""}
                              </Badge>
                            )}
                            {vd?.isSalvage && (
                              <Badge variant="outline" className="text-[10px] py-0 h-4 border-orange-400 text-orange-600">
                                Salvage
                              </Badge>
                            )}
                            <span className="text-[10px] md:text-xs text-muted-foreground">
                              {new Date(lookup.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        {lookup.status === "complete" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="shrink-0 text-orange-600 border-orange-300 hover:bg-orange-50 hover:text-orange-700 dark:hover:bg-orange-950/30 gap-1.5 text-xs h-8"
                            onClick={() => handleRevokeAccess(lookup.id)}
                            disabled={revokingId === lookup.id}
                            title="Revoke access — keeps data in DB, removes payment access"
                          >
                            {revokingId === lookup.id
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <ShieldOff className="h-3 w-3" />}
                            Revoke
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Panel>

          <Panel className="overflow-hidden">
            <SectionLabel icon={DollarSign} title="Credit pack purchases" hint="Pack purchases for this user only." />
            <div className="p-2 md:p-3">
              {(creditPurchases?.items?.length ?? 0) === 0 ? (
                <p className="text-xs md:text-sm text-muted-foreground text-center py-6">No credit pack purchases yet</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border/40">
                  <table className="w-full text-xs md:text-sm">
                    <thead>
                      <tr className="border-b border-border/40 bg-muted/30 text-left text-muted-foreground">
                        <th className="px-3 py-2 font-medium">Date</th>
                        <th className="px-3 py-2 font-medium">Amount</th>
                        <th className="px-3 py-2 font-medium">Credits</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {creditPurchases!.items.map((row) => (
                        <tr key={row.id}>
                          <td className="px-3 py-2 tabular-nums">
                            {new Date(row.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                          </td>
                          <td className="px-3 py-2 tabular-nums">€{Number(row.amount).toFixed(2)}</td>
                          <td className="px-3 py-2 tabular-nums">{row.credits ?? "—"}</td>
                          <td className="px-3 py-2">
                            <Badge variant={row.status === "completed" ? "default" : "secondary"} className="text-[10px]">
                              {row.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Panel>

          {!user.isAdmin && (
            <Panel className="overflow-hidden">
              <div className="p-3.5 md:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    {user.isBanned ? <Ban className="h-4 w-4 text-destructive" /> : <CheckCircle2 className="h-4 w-4 text-primary" />}
                    Account status
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {user.isBanned
                      ? "This account is banned. Remembered browsers/devices for this user are also blocked."
                      : "Active. Ban suspends the account and blocks remembered browsers/devices (not IPs)."}
                  </p>
                </div>
                {user.isBanned ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => { unbanUser.mutate({ userId: user.id }); void refetchUser(); }}
                    disabled={unbanUser.isPending}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />Unban
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="destructive"
                    className="shrink-0"
                    onClick={() => {
                      if (!confirm("Ban this user and block their remembered devices?")) return;
                      banUser.mutate({ userId: user.id, data: { reason: "Admin action" } });
                      void refetchUser();
                    }}
                    disabled={banUser.isPending}
                  >
                    <Ban className="h-3.5 w-3.5 mr-1.5" />
                    Ban user
                  </Button>
                )}
              </div>
            </Panel>
          )}
        </div>
      </div>

      {!user.isAdmin && (
        <Panel className="overflow-hidden border-destructive/30 bg-destructive/[0.03]">
          <div className="p-3.5 md:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-destructive flex items-center gap-1.5">
                <Trash2 className="h-4 w-4" />
                Remove user
              </h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-xl">
                Permanently deletes this account, all payments, and VIN lookup history.
                Shared VIN catalog data is kept for other users.
              </p>
            </div>
            <Button
              size="sm"
              variant="destructive"
              className="shrink-0"
              onClick={() => {
                setDeleteEmail("");
                setDeleteError(null);
                setDeleteOpen(true);
              }}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Remove user
            </Button>
          </div>
        </Panel>
      )}

      <AlertDialog open={deleteOpen} onOpenChange={(open) => { if (!deleteUser.isPending) setDeleteOpen(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove user permanently?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  This will delete <span className="font-medium text-foreground">{user.email}</span> and wipe:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Account profile and login credentials</li>
                  <li>All payments and transactions</li>
                  <li>All VIN lookups tied to this user</li>
                </ul>
                <p>VIN catalog entries stay in the system. This cannot be undone.</p>
                <div className="space-y-1.5 pt-1">
                  <Label htmlFor="delete-confirm-email" className="text-xs text-foreground">
                    Type <span className="font-mono font-semibold">{user.email}</span> to confirm
                  </Label>
                  <Input
                    id="delete-confirm-email"
                    value={deleteEmail}
                    onChange={(e) => { setDeleteEmail(e.target.value); setDeleteError(null); }}
                    placeholder={user.email}
                    className="h-9 font-mono text-xs"
                    autoComplete="off"
                  />
                </div>
                {deleteError && (
                  <p className="text-xs text-destructive">{deleteError}</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteUser.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!emailMatches || deleteUser.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                handleDeleteUser();
              }}
            >
              {deleteUser.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Removing…
                </>
              ) : (
                "Remove user permanently"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
