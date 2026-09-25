/** Normalize and validate a Google Tag Manager container ID (GTM-XXXXXXX). */
export function normalizeGtmContainerId(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const id = raw.trim().toUpperCase();
  if (!id) return null;
  return /^GTM-[A-Z0-9]+$/.test(id) ? id : null;
}

/** Normalize and validate a Google Analytics measurement ID (G-XXX or legacy UA-XXX). */
export function normalizeGaMeasurementId(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const id = raw.trim().toUpperCase();
  if (!id) return null;
  if (/^G-[A-Z0-9]+$/.test(id)) return id;
  if (/^UA-\d+-\d+$/.test(id)) return id;
  return null;
}

/** Normalize and validate a Microsoft Clarity project ID (e.g. xltusyn0a9). */
export function normalizeClarityProjectId(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const id = raw.trim().toLowerCase();
  if (!id) return null;
  return /^[a-z0-9]{5,32}$/.test(id) ? id : null;
}

/** Normalize and validate a Meta (Facebook) Pixel ID (numeric). */
export function normalizeMetaPixelId(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const id = raw.trim();
  if (!id) return null;
  return /^\d{5,20}$/.test(id) ? id : null;
}

/** Resolve Clarity project ID from DB settings or Railway/env fallback. */
export function resolveClarityProjectId(
  settings: { analyticsClarityProjectId?: string | null } | null | undefined,
): string | null {
  const fromDb = normalizeClarityProjectId(settings?.analyticsClarityProjectId);
  if (fromDb) return fromDb;
  return normalizeClarityProjectId(process.env.CLARITY_PROJECT_ID);
}

export function validateAnalyticsSettingsPatch(patch: Record<string, unknown>): string | null {
  if ("analyticsGtmContainerId" in patch) {
    const raw = patch.analyticsGtmContainerId;
    if (raw == null || raw === "") {
      patch.analyticsGtmContainerId = null;
    } else {
      const normalized = normalizeGtmContainerId(String(raw));
      if (!normalized) {
        return "analyticsGtmContainerId must be a valid GTM container ID (e.g. GTM-XXXXXXX)";
      }
      patch.analyticsGtmContainerId = normalized;
    }
  }

  if ("analyticsGaMeasurementId" in patch) {
    const raw = patch.analyticsGaMeasurementId;
    if (raw == null || raw === "") {
      patch.analyticsGaMeasurementId = null;
    } else {
      const normalized = normalizeGaMeasurementId(String(raw));
      if (!normalized) {
        return "analyticsGaMeasurementId must be a valid GA4 (G-XXXXXXXX) or Universal Analytics (UA-XXXXXX-X) ID";
      }
      patch.analyticsGaMeasurementId = normalized;
    }
  }

  if ("analyticsClarityProjectId" in patch) {
    const raw = patch.analyticsClarityProjectId;
    if (raw == null || raw === "") {
      patch.analyticsClarityProjectId = null;
    } else {
      const normalized = normalizeClarityProjectId(String(raw));
      if (!normalized) {
        return "analyticsClarityProjectId must be a valid Clarity project ID (5–32 letters or digits)";
      }
      patch.analyticsClarityProjectId = normalized;
    }
  }

  if ("analyticsMetaPixelId" in patch) {
    const raw = patch.analyticsMetaPixelId;
    if (raw == null || raw === "") {
      patch.analyticsMetaPixelId = null;
    } else {
      const normalized = normalizeMetaPixelId(String(raw));
      if (!normalized) {
        return "analyticsMetaPixelId must be a valid Meta Pixel ID (5–20 digits)";
      }
      patch.analyticsMetaPixelId = normalized;
    }
  }

  if (patch.analyticsGtmEnabled === true && patch.analyticsGtmContainerId === null) {
    return "Enable GTM only when a container ID is set";
  }

  if (patch.analyticsGaEnabled === true && patch.analyticsGaMeasurementId === null) {
    return "Enable Google Analytics only when a measurement ID is set";
  }

  if (patch.analyticsClarityEnabled === true && patch.analyticsClarityProjectId === null) {
    const envId = normalizeClarityProjectId(process.env.CLARITY_PROJECT_ID);
    if (!envId) {
      return "Enable Microsoft Clarity only when a project ID is set";
    }
  }

  if (patch.analyticsMetaPixelEnabled === true && patch.analyticsMetaPixelId === null) {
    return "Enable Meta Pixel only when a Pixel ID is set";
  }

  return null;
}

/** Validate enabled flags against final merged settings (patch + existing row). */
export function validateAnalyticsSettingsMerged(
  patch: Record<string, unknown>,
  existing: {
    analyticsGtmEnabled?: boolean;
    analyticsGtmContainerId?: string | null;
    analyticsGaEnabled?: boolean;
    analyticsGaMeasurementId?: string | null;
    analyticsClarityEnabled?: boolean;
    analyticsClarityProjectId?: string | null;
    analyticsMetaPixelEnabled?: boolean;
    analyticsMetaPixelId?: string | null;
  } | null | undefined,
): string | null {
  const gtmEnabled = "analyticsGtmEnabled" in patch
    ? patch.analyticsGtmEnabled
    : existing?.analyticsGtmEnabled;
  const gtmId = "analyticsGtmContainerId" in patch
    ? patch.analyticsGtmContainerId
    : existing?.analyticsGtmContainerId;
  const gaEnabled = "analyticsGaEnabled" in patch
    ? patch.analyticsGaEnabled
    : existing?.analyticsGaEnabled;
  const gaId = "analyticsGaMeasurementId" in patch
    ? patch.analyticsGaMeasurementId
    : existing?.analyticsGaMeasurementId;

  const clarityEnabled = "analyticsClarityEnabled" in patch
    ? patch.analyticsClarityEnabled
    : existing?.analyticsClarityEnabled;
  const clarityIdFromPatch = "analyticsClarityProjectId" in patch
    ? patch.analyticsClarityProjectId
    : existing?.analyticsClarityProjectId;
  const clarityId = resolveClarityProjectId({ analyticsClarityProjectId: clarityIdFromPatch as string | null | undefined });

  const metaEnabled = "analyticsMetaPixelEnabled" in patch
    ? patch.analyticsMetaPixelEnabled
    : existing?.analyticsMetaPixelEnabled;
  const metaId = "analyticsMetaPixelId" in patch
    ? patch.analyticsMetaPixelId
    : existing?.analyticsMetaPixelId;

  if (gtmEnabled && !gtmId) {
    return "Google Tag Manager requires a container ID (GTM-XXXXXXX)";
  }
  if (gaEnabled && !gaId) {
    return "Google Analytics requires a measurement ID (G-XXXXXXXXXX)";
  }
  if (clarityEnabled && !clarityId) {
    return "Microsoft Clarity requires a project ID";
  }
  if (metaEnabled && !metaId) {
    return "Meta Pixel requires a Pixel ID";
  }
  return null;
}
