import { type ReactNode } from "react";
import { Redirect, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useMaintenanceStatus } from "@/hooks/use-maintenance-status";
import {
  extractLangFromPath,
  isFrontendUnderMaintenance,
  isMaintenanceExemptPath,
} from "@/lib/maintenance-policy";

export function MaintenanceGuard({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, isLoaded } = useAuth();
  const { data: status, isLoading: statusLoading } = useMaintenanceStatus();

  if (!isLoaded || statusLoading) return children;
  if (user?.isAdmin) return children;
  if (isMaintenanceExemptPath(location)) return children;

  const blocked = isFrontendUnderMaintenance(location, status);
  if (!blocked) return children;

  const lang = extractLangFromPath(location);
  const qs = new URLSearchParams({ feature: blocked });
  return <Redirect to={`/${lang}/maintenance?${qs.toString()}`} />;
}
