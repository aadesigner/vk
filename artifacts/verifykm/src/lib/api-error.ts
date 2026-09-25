/** HTTP status from React Query / customFetch errors when present. */
export function getErrorStatus(error: unknown): number | undefined {
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status: unknown }).status;
    if (typeof status === "number") return status;
  }
  if (error instanceof Error) {
    const fromMessage = /^[a-z_]+:(\d{3})$/i.exec(error.message);
    if (fromMessage) return Number(fromMessage[1]);
  }
  return undefined;
}

export function createClientFetchError(scope: string, status: number): Error & { status: number } {
  return Object.assign(new Error(`${scope}:${status}`), { status });
}

export type VinReportErrorKind = "not_found" | "forbidden" | "unauthorized" | "server" | "rate_limit" | "unknown";

export function classifyVinReportHttpStatus(status: number): VinReportErrorKind {
  if (status === 404) return "not_found";
  if (status === 403) return "forbidden";
  if (status === 401) return "unauthorized";
  if (status === 429) return "rate_limit";
  if (status >= 500) return "server";
  return "unknown";
}

export function createVinReportFetchError(status: number): Error & {
  kind: VinReportErrorKind;
  notFound?: boolean;
  forbidden?: boolean;
  authRequired?: boolean;
  serverError?: boolean;
  rateLimited?: boolean;
  status?: number;
} {
  const kind = classifyVinReportHttpStatus(status);
  return Object.assign(new Error(kind), {
    kind,
    status,
    notFound: kind === "not_found",
    forbidden: kind === "forbidden",
    authRequired: kind === "unauthorized",
    serverError: kind === "server",
    rateLimited: kind === "rate_limit",
  });
}
