/** Paths that must stay reachable while access blocks are active. */
export function isExemptAccessBlockPath(path: string): boolean {
  const p = path.split("?")[0] ?? path;
  if (p === "/healthz") return true;
  if (p.startsWith("/admin/")) return true;
  if (p === "/plugins/geo-language") return true;
  return false;
}
