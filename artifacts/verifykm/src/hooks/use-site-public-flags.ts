import { useQuery } from "@tanstack/react-query";
import type { MaintenanceStatus } from "@/lib/maintenance-policy";
import {
  fetchPublicSettings,
  PUBLIC_SETTINGS_QUERY_KEY,
  type PublicSettingsPayload,
} from "@/lib/public-settings";

export type SitePublicFlags = MaintenanceStatus & {
  vinLookupEnabled: boolean;
};

function parsePublicSettings(d: PublicSettingsPayload): SitePublicFlags {
  return {
    maintenanceMode: !!d.maintenanceMode,
    maintenanceRestrictions: Array.isArray(d.maintenanceRestrictions)
      ? d.maintenanceRestrictions.filter((x): x is SitePublicFlags["maintenanceRestrictions"][number] =>
        x === "free_decoder" || x === "checkout" || x === "vin_reports")
      : [],
    maintenanceMessage: typeof d.maintenanceMessage === "string" && d.maintenanceMessage.trim()
      ? d.maintenanceMessage.trim()
      : null,
    vinLookupEnabled: d.vinLookupEnabled !== false,
  };
}

export function useSitePublicFlags() {
  return useQuery({
    queryKey: PUBLIC_SETTINGS_QUERY_KEY,
    queryFn: ({ signal }) => fetchPublicSettings(signal),
    select: parsePublicSettings,
    staleTime: 60_000,
    refetchInterval: () => (typeof document !== "undefined" && document.hidden ? false : 300_000),
    refetchIntervalInBackground: false,
  });
}

/** True when paid VIN check / checkout should be blocked for non-admins. */
export function useVinLookupDisabledForUser(isAdmin?: boolean): boolean {
  const { data } = useSitePublicFlags();
  if (isAdmin) return false;
  return data?.vinLookupEnabled === false;
}
