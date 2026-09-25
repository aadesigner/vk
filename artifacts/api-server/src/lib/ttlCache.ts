export interface TtlCache<T> {
  getOrFetch: (fetcher: () => Promise<T>) => Promise<T>;
  invalidate: () => void;
}

export function makeTtlCache<T>(ttlMs: number): TtlCache<T> {
  let stored: T | undefined;
  let expires = 0;
  let inflight: Promise<T> | null = null;

  return {
    async getOrFetch(fetcher: () => Promise<T>): Promise<T> {
      if (stored !== undefined && Date.now() < expires) return stored;
      if (!inflight) {
        inflight = fetcher()
          .then((data) => {
            stored = data;
            expires = Date.now() + ttlMs;
            inflight = null;
            return data;
          })
          .catch((err) => {
            inflight = null;
            throw err;
          });
      }
      return inflight;
    },
    invalidate() {
      stored = undefined;
      expires = 0;
    },
  };
}
