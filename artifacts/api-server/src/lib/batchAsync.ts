/** Run async work in fixed-size chunks to avoid unbounded Promise.all fan-out. */
export async function mapInBatches<T>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  const size = Math.max(1, batchSize);
  for (let i = 0; i < items.length; i += size) {
    const chunk = items.slice(i, i + size);
    await Promise.all(chunk.map((item) => fn(item)));
  }
}

/** Let other HTTP work run between CPU-heavy sync steps on the event loop. */
export function yieldEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

/**
 * Limit how many async jobs run at once; extras wait FIFO.
 * Does not change job outcomes — only caps parallel load on one process.
 */
export function createConcurrencyLimiter(max: number) {
  let active = 0;
  const queue: Array<() => void> = [];
  const limit = Math.max(1, max);

  return {
    async run<T>(fn: () => Promise<T>): Promise<T> {
      if (active >= limit) {
        await new Promise<void>((resolve) => {
          queue.push(resolve);
        });
      }
      active += 1;
      try {
        return await fn();
      } finally {
        active -= 1;
        const next = queue.shift();
        if (next) next();
      }
    },
  };
}
