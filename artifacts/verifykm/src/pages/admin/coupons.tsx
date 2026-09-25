import { useMemo, useState } from "react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  Tag,
  Percent,
  Euro,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  TrendingUp,
  BarChart3,
  Gift,
  Receipt,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ADMIN_QUERY_OPTIONS } from "@/lib/admin-query-options";
import { createClientFetchError } from "@/lib/api-error";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type Coupon = {
  id: number;
  code: string;
  type: "percent" | "flat";
  value: number;
  maxUses: number | null;
  uses: number;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
};

type CouponStats = {
  days: number;
  overview: {
    totalCoupons: number;
    activeCoupons: number;
    totalRedemptions: number;
    totalDiscountGiven: number;
    couponRevenue: number;
    freeRedemptions: number;
    redemptionsInPeriod: number;
  };
  byDay: Array<{ date: string; redemptions: number; discount: number; revenue: number }>;
  byCoupon: Array<{
    id: number;
    code: string;
    type: string;
    value: number;
    uses: number;
    maxUses: number | null;
    isActive: boolean;
    expiresAt: string | Date | null;
    paymentRedemptions: number;
    totalDiscount: number;
    revenue: number;
    lastUsedAt: string | Date | null;
  }>;
  recentRedemptions: Array<{
    id: number;
    couponCode: string;
    amount: number;
    discountAmount: number | null;
    createdAt: string | Date;
    vin: string | null;
    userEmail: string | null;
  }>;
};

type CreateForm = {
  code: string;
  type: "percent" | "flat";
  value: string;
  maxUses: string;
  expiresAt: string;
  isActive: boolean;
};

function fillCouponDays(
  data: CouponStats["byDay"],
  days: number,
): Array<{ date: string; label: string; redemptions: number; discount: number; revenue: number }> {
  const map = new Map(data.map((row) => [row.date, row]));
  const result: Array<{ date: string; label: string; redemptions: number; discount: number; revenue: number }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const dt = new Date();
    dt.setDate(dt.getDate() - i);
    dt.setHours(0, 0, 0, 0);
    const iso = dt.toISOString().substring(0, 10);
    const row = map.get(iso);
    result.push({
      date: iso,
      label: dt.toLocaleDateString("en", { month: "short", day: "numeric" }),
      redemptions: row?.redemptions ?? 0,
      discount: row?.discount ?? 0,
      revenue: row?.revenue ?? 0,
    });
  }
  return result;
}

function useCoupons() {
  return useQuery<Coupon[]>({
    ...ADMIN_QUERY_OPTIONS,
    queryKey: ["/api/admin/coupons"],
    queryFn: async () => {
      const r = await fetch(`${basePath}/api/admin/coupons`, { credentials: "include" });
      if (!r.ok) throw createClientFetchError("coupons", r.status);
      return r.json();
    },
  });
}

function useCouponStats(days: number) {
  return useQuery<CouponStats>({
    ...ADMIN_QUERY_OPTIONS,
    queryKey: ["/api/admin/coupons/stats", days],
    queryFn: async () => {
      const r = await fetch(`${basePath}/api/admin/coupons/stats?days=${days}`, { credentials: "include" });
      if (!r.ok) throw createClientFetchError("coupon_stats", r.status);
      return r.json();
    },
  });
}

function useCreateCoupon(onSuccess: () => void) {
  return useMutation({
    mutationFn: async (form: CreateForm) => {
      const r = await fetch(`${basePath}/api/admin/coupons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          code: form.code,
          type: form.type,
          value: parseFloat(form.value),
          maxUses: form.maxUses ? parseInt(form.maxUses) : null,
          expiresAt: form.expiresAt || null,
          isActive: form.isActive,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Failed to create coupon");
      return data;
    },
    onSuccess,
  });
}

function useToggleCoupon(onSuccess: () => void) {
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const r = await fetch(`${basePath}/api/admin/coupons/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isActive }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error((data as { error?: string }).error ?? "Failed to update coupon");
      return data;
    },
    onSuccess,
  });
}

