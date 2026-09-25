const GUARD_HEADER = "x-verifykm-client";

function resolveUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function isLocalApiRequest(url: string): boolean {
  if (url.startsWith("/api/") || url === "/api") return true;
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.origin === window.location.origin && parsed.pathname.startsWith("/api");
  } catch {
    return false;
  }
}

/** Attach X-Verifykm-Client to all same-origin /api fetch calls (covers raw fetch() outside the API client). */
export function installFetchGuard(token: string | undefined): void {
  const secret = token?.trim();
  if (!secret) return;

  const nativeFetch = window.fetch.bind(window);

  window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = resolveUrl(input);
    if (!isLocalApiRequest(url)) return nativeFetch(input, init);

    if (input instanceof Request) {
      const headers = new Headers(input.headers);
      if (!headers.has(GUARD_HEADER)) headers.set(GUARD_HEADER, secret);
      const req = new Request(input, { headers });
      return nativeFetch(req, init);
    }

    const headers = new Headers(init?.headers);
    if (!headers.has(GUARD_HEADER)) headers.set(GUARD_HEADER, secret);
    return nativeFetch(input, { ...init, headers });
  };
}
