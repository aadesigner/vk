import type { Request, Response, NextFunction } from "express";
import { getAllowedOrigins } from "./allowedOrigins.js";
import { logger } from "./logger.js";
import { isExemptApiPath, isTrustedApiRequest } from "./trustedClient.js";

export function shouldEnforceClientGuard(): boolean {
  const token = process.env.CLIENT_GUARD_TOKEN?.trim();
  if (!token) return false;
  if (process.env.NODE_ENV === "production") return true;
  return process.env.CLIENT_GUARD_ENFORCE === "true";
}

export function clientGuard(req: Request, res: Response, next: NextFunction): void {
  if (req.method === "OPTIONS") {
    next();
    return;
  }

  const token = process.env.CLIENT_GUARD_TOKEN?.trim();
  if (!shouldEnforceClientGuard() || !token) {
    next();
    return;
  }

  if (isExemptApiPath(req.path)) {
    next();
    return;
  }

  if (isTrustedApiRequest(req)) {
    next();
    return;
  }

  logger.warn(
    { method: req.method, path: req.path, ip: req.ip },
    "Blocked API request: missing client guard and untrusted origin",
  );
  res.status(403).json({ error: "Forbidden" });
}

// Re-export for route-level limiters
export { isTrustedApiRequest, shouldSkipPublicRateLimit, isExemptApiPath } from "./trustedClient.js";
