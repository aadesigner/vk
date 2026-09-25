/** Admin app lives under /adminx — never counted as public presence. */
const ADMIN_PRESENCE_PREFIX = "/adminx";

export function isAdminPresencePath(path: string): boolean {
  return path === ADMIN_PRESENCE_PREFIX || path.startsWith(`${ADMIN_PRESENCE_PREFIX}/`);
}

/** Only signed-in users on the public site (not admin area) update presence. */
export function isTrackablePresencePath(path: string | null | undefined): boolean {
  if (!path) return false;
  return !isAdminPresencePath(path);
}
