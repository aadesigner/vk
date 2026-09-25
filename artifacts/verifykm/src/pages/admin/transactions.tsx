import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DollarSign, CheckCircle2, XCircle, AlertTriangle, Search, ChevronLeft, ChevronRight, CreditCard, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type AdminTransaction = {
  id: number;
  userId: string;
  userEmail: string | null;
  userName?: string | null;
  vin: string | null;
  amount: number;
  currency: string;
  status: string;
  kind?: string | null;
  paypalOrderId: string | null;
  pokOrderId?: string | null;
  paymentMethod?: "paypal" | "pok" | "credit" | "free" | null;
  providerOrderId?: string | null;
  couponCode: string | null;
  discountAmount: number | null;
  vinLookupId: number | null;
  createdAt: string;
};

type Summary = {
  totalRevenue: number;
  counts: Record<string, number>;
};

type TransactionPage = {
  items: AdminTransaction[];
  total: number;
  page: number;
  limit: number;
  summary: Summary;
};

const STATUS_OPTIONS = ["", "completed", "failed", "refunded", "revoked", "voided"] as const;

const STATUS_CONFIG: Record<string, {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  className?: string;
  icon: React.ReactNode;
}> = {
  completed: {
    label: "Completed", variant: "default",
    className: "bg-[#00a5fd] hover:bg-[#008fd9] text-white border-0",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  failed: {
    label: "Failed", variant: "destructive",
    icon: <XCircle className="h-3 w-3" />,
  },
  refunded: {
    label: "Refunded", variant: "outline",
    icon: <AlertTriangle className="h-3 w-3" />,
  },
  revoked: {
    label: "Revoked", variant: "outline",
    className: "border-orange-400 text-orange-600 dark:text-orange-400",
    icon: <XCircle className="h-3 w-3" />,
  },
  voided: {
    label: "Voided", variant: "outline",
    className: "border-muted-foreground/40 text-muted-foreground",
    icon: <Trash2 className="h-3 w-3" />,
  },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, variant: "outline" as const, icon: null };
  return (
    <Badge variant={cfg.variant} className={cn("flex items-center gap-1 w-fit text-xs shrink-0", cfg.className)}>
      {cfg.icon}
      {cfg.label}
    </Badge>
  );
}

function PaymentMethodBadge({ method }: { method: AdminTransaction["paymentMethod"] }) {
  if (method === "pok") {
    return (
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-semibold border-violet-400/70 text-violet-700 dark:text-violet-300">
        POK
      </Badge>
    );
  }
  if (method === "paypal") {
    return (
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-semibold border-sky-400/70 text-sky-700 dark:text-sky-300">
        PayPal
      </Badge>
    );
  }
  if (method === "credit") {
    return (
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-semibold">
        Credit
      </Badge>
    );
  }
  if (method === "free") {
    return (
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-semibold">
        Free
      </Badge>
    );
  }
  return <span className="text-muted-foreground">—</span>;
}

function resolvePaymentMethod(tx: AdminTransaction): AdminTransaction["paymentMethod"] {
  if (tx.paymentMethod) return tx.paymentMethod;
  if (tx.pokOrderId) return "pok";
  if (tx.paypalOrderId) return "paypal";
  if (tx.kind === "credit_redemption") return "credit";
  if (tx.amount === 0) return "free";
  // Legacy paid rows without a stored provider id were PayPal
  return "paypal";
}

function resolveProviderOrderId(tx: AdminTransaction): string | null {
  return tx.providerOrderId ?? tx.pokOrderId ?? tx.paypalOrderId ?? null;
}

