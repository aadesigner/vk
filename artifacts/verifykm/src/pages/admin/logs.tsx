import { useState } from "react";
import { useAdminGetLogs, AdminGetLogsLevel } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";

const LEVEL_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  info: "secondary",
  warn: "outline",
  error: "destructive",
};

const LEVEL_COLORS: Record<string, string> = {
  info: "text-blue-600",
  warn: "text-yellow-600",
  error: "text-red-600",
};

export default function AdminLogs() {
  const [page, setPage] = useState(1);
  const [level, setLevel] = useState<"all" | AdminGetLogsLevel>("all");
  const [messageSearch, setMessageSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const limit = 50;

  const { data, isLoading, refetch } = useAdminGetLogs({
    page,
    limit,
    level: level === "all" ? undefined : level,
    message: messageSearch || undefined,
    from: from || undefined,
    to: to || undefined,
  });

  const logs = data?.items ?? [];
  const totalPages = data ? Math.ceil(data.total / limit) : 1;

  const hasActiveFilters = level !== "all" || messageSearch || from || to;

  function resetFilters() {
    setLevel("all");
    setMessageSearch("");
    setFrom("");
    setTo("");
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">System Logs</h1>
          <p className="text-muted-foreground mt-1">{data?.total ?? 0} total entries</p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>Refresh</Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-stretch sm:items-end min-w-0">
        <div className="relative flex-1 min-w-0 w-full sm:min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search messages..."
            className="pl-9"
            value={messageSearch}
            onChange={(e) => { setMessageSearch(e.target.value); setPage(1); }}
          />
        </div>

        <Select
          value={level}
          onValueChange={(v) => { setLevel(v as "all" | AdminGetLogsLevel); setPage(1); }}
        >
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue placeholder="Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All levels</SelectItem>
            <SelectItem value={AdminGetLogsLevel.info}>Info</SelectItem>
            <SelectItem value={AdminGetLogsLevel.warn}>Warn</SelectItem>
            <SelectItem value={AdminGetLogsLevel.error}>Error</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1.5 min-w-0 w-full sm:w-auto">
          <span className="text-sm text-muted-foreground whitespace-nowrap shrink-0">From</span>
          <Input
            type="date"
            className="w-full sm:w-[160px] min-w-0"
            value={from}
            onChange={(e) => { setFrom(e.target.value); setPage(1); }}
          />
        </div>

        <div className="flex items-center gap-1.5 min-w-0 w-full sm:w-auto">
          <span className="text-sm text-muted-foreground whitespace-nowrap shrink-0">To</span>
          <Input
            type="date"
            className="w-full sm:w-[160px] min-w-0"
            value={to}
            onChange={(e) => { setTo(e.target.value); setPage(1); }}
          />
        </div>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Clear filters
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
            </div>
          ) : logs.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">No logs found</p>
          ) : (
            <div className="divide-y">
              {logs.map((log) => {
                let contextData: unknown = null;
                if (log.context) {
                  try { contextData = JSON.parse(log.context); } catch { contextData = log.context; }
                }
                return (
                  <div key={log.id} className="flex items-start gap-4 p-4 hover:bg-muted/20 transition-colors">
                    <Badge
                      variant={LEVEL_VARIANTS[log.level] ?? "secondary"}
                      className={`shrink-0 text-xs w-14 justify-center ${LEVEL_COLORS[log.level] ?? ""}`}
                    >
                      {log.level}
                    </Badge>
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-sm font-medium leading-tight">{log.message}</p>
                      {contextData !== null && (
                        <pre className="text-xs text-muted-foreground font-mono bg-muted rounded p-2 overflow-auto max-h-24">
                          {typeof contextData === "string" ? contextData : JSON.stringify(contextData, null, 2)}
                        </pre>
                      )}
                    </div>
                    <time className="text-xs text-muted-foreground shrink-0 tabular-nums">
                      {new Date(log.createdAt).toLocaleString()}
                    </time>
                  </div>
                );
              })}
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
    </div>
  );
}
