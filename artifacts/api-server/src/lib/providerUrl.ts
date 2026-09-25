/** Block SSRF-prone provider hosts (private networks, metadata, localhost). */
export function isBlockedProviderHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host) return true;
  if (
    host === "localhost"
    || host.endsWith(".localhost")
    || host.endsWith(".local")
    || host.endsWith(".internal")
    || host === "metadata.google.internal"
    || host === "metadata"
  ) {
    return true;
  }
  if (host === "::1" || host === "0:0:0:0:0:0:0:1") return true;
  if (host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) return true;

  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4) return false;
  const octets = ipv4.slice(1, 5).map((n) => Number(n));
  if (octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = octets;
  if (a === 127 || a === 0) return true;
  if (a === 10) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

export function validateProviderBaseUrl(raw: string): { ok: true; normalized: string } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: "Provider URL is required" };

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: "Invalid provider URL" };
  }

  if (parsed.username || parsed.password) {
    return { ok: false, error: "Provider URL must not include credentials" };
  }

  const allowHttp = process.env.NODE_ENV !== "production";
  if (parsed.protocol !== "https:" && !(allowHttp && parsed.protocol === "http:")) {
    return { ok: false, error: allowHttp ? "Provider URL must use http or https" : "Provider URL must use HTTPS" };
  }

  if (isBlockedProviderHost(parsed.hostname)) {
    return { ok: false, error: "Provider URL points to a blocked host" };
  }

  const normalized = `${parsed.protocol}//${parsed.host}${parsed.pathname.replace(/\/$/, "")}`;
  return { ok: true, normalized };
}

export function assertValidProviderBaseUrl(baseUrl: string): string {
  const result = validateProviderBaseUrl(baseUrl);
  if (!result.ok) throw Object.assign(new Error(result.error), { code: "INVALID_PROVIDER_URL" });
  return result.normalized;
}
