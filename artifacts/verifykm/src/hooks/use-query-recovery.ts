import { useEffect, useRef } from "react";

/**
 * Fire one silent refetch after a query error (cold start / brief API blips).
 * Pair with {@link showQueryFailure} so the error UI stays hidden until recovery finishes.
 */
export function useQueryRecovery(
  isError: boolean,
  isFetching: boolean,
  refetch: () => void | Promise<unknown>,
): void {
  const recovered = useRef(false);

  useEffect(() => {
    if (!isError) {
      recovered.current = false;
      return;
    }
    if (isFetching || recovered.current) return;
    recovered.current = true;
    const id = window.setTimeout(() => {
      void refetch();
    }, 400);
    return () => window.clearTimeout(id);
  }, [isError, isFetching, refetch]);
}
