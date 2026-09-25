import type { VinLookup } from "@workspace/api-client-react";

/** Show sort/filter controls when the user has more than 3 reports. */
export const DASHBOARD_FILTER_THRESHOLD = 4;

export type DashboardLookupSort =
  | "newest"
  | "oldest"
  | "year_desc"
  | "year_asc";

export function sortDashboardLookups(
  lookups: VinLookup[],
  sort: DashboardLookupSort,
): VinLookup[] {
  const copy = [...lookups];

  switch (sort) {
    case "newest":
      return copy.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    case "oldest":
      return copy.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    case "year_desc":
      return copy.sort((a, b) => {
        const yearDiff = (b.data?.year ?? 0) - (a.data?.year ?? 0);
        if (yearDiff !== 0) return yearDiff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    case "year_asc":
      return copy.sort((a, b) => {
        const ay = a.data?.year;
        const by = b.data?.year;
        if (ay == null && by == null) return 0;
        if (ay == null) return 1;
        if (by == null) return -1;
        const yearDiff = ay - by;
        if (yearDiff !== 0) return yearDiff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    default:
      return copy;
  }
}
