import { QueryClient } from "@tanstack/react-query";
import { getErrorStatus } from "@/lib/api-error";

function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= 3) return false;
  const status = getErrorStatus(error);
  if (status === 401 || status === 403 || status === 404 || status === 429) return false;
  if (status && status >= 400 && status < 500) return false;
  return true;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10 * 60_000,
      gcTime: 60 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: shouldRetryQuery,
    },
    mutations: {
      retry: 0,
    },
  },
});
