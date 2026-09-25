import type { VinHistoryPage } from "@workspace/api-client-react";
import { createClientFetchError } from "@/lib/api-error";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export type UserHistoryView = "full" | "summary";

export type UserHistoryParams = {
  page?: number;
  limit?: number;
  view?: UserHistoryView;
};

export function userHistoryQueryKey(params: UserHistoryParams = {}) {
  return ["/api/user/history", params] as const;
}

export async function fetchUserHistory(
  params: UserHistoryParams = {},
  signal?: AbortSignal,
): Promise<VinHistoryPage> {
  const qs = new URLSearchParams();
  if (params.page != null) qs.set("page", String(params.page));
  if (params.limit != null) qs.set("limit", String(params.limit));
  if (params.view === "summary") qs.set("view", "summary");

  const suffix = qs.toString();
  const r = await fetch(
    `${basePath}/api/user/history${suffix ? `?${suffix}` : ""}`,
    { credentials: "include", signal },
  );
  if (!r.ok) throw createClientFetchError("history", r.status);
  return r.json() as Promise<VinHistoryPage>;
}

/** Default list query — one dashboard page of lightweight rows. */
export const DEFAULT_USER_HISTORY_SUMMARY: UserHistoryParams = {
  page: 1,
  limit: 12,
  view: "summary",
};
