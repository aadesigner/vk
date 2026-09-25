import type { Request, Response, NextFunction } from "express";
import { getSettings } from "./settingsCache.js";
import {
  isApiPathUnderMaintenance,
  isExemptMaintenanceApiPath,
  type MaintenanceState,
} from "./maintenancePolicy.js";

function maintenanceActive(state: MaintenanceState): boolean {
  return state.maintenanceMode || state.maintenanceRestrictions.length > 0;
}

export async function maintenanceMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const settings = await getSettings();
  const state: MaintenanceState = {
    maintenanceMode: settings.maintenanceMode,
    maintenanceRestrictions: settings.maintenanceRestrictions,
    maintenanceMessage: settings.maintenanceMessage,
  };

  if (!maintenanceActive(state)) {
    next();
    return;
  }

  if (isExemptMaintenanceApiPath(req.path)) {
    next();
    return;
  }

  if (req.isAdmin) {
    next();
    return;
  }

  if (!isApiPathUnderMaintenance(req.path, state)) {
    next();
    return;
  }

  const restriction = state.maintenanceMode ? "full_site" : (state.maintenanceRestrictions[0] ?? null);
  res.status(503).json({
    error: "Service temporarily unavailable for maintenance.",
    code: "MAINTENANCE",
    restriction,
    message: state.maintenanceMessage,
  });
}
