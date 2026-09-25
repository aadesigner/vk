/** Build the list of browser origins allowed to call this API (CORS + client guard). */
export function getAllowedOrigins(): string[] {
  const extra = process.env.CORS_ORIGIN ?? "";
  const siteUrl = process.env.SITE_URL ?? "";
  const list: string[] = [];

  for (const d of [...extra.split(","), siteUrl]) {
    const trimmed = d.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      list.push(trimmed.replace(/\/+$/, ""));
    } else {
      list.push(`https://${trimmed.replace(/\/+$/, "")}`);
    }
  }

  if (list.length === 0) {
    list.push("http://localhost:3000", "http://localhost:5173");
  }

  return [...new Set(list)];
}

function normalizeOrigin(origin: string): string {
  return origin.replace(/\/+$/, "");
}

/** Tailscale (100.64/10), RFC1918, and localhost — for mobile/LAN dev access. */
function isDevNetworkOrigin(origin: string): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.CORS_ALLOW_LAN === "false") return false;

  try {
    const { protocol, hostname } = new URL(origin);
    if (protocol !== "http:" && protocol !== "https:") return false;

    if (
      hostname === "localhost"
      || hostname === "127.0.0.1"
      || hostname === "[::1]"
      || hostname === "::1"
      || hostname.endsWith(".ts.net")
    ) {
      return true;
    }

    const parts = hostname.split(".").map((p) => Number(p));
    if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) {
      return false;
    }

    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    // Tailscale CGNAT range 100.64.0.0/10
    if (a === 100 && b >= 64 && b <= 127) return true;

    return false;
  } catch {
    return false;
  }
}

/** True when a browser Origin (or Referer origin) may call this API. */
export function isAllowedOrigin(origin: string): boolean {
  const normalized = normalizeOrigin(origin);
  if (getAllowedOrigins().includes(normalized)) return true;
  return isDevNetworkOrigin(normalized);
}

export function resolveBrowserOrigin(headers: {
  origin?: string | string[];
  referer?: string | string[];
}): string | null {
  const rawOrigin = Array.isArray(headers.origin) ? headers.origin[0] : headers.origin;
  if (rawOrigin?.trim()) return normalizeOrigin(rawOrigin.trim());

  const rawReferer = Array.isArray(headers.referer) ? headers.referer[0] : headers.referer;
  if (rawReferer?.trim()) {
    try {
      const u = new URL(rawReferer.trim());
      return normalizeOrigin(`${u.protocol}//${u.host}`);
    } catch {
      return null;
    }
  }
  return null;
}

/** Skip reCAPTCHA on LAN / Tailscale in development — Google keys are domain-bound. */
export function isRecaptchaRelaxedForRequest(req?: {
  headers?: {
    origin?: string | string[];
    referer?: string | string[];
    host?: string;
    "x-forwarded-host"?: string | string[];
  };
}): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.RECAPTCHA_FORCE === "true") return false;

  const origin = req?.headers ? resolveBrowserOrigin(req.headers) : null;
  if (origin && isDevNetworkOrigin(origin)) return true;

  // Same-origin browser requests via Vite proxy often omit Origin; Referer may be stripped too.
  const rawHost = req?.headers?.["x-forwarded-host"] ?? req?.headers?.host;
  const host = (Array.isArray(rawHost) ? rawHost[0] : rawHost)?.split(",")[0]?.trim().toLowerCase() ?? "";
  if (host) {
    const hostname = host.includes(":") ? host.slice(0, host.lastIndexOf(":")) : host;
    if (
      hostname === "localhost"
      || hostname === "127.0.0.1"
      || hostname.endsWith(".ts.net")
      || /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)
      || /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)
      || /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d{1,3}\.\d{1,3}$/.test(hostname)
    ) {
      return true;
    }
  }

  return false;
}
