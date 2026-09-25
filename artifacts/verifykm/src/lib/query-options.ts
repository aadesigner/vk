import type { UseQueryOptions } from "@tanstack/react-query";

/** Fields commonly shared across queries — kept separate from full UseQueryOptions to avoid polluting spreads. */
export interface SharedQueryExtras {
  staleTime?: number;
  gcTime?: number;
  refetchOnWindowFocus?: boolean;
  refetchOnMount?: boolean | "always";
  refetchOnReconnect?: boolean;
  retry?: boolean | number | ((failureCount: number, error: unknown) => boolean);
  refetchInterval?: number | false;
  refetchIntervalInBackground?: boolean;
}

/** Partial overrides for orval-generated hooks (they supply queryKey + queryFn). */
export function orvalQuery<TData, TError = unknown>(
  extras: SharedQueryExtras,
): UseQueryOptions<TData, TError> {
  return extras as unknown as UseQueryOptions<TData, TError>;
}

/** Spread shared timing/retry options into a typed useQuery call. */
export function spreadQueryExtras<TData, TError = unknown>(
  extras: SharedQueryExtras,
): Pick<UseQueryOptions<TData, TError>, keyof SharedQueryExtras> {
  return extras as Pick<UseQueryOptions<TData, TError>, keyof SharedQueryExtras>;
}

/** Marketing / legal pages — pricing, countries, etc. Rarely changes. */
export const STATIC_QUERY_OPTIONS: SharedQueryExtras = {
  staleTime: 30 * 60 * 1000,
  gcTime: 2 * 60 * 60 * 1000,
  refetchOnWindowFocus: false,
  refetchOnMount: false,
  refetchOnReconnect: false,
};

/**
 * Signed-in client area (dashboard / purchases).
 * Always refetch on mount so admin removals (e.g. pending VIN deleted) show up
 * immediately instead of a stale React Query cache.
 */
export const CLIENT_AREA_QUERY_OPTIONS: SharedQueryExtras = {
  staleTime: 0,
  gcTime: 10 * 60 * 1000,
  refetchOnWindowFocus: true,
  refetchOnMount: "always",
  refetchOnReconnect: true,
};

/** @deprecated Use CLIENT_AREA_QUERY_OPTIONS */
export const AUTH_QUERY_OPTIONS = CLIENT_AREA_QUERY_OPTIONS;

/** Checkout / payment — always verify live before charging. */
export const CHECKOUT_QUERY_OPTIONS: SharedQueryExtras = {
  staleTime: 0,
  gcTime: 5 * 60 * 1000,
  refetchOnWindowFocus: true,
  refetchOnMount: "always",
  refetchOnReconnect: true,
};
