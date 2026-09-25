import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ClientQueryError } from "@/components/client-query-error";
import { useQueryRecovery } from "@/hooks/use-query-recovery";
import { showFatalQueryError } from "@/lib/query-error";

type ClientQueryFallbackProps = {
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  hasData: boolean;
  error?: unknown;
  refetch?: () => void | Promise<unknown>;
  skeleton?: ReactNode;
  children: ReactNode;
  className?: string;
};

/**
 * Keeps showing cached content when a background refetch fails (reconnect, poll, tab focus).
 * Only replaces the section with an error when there is no data to display.
 */
export function ClientQueryFallback({
  isLoading,
  isError,
  isFetching,
  hasData,
  error,
  refetch,
  skeleton,
  children,
  className,
}: ClientQueryFallbackProps) {
  useQueryRecovery(isError, isFetching, refetch ?? (() => {}));

  const pending = isLoading && !hasData;
  const showError = showFatalQueryError(isError, isFetching, hasData);

  if (pending) {
    return (
      skeleton ?? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      )
    );
  }

  if (showError) {
    return (
      <ClientQueryError
        error={error}
        onRetry={refetch ? () => void refetch() : undefined}
        isRetrying={isFetching}
        className={className}
      />
    );
  }

  return <>{children}</>;
}
