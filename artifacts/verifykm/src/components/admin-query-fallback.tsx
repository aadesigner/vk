import type { ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryRecovery } from "@/hooks/use-query-recovery";
import { queryErrorMessage, showFatalQueryError } from "@/lib/query-error";

type AdminQueryFallbackProps = {
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  error: unknown;
  refetch: () => void | Promise<unknown>;
  hasData?: boolean;
  skeleton?: ReactNode;
  children: ReactNode;
  message?: string;
};

export function AdminQueryFallback({
  isLoading,
  isError,
  isFetching,
  error,
  refetch,
  hasData = false,
  skeleton,
  children,
  message = "Failed to load data",
}: AdminQueryFallbackProps) {
  useQueryRecovery(isError, isFetching, refetch);

  const pending = isLoading && !hasData;
  const showError = showFatalQueryError(isError, isFetching, hasData);

  if (pending) {
    return (
      skeleton ?? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-xl" />
          ))}
        </div>
      )
    );
  }

  if (showError) {
    return (
      <div className="py-12 px-6 text-center space-y-3 rounded-xl border border-destructive/25 bg-destructive/5">
        <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
        <p className="font-medium text-destructive">{queryErrorMessage(error, message)}</p>
        <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
          Retry
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
