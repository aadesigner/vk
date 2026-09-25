import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, RefreshCw, Trash2, AlertTriangle, CheckCircle2, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const PAGE_SIZE = 25;

type EmailLog = {
  id: number;
  type: string;
  recipient: string;
  subject: string;
  status: "sent" | "failed";
  error: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
  resendable?: boolean;
};

type LogsResponse = {
  items: EmailLog[];
  total: number;
  page: number;
  limit: number;
};

const TYPE_LABELS: Record<string, string> = {
  welcome: "Welcome",
  report: "Report ready",
  reset: "Password reset",
  abandoned: "Abandoned cart",
  noinfo: "No info / credit",
  noinforefund: "No info / refund",
  admin_pending: "Admin: pending VIN",
  test: "SMTP test",
  promo: "Promo",
  other: "Other",
};

const TYPE_ORDER = [
  "report",
  "welcome",
  "reset",
  "abandoned",
  "noinfo",
  "noinforefund",
  "admin_pending",
  "test",
  "promo",
  "other",
];

function typeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type;
}

function useDebounced<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function AdminEmailLogs({
  retentionEnabled,
  onRetentionChange,
  retentionSaving,
}: {
  retentionEnabled: boolean;
  onRetentionChange: (value: boolean) => void;
  retentionSaving: boolean;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [page, setPage] = useState(1);
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [clearing, setClearing] = useState(false);
  const [resendingId, setResendingId] = useState<number | null>(null);

  const debouncedSearch = useDebounced(search);

  // Any filter change invalidates the current page offset.
  useEffect(() => {
    setPage(1);
  }, [type, status, debouncedSearch, from, to]);

  const params = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (type !== "all") p.set("type", type);
    if (status !== "all") p.set("status", status);
    if (debouncedSearch.trim()) p.set("search", debouncedSearch.trim());
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    return p.toString();
  }, [page, type, status, debouncedSearch, from, to]);

  const { data, isLoading, isFetching, refetch } = useQuery<LogsResponse>({
    queryKey: ["admin-email-logs", params],
    queryFn: async () => {
      const resp = await fetch(`${basePath}/api/admin/email/logs?${params}`, {
        credentials: "include",
      });
      if (!resp.ok) throw new Error("Failed to load email logs");
      return resp.json() as Promise<LogsResponse>;
    },
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  });

  const logs = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = type !== "all" || status !== "all" || Boolean(search) || Boolean(from) || Boolean(to);

  function resetFilters() {
    setType("all");
    setStatus("all");
    setSearch("");
    setFrom("");
    setTo("");
  }

  async function handleClearAll() {
    if (!confirm("Delete every email log entry? This cannot be undone.")) return;
    setClearing(true);
    try {
      const resp = await fetch(`${basePath}/api/admin/email/logs`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!resp.ok) throw new Error("Request failed");
      await queryClient.invalidateQueries({ queryKey: ["admin-email-logs"] });
      toast({ title: "Email logs cleared" });
    } catch {
      toast({ variant: "destructive", title: "Could not clear logs" });
    } finally {
      setClearing(false);
    }
  }

  async function handleResend(log: EmailLog) {
    setResendingId(log.id);
    try {
      const resp = await fetch(`${basePath}/api/admin/email/logs/${log.id}/resend`, {
        method: "POST",
        credentials: "include",
      });
      const body = (await resp.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        hint?: string;
      };
      if (!resp.ok || body.ok === false) {
        throw new Error(body.error || "Resend failed");
      }
      await queryClient.invalidateQueries({ queryKey: ["admin-email-logs"] });
      toast({ title: "Email resent", description: `Sent to ${log.recipient}` });
    } catch (err) {
      await queryClient.invalidateQueries({ queryKey: ["admin-email-logs"] });
      toast({
        variant: "destructive",
        title: "Could not resend email",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setResendingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-base">Automatic cleanup</CardTitle>
              <CardDescription className="mt-1">
                When on, log entries older than 7 days are deleted automatically. Runs every 6 hours.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={retentionEnabled}
                disabled={retentionSaving}
                onCheckedChange={onRetentionChange}
              />
              <Badge variant={retentionEnabled ? "default" : "secondary"} className="text-[10px]">
                {retentionEnabled ? "On" : "Off"}
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-stretch sm:items-end min-w-0">
        <div className="relative flex-1 min-w-0 w-full sm:min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search recipient…"
            className="pl-9 h-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-full sm:w-[180px] h-9">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {TYPE_ORDER.map((t) => (
              <SelectItem key={t} value={t}>{typeLabel(t)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-[130px] h-9">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1.5 min-w-0 w-full sm:w-auto">
          <span className="text-sm text-muted-foreground shrink-0">From</span>
          <Input type="date" className="w-full sm:w-[150px] h-9 min-w-0" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="flex items-center gap-1.5 min-w-0 w-full sm:w-auto">
          <span className="text-sm text-muted-foreground shrink-0">To</span>
          <Input type="date" className="w-full sm:w-[150px] h-9 min-w-0" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={resetFilters}>Clear filters</Button>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">
          {total} {total === 1 ? "entry" : "entries"}
          {isFetching && !isLoading ? " · refreshing…" : ""}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void refetch()}>
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-destructive"
            onClick={handleClearAll}
            disabled={clearing || total === 0}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear all
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : logs.length === 0 ? (
            <p className="text-center text-muted-foreground py-12 text-sm">No emails logged yet</p>
          ) : (
            <div className="divide-y">
              {logs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 p-3 hover:bg-muted/20 transition-colors">
                  {log.status === "sent" ? (
                    <CheckCircle2 className="h-4 w-4 text-[#0088d4] shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  )}
                  <Badge variant="secondary" className="shrink-0 text-[10px] mt-0.5">
                    {typeLabel(log.type)}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{log.recipient}</p>
                    <p className="text-xs text-muted-foreground truncate">{log.subject || "—"}</p>
                    {log.status === "failed" && log.error && (
                      <p className="text-xs text-destructive mt-1 break-words">{log.error}</p>
                    )}
                  </div>
                  {log.status === "failed" && log.resendable && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 h-8 gap-1.5"
                      disabled={resendingId === log.id}
                      onClick={() => void handleResend(log)}
                    >
                      <Send className={cn("h-3.5 w-3.5", resendingId === log.id && "animate-pulse")} />
                      {resendingId === log.id ? "Sending…" : "Resend"}
                    </Button>
                  )}
                  <time className="text-xs text-muted-foreground shrink-0 tabular-nums mt-0.5">
                    {new Date(log.createdAt).toLocaleString()}
                  </time>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(1)}>First</Button>
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>Last</Button>
          </div>
        </div>
      )}
    </div>
  );
}
