/** Fields required by dashboard history cards — omit full report payload. */
export function summarizeVinLookupData(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const d = data as Record<string, unknown>;

  const photoList = Array.isArray(d.photos)
    ? d.photos.filter((p): p is string => typeof p === "string" && p.length > 0)
    : [];
  const thumbnail =
    typeof d.thumbnailUrl === "string" && d.thumbnailUrl.length > 0 ? d.thumbnailUrl : null;
  const photos = (photoList.length > 0 ? photoList : thumbnail ? [thumbnail] : []).slice(0, 1);

  const mileageHistory = Array.isArray(d.mileageHistory)
    ? d.mileageHistory.slice(0, 20).map((entry) => {
        const e = entry as Record<string, unknown>;
        return {
          date: e.date ?? null,
          odometer: e.odometer ?? e.mileage ?? null,
          mileage: e.mileage ?? null,
        };
      })
    : undefined;

  const ownerHistory = Array.isArray(d.ownerHistory)
    ? d.ownerHistory.slice(0, 20).map((entry) => {
        const e = entry as Record<string, unknown>;
        return { date: e.date ?? null, mileage: e.mileage ?? null };
      })
    : undefined;

  const registryHistory = Array.isArray(d.registryHistory)
    ? d.registryHistory.slice(0, 40).map((entry) => {
        const e = entry as Record<string, unknown>;
        return {
          type: e.type ?? null,
          title: e.title ?? null,
          subtitle: e.subtitle ?? null,
          amount: e.amount ?? null,
          mileage: e.mileage ?? null,
          details: Array.isArray(e.details)
            ? e.details.slice(0, 8).map((row) => {
                const r = row as Record<string, unknown>;
                return { label: r.label ?? null, value: r.value ?? null };
              })
            : null,
        };
      })
    : undefined;

  const accidents = Array.isArray(d.accidents)
    ? d.accidents.slice(0, 40).map((entry) => {
        const e = entry as Record<string, unknown>;
        return {
          severity: e.severity ?? null,
          date: e.date ?? null,
          type: e.type ?? null,
          description: e.description ?? null,
          lossAmount: e.lossAmount ?? null,
        };
      })
    : undefined;

  const insuranceClaims = Array.isArray(d.insuranceClaims)
    ? d.insuranceClaims.slice(0, 40).map((entry) => {
        const e = entry as Record<string, unknown>;
        return {
          date: e.date ?? null,
          type: e.type ?? null,
          lossAmount: e.lossAmount ?? null,
        };
      })
    : undefined;

  return {
    make: d.make ?? null,
    model: d.model ?? null,
    year: d.year ?? null,
    odometer: d.odometer ?? null,
    odometerLocked: d.odometerLocked === true ? true : undefined,
    accidentCount: d.accidentCount ?? null,
    isSalvage: d.isSalvage ?? null,
    photos,
    mileageHistory,
    ownerHistory,
    registryHistory,
    accidents,
    insuranceClaims,
  };
}
