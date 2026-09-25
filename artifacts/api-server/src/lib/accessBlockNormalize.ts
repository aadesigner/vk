export function normalizeBlockedIp(raw: string): string | null {
  let trimmed = String(raw ?? "").trim().replace(/^::ffff:/i, "");
  if (!trimmed || trimmed === "unknown") return null;

  // [::1] or [2001:db8::1]:443
  if (trimmed.startsWith("[")) {
    const end = trimmed.indexOf("]");
    if (end > 1) trimmed = trimmed.slice(1, end);
  }

  // Drop host:port for IPv4 (1.2.3.4:1234) — not for IPv6.
  if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(trimmed)) {
    trimmed = trimmed.replace(/:\d+$/, "");
  }

  // express-rate-limit ipKeyGenerator may return an IPv6 CIDR key (e.g. 2001:db8::/64).
  const m = trimmed.match(/^([0-9a-f:.]+)(\/\d{1,3})?$/i);
  if (!m) return null;
  const base = m[1]!;
  const cidr = m[2] ?? "";
  const ipv4 = /^(?:\d{1,3}\.){3}\d{1,3}$/;
  const ipv6 = /^[0-9a-f:]+$/i;
  if (!ipv4.test(base) && !ipv6.test(base)) return null;
  return `${base}${cidr}`.toLowerCase();
}

export function normalizeBlockedCountry(raw: string): string | null {
  const code = raw.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code) || code === "XX" || code === "T1") return null;
  return code;
}

/** SHA-256 hex of the device cookie (64 chars). */
export function normalizeBlockedDevice(raw: string): string | null {
  const v = raw.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(v)) return null;
  return v;
}
