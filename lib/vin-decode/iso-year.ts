/**
 * ISO 3779 model-year codes (VIN position 10).
 *
 * Letters/digits repeat every 30 years. We never guess a cycle —
 * a year is returned only when exactly one candidate remains after optional
 * production-window filtering (and excluding impossible future years).
 *
 * Important: VIN position 10 is **model year** (MY), not calendar/manufacture year.
 * A car built in late calendar 2019 as MY2020 correctly decodes as 2020.
 * We never invent a manufacture year, and we never pick a cycle by preference.
 */

/** First-cycle base map: A–Y → 1980–2000, 1–9 → 2001–2009. */
const YEAR_BASE: Record<string, number> = {
  A: 1980, B: 1981, C: 1982, D: 1983, E: 1984,
  F: 1985, G: 1986, H: 1987, J: 1988, K: 1989,
  L: 1990, M: 1991, N: 1992, P: 1993, R: 1994,
  S: 1995, T: 1996, V: 1997, W: 1998, X: 1999, Y: 2000,
  "1": 2001, "2": 2002, "3": 2003, "4": 2004, "5": 2005,
  "6": 2006, "7": 2007, "8": 2008, "9": 2009,
};

export type IsoYearWindow = { from: number; to: number };

/** All ISO cycles for a position-10 code (oldest first). */
export function isoModelYearCandidates(code: string): number[] {
  const upper = code.toUpperCase();
  const base = YEAR_BASE[upper];
  if (base == null) return [];
  const out = [base];
  // Letters A–Y also encode 2010–2030; digits 1–9 also encode 2031–2039.
  if (base <= 2009) out.push(base + 30);
  return out;
}

/**
 * Model years can run slightly ahead of the calendar (e.g. MY2027 cars sold late in 2026).
 * Cap at now+1 so ISO 30-year reuse cannot invent years like 2028 while we are still in 2026.
 */
export function maxPlausibleModelYear(now = new Date().getFullYear()): number {
  return now + 1;
}

/**
 * Resolve a single model year from a position-10 code.
 * Returns null when zero or multiple candidates remain — never pick a cycle by preference.
 *
 * Critical: a production window may confirm the *newer* ISO twin (model did not exist
 * in the older cycle). It must NEVER invent the *older* twin merely because a ceiling
 * excludes the still-plausible newer reading (Typ 16 + B → 1981 while 2011 is live).
 */
export function resolveIsoModelYear(
  code: string,
  window?: IsoYearWindow | null,
  opts?: { now?: number },
): number | null {
  const now = opts?.now ?? new Date().getFullYear();
  const maxY = maxPlausibleModelYear(now);
  const raw = isoModelYearCandidates(code).filter((y) => y >= 1980);
  const plausible = raw.filter((y) => y <= maxY);
  let cands = plausible;
  if (window) {
    cands = cands.filter((y) => y >= window.from && y <= window.to);
  }
  if (cands.length === 1) {
    const only = cands[0]!;
    const upper = code.toUpperCase();
    const isDigitCode = upper >= "1" && upper <= "9";
    // Letters: never collapse to the old twin while a newer twin exists in the raw
    // ISO pair — whether that twin is still calendar-plausible or only beyond now+1.
    // (Bare W → null in 2026; windowed Typ16/B → 1981 would also invent.)
    if (!isDigitCode && raw.length > 1 && only === Math.min(...raw)) {
      return null;
    }
    return only;
  }
  // 0 or 2+ candidates — omit rather than guess.
  return null;
}

/**
 * Pick the unique candidate that satisfies a predicate (e.g. brand year gate).
 * Returns null if zero or multiple candidates match — never first-hit guessing.
 */
export function resolveIsoModelYearWhere(
  code: string,
  pred: (year: number) => boolean,
  now = new Date().getFullYear(),
): number | null {
  const maxY = maxPlausibleModelYear(now);
  const hits = isoModelYearCandidates(code)
    .filter((y) => y >= 1980 && y <= maxY)
    .filter(pred);
  return hits.length === 1 ? hits[0]! : null;
}

/** True when `year` is exactly one of the ISO cycles for this position-10 code (and not future). */
export function isIsoModelYearCandidate(
  code: string,
  year: number,
  opts?: { now?: number },
): boolean {
  if (!Number.isFinite(year)) return false;
  const maxY = maxPlausibleModelYear(opts?.now ?? new Date().getFullYear());
  if (year < 1980 || year > maxY) return false;
  return isoModelYearCandidates(code).includes(year);
}
