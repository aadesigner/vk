import type { Request, Response, NextFunction } from "express";
import {
  checkAccessBlock,
  resolveBlockCountryFromRequest,
  resolveBlockDeviceFromRequest,
  resolveBlockIpFromRequest,
} from "./accessBlocks.js";
import { isExemptAccessBlockPath } from "./accessBlockPolicy.js";

export async function accessBlockMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (isExemptAccessBlockPath(req.path)) {
    next();
    return;
  }

  if (req.isAdmin) {
    next();
    return;
  }

  const ip = resolveBlockIpFromRequest(req);
  const country = resolveBlockCountryFromRequest(req);
  const device = resolveBlockDeviceFromRequest(req);
  const result = await checkAccessBlock(ip, country, device);

  if (result.blocked) {
    const message =
      result.reason === "country"
        ? "Access from your region is not permitted."
        : result.reason === "device"
          ? "Access from this device is not permitted."
          : "Access from your network is not permitted.";
    res.status(403).json({
      error: message,
      code:
        result.reason === "country"
          ? "country_blocked"
          : result.reason === "device"
            ? "device_blocked"
            : "ip_blocked",
    });
    return;
  }

  next();
}
