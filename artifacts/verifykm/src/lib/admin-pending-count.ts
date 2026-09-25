const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export const ADMIN_PENDING_COUNT_QUERY_KEY = ["/api/admin/pending-vin-checks/count"] as const;

export type AdminPendingCount = { open: number };

export async function fetchAdminPendingCount(
  signal?: AbortSignal,
): Promise<AdminPendingCount> {
  const r = await fetch(`${basePath}/api/admin/pending-vin-checks/count`, {
    credentials: "include",
    signal,
  });
  if (!r.ok) {
    throw new Error(`Pending count failed (${r.status})`);
  }
  const data = (await r.json()) as { open?: unknown };
  const open = typeof data.open === "number" && Number.isFinite(data.open) ? data.open : 0;
  return { open };
}