function useTransactions(page: number, status: string, search: string) {
  const params = new URLSearchParams({ page: String(page), limit: "50" });
  if (status) params.set("status", status);
  if (search) params.set("search", search);

  return useQuery<TransactionPage>({
    queryKey: ["/api/admin/transactions", page, status, search],
    queryFn: async () => {
      const r = await fetch(`${basePath}/api/admin/transactions?${params}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch transactions");
      return r.json();
    },
  });
}

function SummaryCard({ label, value, icon, className }: {
  label: string; value: string; icon: React.ReactNode; className?: string;
}) {
  return (
    <Card className={className}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div>
          <p className="text-2xl font-black tabular-nums leading-tight">{value}</p>
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function FailedTxnCleanup() {
  const queryClient = useQueryClient();
  const [purgeDays, setPurgeDays] = useState(7);
  const [purging, setPurging] = useState(false);
  const [purgeResult, setPurgeResult] = useState<number | null>(null);

  const handlePurge = async () => {
    setPurging(true);
    setPurgeResult(null);
    try {
      const resp = await fetch(`${basePath}/api/admin/transactions/purge-failed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: purgeDays }),
        credentials: "include",
      });
      const data = await resp.json() as { deleted?: number };
      setPurgeResult(data.deleted ?? 0);
      void queryClient.invalidateQueries({ queryKey: ["/api/admin/transactions"] });
    } catch {
      setPurgeResult(0);
    } finally {
      setPurging(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Trash2 className="h-4 w-4 text-muted-foreground" />
          Failed Transaction Cleanup
        </CardTitle>
        <CardDescription>
          Permanently delete failed transaction records older than a selected period. Completed or refunded transactions are not affected.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <Select value={String(purgeDays)} onValueChange={(v) => { setPurgeDays(Number(v)); setPurgeResult(null); }}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Older than 1 week</SelectItem>
            <SelectItem value="30">Older than 1 month</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="destructive" size="sm" onClick={handlePurge} disabled={purging} className="gap-1.5">
          <Trash2 className="h-3.5 w-3.5" />
          {purging ? "Purging…" : "Purge Failed Transactions"}
        </Button>
        {purgeResult !== null && (
          <span className="text-sm text-muted-foreground">
            {purgeResult === 0 ? "Nothing to purge" : `${purgeResult} record${purgeResult !== 1 ? "s" : ""} deleted`}
          </span>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminTransactions() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<AdminTransaction | null>(null);
  const [deleting, setDeleting] = useState(false);

  const queryClient = useQueryClient();
  const { data, isLoading } = useTransactions(page, status, search);

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;
  const summary = data?.summary;
  const counts = summary?.counts ?? {};

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  };

  const handleStatusChange = (val: string) => {
    setStatus(val === "all" ? "" : val);
    setPage(1);
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const r = await fetch(`${basePath}/api/admin/transactions/${confirmDelete.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) throw new Error("Delete failed");
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/transactions"] });
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Transactions</h1>
        <p className="text-muted-foreground text-sm mt-0.5">All payments across all users</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard
          label="Total Revenue"
          value={summary ? `€${summary.totalRevenue.toFixed(2)}` : "—"}
          icon={<DollarSign className="h-4 w-4 text-[#0088d4]" />}
        />
        <SummaryCard
          label="Completed"
          value={isLoading ? "—" : String(counts.completed ?? 0)}
          icon={<CheckCircle2 className="h-4 w-4 text-[#00a5fd]" />}
        />
        <SummaryCard
          label="Failed / Revoked"
          value={isLoading ? "—" : String((counts.failed ?? 0) + (counts.revoked ?? 0))}
          icon={<XCircle className="h-4 w-4 text-destructive" />}
        />
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All Transactions</CardTitle>
          <CardDescription>
            {isLoading ? "Loading..." : `${data?.total ?? 0} total`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <form onSubmit={handleSearch} className="flex gap-2 flex-1">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search name, email, VIN, PayPal or POK order ID…"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>
              <Button type="submit" variant="secondary">Search</Button>
            </form>
            <Select value={status || "all"} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s || "all"} value={s || "all"}>
                    {s ? (STATUS_CONFIG[s]?.label ?? s) : "All statuses"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="rounded-xl border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>VIN</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Coupon</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 9 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (data?.items ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <CreditCard className="h-8 w-8 opacity-30" />
                        <p className="text-sm">No transactions found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  (data?.items ?? []).filter(tx => tx.status !== "pending").map((tx) => {
                    const method = resolvePaymentMethod(tx);
                    const orderId = resolveProviderOrderId(tx);
                    return (
                    <TableRow key={tx.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(tx.createdAt).toLocaleString(undefined, {
                          year: "numeric", month: "short", day: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell className="text-xs max-w-[180px]">
                        {tx.userName ? (
                          <div className="min-w-0">
                            <p className="truncate font-medium">{tx.userName}</p>
                            <p className="truncate text-muted-foreground">{tx.userEmail ?? tx.userId}</p>
                          </div>
                        ) : (
                          <span className="truncate block">{tx.userEmail ?? tx.userId}</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {tx.vin ?? "—"}
                      </TableCell>
                      <TableCell className="tabular-nums text-sm font-medium">
                        {tx.currency} {tx.amount.toFixed(2)}
                        {tx.discountAmount ? (
                          <span className="ml-1 text-xs text-muted-foreground">
                            (-{tx.discountAmount.toFixed(2)})
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-xs">
                        {tx.couponCode
                          ? <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">{tx.couponCode}</span>
                          : <span className="text-muted-foreground">—</span>
                        }
                      </TableCell>
                      <TableCell>
                        <PaymentMethodBadge method={method} />
                      </TableCell>
                      <TableCell className="font-mono text-xs max-w-[160px] truncate text-muted-foreground" title={orderId ?? undefined}>
                        {orderId ?? "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={tx.status} />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => setConfirmDelete(tx)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline" size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline" size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Failed transaction cleanup */}
      <FailedTxnCleanup />

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              This marks the transaction as voided and hides it from the default list. The record is kept for audit.
              {confirmDelete?.vin && (
                <> The client will no longer see a purchase for VIN <span className="font-mono font-semibold">{confirmDelete.vin}</span>.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={deleting}
              onClick={handleDeleteConfirm}
            >
              {deleting ? "Voiding…" : "Void"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
