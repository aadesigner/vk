import type { Request, Response } from "express";
import { getEffectiveSystemSettings } from "./systemSettings.js";
import { isRequestAdmin } from "./requestContextMiddleware.js";

export async function isVinLookupEnabled(): Promise<boolean> {
  const settings = await getEffectiveSystemSettings();
  return settings?.vinLookupEnabled !== false;
}

/** Returns true when the response was sent (request blocked). */
export async function rejectVinLookupIfDisabled(req: Request, res: Response): Promise<boolean> {
  if (isRequestAdmin(req)) return false;
  if (await isVinLookupEnabled()) return false;
  res.status(503).json({
    error: "VIN checking is temporarily unavailable. Please try again later.",
    code: "VIN_LOOKUP_DISABLED",
  });
  return true;
}