function useDeleteCoupon(onSuccess: () => void) {
  return useMutation({
    mutationFn: async (id: number) => {
      await fetch(`${basePath}/api/admin/coupons/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
    },
    onSuccess,
  });
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  iconClass,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  iconClass: string;
}) {
  return (
    <Card className="border shadow-sm">
      <CardContent className="pt-4 pb-3.5 px-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${iconClass}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <p className="text-2xl font-bold tabular-nums leading-none">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
        {sub && <p className="text-[11px] text-muted-foreground/70 mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function AdminCoupons() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [statsDays, setStatsDays] = useState(30);
  const [createError, setCreateError] = useState("");
  const [form, setForm] = useState<CreateForm>({
    code: "", type: "percent", value: "", maxUses: "", expiresAt: "", isActive: true,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["/api/admin/coupons"] });
    void queryClient.invalidateQueries({ queryKey: ["/api/admin/coupons/stats"] });
  };
  const { data: coupons, isLoading } = useCoupons();
  const { data: stats, isLoading: statsLoading } = useCouponStats(statsDays);
  const createCoupon = useCreateCoupon(() => {
    invalidate();
    setShowForm(false);
    setCreateError("");
    setForm({ code: "", type: "percent", value: "", maxUses: "", expiresAt: "", isActive: true });
  });
  const toggleCoupon = useToggleCoupon(invalidate);
  const deleteCoupon = useDeleteCoupon(invalidate);

  const chartData = useMemo(
    () => (stats ? fillCouponDays(stats.byDay, stats.days) : []),
    [stats],
  );

  const handleCreate = () => {
    setCreateError("");
    if (!form.code.trim()) { setCreateError("Code is required"); return; }
    if (!form.value || isNaN(parseFloat(form.value)) || parseFloat(form.value) <= 0) { setCreateError("Value must be > 0"); return; }
    if (form.type === "percent" && parseFloat(form.value) > 100) { setCreateError("Percent value cannot exceed 100"); return; }
    createCoupon.mutate(form, {
      onError: (err) => setCreateError(err instanceof Error ? err.message : "Failed to create"),
    });
  };

  const usagePct = (c: Coupon) => c.maxUses ? Math.round((c.uses / c.maxUses) * 100) : null;
  const isExpired = (c: Coupon) => c.expiresAt ? new Date(c.expiresAt) < new Date() : false;

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Coupons</h1>
          <p className="text-muted-foreground mt-1">Create, track, and manage discount codes</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="gap-2">
          <Plus className="h-4 w-4" />
          New Coupon
        </Button>
      </div>

      {/* Stats */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Usage analytics
            </CardTitle>
            <CardDescription>Redemptions from completed payments</CardDescription>
          </div>
          <Select value={String(statsDays)} onValueChange={(v) => setStatsDays(Number(v))}>
            <SelectTrigger className="w-full sm:w-[140px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="space-y-6">
          {statsLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
          ) : stats ? (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard
                  label={`Redemptions (${stats.days}d)`}
                  value={String(stats.overview.redemptionsInPeriod)}
                  sub={`${stats.overview.totalRedemptions} all time`}
                  icon={TrendingUp}
                  iconClass="bg-primary/10 text-primary"
                />
                <StatCard
                  label="Discount given"
                  value={`€${stats.overview.totalDiscountGiven.toFixed(2)}`}
                  sub="From coupon checkouts"
                  icon={Percent}
                  iconClass="bg-orange-500/10 text-orange-600"
                />
                <StatCard
                  label="Coupon revenue"
                  value={`€${stats.overview.couponRevenue.toFixed(2)}`}
                  sub="Paid after discount"
                  icon={Receipt}
                  iconClass="bg-[#00a5fd]/10 text-[#0088d4]"
                />
                <StatCard
                  label="Active codes"
                  value={`${stats.overview.activeCoupons} / ${stats.overview.totalCoupons}`}
                  sub={`${stats.overview.freeRedemptions} free (100%) uses`}
                  icon={Gift}
                  iconClass="bg-violet-500/10 text-violet-600"
                />
              </div>

              <div className="h-[220px] w-full">
                {chartData.some((d) => d.redemptions > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="couponRedemptions" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={32} />
                      <Tooltip
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                        formatter={(value: number, name: string) => {
                          if (name === "discount") return [`€${value.toFixed(2)}`, "Discount"];
                          if (name === "revenue") return [`€${value.toFixed(2)}`, "Revenue"];
                          return [value, "Redemptions"];
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="redemptions"
                        stroke="hsl(var(--primary))"
                        fill="url(#couponRedemptions)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-muted-foreground border rounded-xl border-dashed">
                    No coupon redemptions in this period
                  </div>
                )}
              </div>

              {stats.byCoupon.some((c) => c.paymentRedemptions > 0) && (
                <div className="overflow-x-auto rounded-xl border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                        <th className="px-3 py-2 font-medium">Code</th>
                        <th className="px-3 py-2 font-medium">Discount</th>
                        <th className="px-3 py-2 font-medium text-right">Uses (DB)</th>
                        <th className="px-3 py-2 font-medium text-right">Payments</th>
                        <th className="px-3 py-2 font-medium text-right">Discount €</th>
                        <th className="px-3 py-2 font-medium text-right">Revenue €</th>
                        <th className="px-3 py-2 font-medium">Last used</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.byCoupon.filter((c) => c.paymentRedemptions > 0 || c.uses > 0).map((c) => (
                        <tr key={c.code} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="px-3 py-2.5 font-mono font-semibold">{c.code}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">
                            {c.id === 0 ? "—" : c.type === "percent" ? `${c.value}%` : `€${c.value.toFixed(2)}`}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            {c.uses}{c.maxUses != null ? ` / ${c.maxUses}` : ""}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums font-medium">{c.paymentRedemptions}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">€{c.totalDiscount.toFixed(2)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">€{c.revenue.toFixed(2)}</td>
                          <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                            {c.lastUsedAt ? new Date(c.lastUsedAt).toLocaleString() : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {stats.recentRedemptions.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Recent redemptions</p>
                  <div className="space-y-1.5">
                    {stats.recentRedemptions.slice(0, 8).map((r) => (
                      <div key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs rounded-lg border px-3 py-2">
                        <span className="font-mono font-semibold">{r.couponCode}</span>
                        <span className="text-muted-foreground">
                          {new Date(r.createdAt).toLocaleString()}
                        </span>
                        {r.userEmail && <span className="truncate max-w-[180px]">{r.userEmail}</span>}
                        {r.vin && <span className="font-mono text-muted-foreground">{r.vin}</span>}
                        <span className="ml-auto tabular-nums">
                          {r.amount === 0 ? (
                            <Badge variant="secondary" className="text-[10px]">Free</Badge>
                          ) : (
                            <>€{r.amount.toFixed(2)}</>
                          )}
                          {r.discountAmount != null && r.discountAmount > 0 && (
                            <span className="text-[#0088d4] dark:text-[#00a5fd] ml-1.5">
                              (−€{r.discountAmount.toFixed(2)})
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </CardContent>
      </Card>

      {/* Create form */}
      {showForm && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base">Create Coupon</CardTitle>
            <CardDescription>Generate a new discount code for customers</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Coupon Code <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="SUMMER50"
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                  className="font-mono uppercase"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Discount Type <span className="text-destructive">*</span></Label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, type: "percent" }))}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-sm font-medium transition-all ${form.type === "percent" ? "bg-primary text-primary-foreground border-primary" : "border-input hover:bg-muted"}`}
                  >
                    <Percent className="h-3.5 w-3.5" /> Percent
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, type: "flat" }))}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-sm font-medium transition-all ${form.type === "flat" ? "bg-primary text-primary-foreground border-primary" : "border-input hover:bg-muted"}`}
                  >
                    <Euro className="h-3.5 w-3.5" /> Flat (€)
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Value <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    {form.type === "percent" ? "%" : "€"}
                  </span>
                  <Input
                    type="number"
                    min={0.01}
                    max={form.type === "percent" ? 100 : undefined}
                    step={0.01}
                    placeholder={form.type === "percent" ? "50" : "5.00"}
                    value={form.value}
                    onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                    className="pl-8"
                  />
                </div>
                {form.type === "percent" && parseFloat(form.value) === 100 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    100% = fully free, no payment needed
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Max Uses <span className="text-muted-foreground text-xs">(blank = unlimited)</span></Label>
                <Input
                  type="number"
                  min={1}
                  placeholder="100"
                  value={form.maxUses}
                  onChange={(e) => setForm((f) => ({ ...f, maxUses: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Expires At <span className="text-muted-foreground text-xs">(blank = never)</span></Label>
                <Input
                  type="datetime-local"
                  value={form.expiresAt}
                  onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
                  className="max-w-xs"
                />
              </div>
              <div className="flex items-center gap-3 sm:col-span-2">
                <Switch
                  id="coupon-active"
                  checked={form.isActive}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
                />
                <Label htmlFor="coupon-active" className="cursor-pointer">Active (usable immediately)</Label>
              </div>
            </div>
            {createError && (
              <p className="text-sm text-destructive">{createError}</p>
            )}
            <div className="flex gap-2 pt-2">
              <Button onClick={handleCreate} disabled={createCoupon.isPending} className="gap-2">
                <Plus className="h-4 w-4" />
                {createCoupon.isPending ? "Creating..." : "Create Coupon"}
              </Button>
              <Button variant="outline" onClick={() => { setShowForm(false); setCreateError(""); }}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Coupon list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Tag className="h-4 w-4 text-primary" />
            All Coupons
            {coupons && <Badge variant="secondary" className="ml-1">{coupons.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
          ) : !coupons?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <Tag className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No coupons yet</p>
              <p className="text-xs mt-1">Create your first coupon to offer discounts</p>
            </div>
          ) : (
            <div className="space-y-3">
              {coupons.map((c) => {
                const expired = isExpired(c);
                const pct = usagePct(c);
                const exhausted = c.maxUses != null && c.uses >= c.maxUses;
                const effective = c.isActive && !expired && !exhausted;
                const payStats = stats?.byCoupon.find((s) => s.code === c.code);
                return (
                  <div key={c.id} className={`flex items-start gap-4 p-4 rounded-xl border transition-colors ${effective ? "bg-background hover:border-primary/30" : "bg-muted/40"}`}>
                    <div className="mt-0.5 shrink-0">
                      {effective
                        ? <CheckCircle2 className="h-5 w-5 text-[#00a5fd]" />
                        : <XCircle className="h-5 w-5 text-muted-foreground" />
                      }
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-mono font-bold text-base">{c.code}</span>
                        <Badge variant={c.type === "percent" ? "default" : "outline"} className="text-xs">
                          {c.type === "percent" ? `${c.value}%` : `€${c.value.toFixed(2)}`} off
                        </Badge>
                        {expired && <Badge variant="destructive" className="text-xs">Expired</Badge>}
                        {exhausted && <Badge variant="secondary" className="text-xs">Used up</Badge>}
                        {!c.isActive && !expired && !exhausted && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                        <span>{c.uses} used{c.maxUses ? ` / ${c.maxUses} max` : " / unlimited"}</span>
                        {payStats && payStats.paymentRedemptions > 0 && (
                          <span>{payStats.paymentRedemptions} completed payments · €{payStats.totalDiscount.toFixed(2)} saved</span>
                        )}
                        {c.expiresAt && (
                          <span>Expires {new Date(c.expiresAt).toLocaleDateString()}</span>
                        )}
                        {c.value === 100 && c.type === "percent" && (
                          <span className="text-[#0088d4] dark:text-[#00a5fd] font-medium">100% — free access</span>
                        )}
                      </div>

                      {c.maxUses != null && (
                        <div className="mt-2 h-1.5 w-full max-w-[200px] rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${pct! >= 100 ? "bg-destructive" : pct! > 70 ? "bg-orange-500" : "bg-primary"}`}
                            style={{ width: `${Math.min(100, pct!)}%` }}
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Switch
                        checked={c.isActive}
                        onCheckedChange={(v) => toggleCoupon.mutate({ id: c.id, isActive: v })}
                        disabled={toggleCoupon.isPending}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0"
                        onClick={() => { if (confirm(`Delete coupon "${c.code}"?`)) deleteCoupon.mutate(c.id); }}
                        disabled={deleteCoupon.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
