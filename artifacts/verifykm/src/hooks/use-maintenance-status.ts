import { useSitePublicFlags } from "@/hooks/use-site-public-flags";
import type { MaintenanceStatus } from "@/lib/maintenance-policy";

/** @deprecated Use useSitePublicFlags — kept for existing imports. */
export function useMaintenanceStatus() {
  const query = useSitePublicFlags();
  return {
    ...query,
    data: query.data
      ? {
          maintenanceMode: query.data.maintenanceMode,
          maintenanceRestrictions: query.data.maintenanceRestrictions,
          maintenanceMessage: query.data.maintenanceMessage,
        } satisfies MaintenanceStatus
      : undefined,
  };
}
