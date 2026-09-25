import { useQuery } from "@tanstack/react-query";
import { DEFAULT_KRW_PER_USD, resolveKrwPerUsd } from "@/lib/korean-currency";
import { fetchPublicSettings, PUBLIC_SETTINGS_QUERY_KEY } from "@/lib/public-settings";

export function useKrwPerUsd(): number {
  const { data } = useQuery({
    queryKey: PUBLIC_SETTINGS_QUERY_KEY,
    queryFn: ({ signal }) => fetchPublicSettings(signal),
    select: (d) => resolveKrwPerUsd(
      typeof d.krwPerUsd === "number" ? d.krwPerUsd : DEFAULT_KRW_PER_USD,
    ),
    staleTime: 5 * 60_000,
  });
  return data ?? DEFAULT_KRW_PER_USD;
}
