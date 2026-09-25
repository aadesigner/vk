export type PrefixRule = {
  prefix: string;
  model: string;
  body?: string;
  drive?: string;
  chassis?: string;
  /** Verified production window — used to resolve ISO year without cycle guessing. */
  yearFrom?: number;
  yearTo?: number;
};

/** Pre-sort once at module load — avoids per-decode sorting cost. */
export function compilePrefixRules<T extends PrefixRule>(rules: T[]): T[] {
  return [...rules].sort((a, b) => b.prefix.length - a.prefix.length);
}

export function matchLongestPrefix(vin: string, rules: readonly PrefixRule[]): PrefixRule | null {
  for (const rule of rules) {
    if (vin.startsWith(rule.prefix)) return rule;
  }
  return null;
}
