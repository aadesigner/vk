/** Locked public preview signals — counts only, never accident details. */

export const LOCKED_PREVIEW_LANGS = [
  "en", "de", "es", "fr", "sq", "pl", "ro", "bg", "ka", "ar", "uk", "ru", "zh",
] as const;
export type LockedPreviewLang = (typeof LOCKED_PREVIEW_LANGS)[number];

export type LockedPreviewVehicle = {
  vin: string;
  make?: string | null;
  model?: string | null;
  year?: number | null;
};

export type LockedPreviewSignals = {
  /** Mileage history entries (or 1 if only a scalar odometer exists). Never the km value. */
  mileageRecordCount: number;
  /** Owner count from catalog field or ownerHistory length. */
  ownerCount: number;
  insuranceClaimCount: number;
  auctionRecordCount: number;
  registryRecordCount: number;
  /** Flood / water-damage records (count only — never loss amount). */
  floodRecordCount: number;
};

function normalizeVin(vin: string): string {
  return String(vin ?? "").trim().toUpperCase();
}

function vehicleLabel(v: LockedPreviewVehicle): string {
  const vin = normalizeVin(v.vin);
  if (v.make) {
    return [v.year ? String(v.year) : null, v.make, v.model ?? null].filter(Boolean).join(" ");
  }
  return `VIN ${vin}`;
}

function arrayLen(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function positiveInt(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

/**
 * Safe locked-preview counts from catalog/report JSON.
 * Intentionally omits accident / salvage / stolen / odometer values.
 */
export function extractLockedPreviewSignals(
  data: Record<string, unknown> | null | undefined,
): LockedPreviewSignals {
  const d = data ?? {};
  const mileageHistoryLen = arrayLen(d.mileageHistory);
  const hasScalarOdo = d.odometer != null || d.mileage != null;
  const mileageRecordCount =
    mileageHistoryLen > 0 ? mileageHistoryLen : hasScalarOdo ? 1 : 0;

  const ownerFromField =
    positiveInt(d.ownerCount) ?? positiveInt(d.owners);
  const ownerHistoryLen = arrayLen(d.ownerHistory);
  const ownerCount = ownerFromField ?? ownerHistoryLen;

  const floodFlagged = d.isFlooded === true || d.flooded === true;
  const floodFromCount = positiveInt(d.floodCount);
  const floodRecordCount =
    floodFromCount != null && floodFromCount > 0
      ? floodFromCount
      : floodFlagged
        ? 1
        : 0;

  return {
    mileageRecordCount,
    ownerCount,
    insuranceClaimCount: arrayLen(d.insuranceClaims),
    auctionRecordCount: arrayLen(d.auctionHistory),
    registryRecordCount: arrayLen(d.registryHistory),
    floodRecordCount,
  };
}

export function lockedPreviewSignalsHaveFindings(signals: LockedPreviewSignals): boolean {
  return (
    signals.mileageRecordCount > 0
    || signals.ownerCount > 0
    || signals.insuranceClaimCount > 0
    || signals.auctionRecordCount > 0
    || signals.registryRecordCount > 0
    || signals.floodRecordCount > 0
  );
}

const LOCKED_SIGNAL_KEYS = [
  "mileageRecordCount",
  "ownerCount",
  "insuranceClaimCount",
  "auctionRecordCount",
  "registryRecordCount",
  "floodRecordCount",
] as const;

/** Max count exposed publicly — avoids odd overflow / fingerprinting noise. */
const LOCKED_SIGNAL_COUNT_CAP = 9_999;

function clampPublicCount(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(LOCKED_SIGNAL_COUNT_CAP, Math.floor(n));
}

/**
 * Wire-safe payload for locked `/vin/public` — whitelist only.
 * Never forwards accident/salvage/stolen/odometer/history arrays.
 */
export function sanitizeLockedPreviewSignalsForClient(
  signals: LockedPreviewSignals | Record<string, unknown> | null | undefined,
): LockedPreviewSignals {
  const src = (signals ?? {}) as Record<string, unknown>;
  const out: LockedPreviewSignals = {
    mileageRecordCount: 0,
    ownerCount: 0,
    insuranceClaimCount: 0,
    auctionRecordCount: 0,
    registryRecordCount: 0,
    floodRecordCount: 0,
  };
  for (const key of LOCKED_SIGNAL_KEYS) {
    out[key] = clampPublicCount(src[key]);
  }
  return out;
}

/** Keys that must never appear on a locked public VIN response. */
export const LOCKED_PUBLIC_FORBIDDEN_KEYS = [
  "accidents",
  "accidentCount",
  "odometer",
  "odometerLocked",
  "mileage",
  "mileageHistory",
  "ownerHistory",
  "insuranceClaims",
  "registryHistory",
  "recallHistory",
  "serviceHistory",
  "auctionHistory",
  "salvage",
  "stolen",
  "taxi",
  "isSalvage",
  "isStolen",
  "isTaxi",
  "isFlooded",
  "flooded",
  "floodCount",
  "floodLossAmount",
  "titleStatus",
  "marketData",
  "photosHd",
  "photos360Exterior",
  "photos360Interior",
  "trim",
  "hp",
  "cylinders",
  "bodyType",
  "fuelType",
  "krwPerUsd",
] as const;

type FindingParts = {
  mileage: string;
  owners: string;
  insurance: string;
  auctions: string;
  registry: string;
  flood: string;
  join: (parts: string[]) => string;
  template: (vin: string, vehicle: string, findings: string) => string;
};

const FINDING_COPY: Record<LockedPreviewLang, FindingParts> = {
  en: {
    mileage: "{n} mileage readings",
    owners: "{n} ownership records",
    insurance: "{n} insurance claims",
    auctions: "{n} auction records",
    registry: "{n} registry records",
    flood: "{n} flood damage records",
    join: (parts) => parts.join(" · "),
    template: (vin, vehicle, findings) =>
      `For VIN ${vin} (${vehicle}), we found ${findings}. Unlock the full report for dates, values, and complete details.`,
  },
  de: {
    mileage: "{n} Kilometerstände",
    owners: "{n} Halterdaten",
    insurance: "{n} Versicherungsfälle",
    auctions: "{n} Auktionsdaten",
    registry: "{n} Registereinträge",
    flood: "{n} Wasserschäden",
    join: (parts) => parts.join(" · "),
    template: (vin, vehicle, findings) =>
      `Für VIN ${vin} (${vehicle}) haben wir ${findings} gefunden. Schalten Sie den Vollbericht für Daten, Werte und alle Details frei.`,
  },
  es: {
    mileage: "{n} lecturas de kilometraje",
    owners: "{n} registros de propietarios",
    insurance: "{n} reclamaciones de seguro",
    auctions: "{n} registros de subasta",
    registry: "{n} registros de registro",
    flood: "{n} registros de daños por inundación",
    join: (parts) => parts.join(" · "),
    template: (vin, vehicle, findings) =>
      `Para el VIN ${vin} (${vehicle}) encontramos ${findings}. Desbloquee el informe completo para fechas, valores y todos los detalles.`,
  },
  fr: {
    mileage: "{n} relevés kilométriques",
    owners: "{n} dossiers de propriétaires",
    insurance: "{n} sinistres d'assurance",
    auctions: "{n} dossiers d'enchères",
    registry: "{n} dossiers de registre",
    flood: "{n} dossiers d'inondation",
    join: (parts) => parts.join(" · "),
    template: (vin, vehicle, findings) =>
      `Pour le VIN ${vin} (${vehicle}), nous avons trouvé ${findings}. Débloquez le rapport complet pour les dates, valeurs et tous les détails.`,
  },
  sq: {
    mileage: "{n} lexime kilometrazhi",
    owners: "{n} rekorde pronësie",
    insurance: "{n} pretendime sigurimi",
    auctions: "{n} rekorde ankandi",
    registry: "{n} rekorde regjistri",
    flood: "{n} rekorde dëmtimi nga përmbytja",
    join: (parts) => parts.join(" · "),
    template: (vin, vehicle, findings) =>
      `Për VIN ${vin} (${vehicle}) gjetëm ${findings}. Zhbllokoni raportin e plotë për datat, vlerat dhe të gjitha detajet.`,
  },
  pl: {
    mileage: "{n} odczytów przebiegu",
    owners: "{n} wpisów właścicieli",
    insurance: "{n} szkód ubezpieczeniowych",
    auctions: "{n} wpisów aukcyjnych",
    registry: "{n} wpisów rejestru",
    flood: "{n} zapisów uszkodzeń powodziowych",
    join: (parts) => parts.join(" · "),
    template: (vin, vehicle, findings) =>
      `Dla VIN ${vin} (${vehicle}) znaleźliśmy ${findings}. Odblokuj pełny raport, aby zobaczyć daty, wartości i wszystkie szczegóły.`,
  },
  ro: {
    mileage: "{n} citiri de kilometraj",
    owners: "{n} înregistrări de proprietari",
    insurance: "{n} daune de asigurare",
    auctions: "{n} înregistrări de licitație",
    registry: "{n} înregistrări de registru",
    flood: "{n} înregistrări de daune prin inundație",
    join: (parts) => parts.join(" · "),
    template: (vin, vehicle, findings) =>
      `Pentru VIN ${vin} (${vehicle}) am găsit ${findings}. Deblocați raportul complet pentru date, valori și toate detaliile.`,
  },
  bg: {
    mileage: "{n} отчета на километраж",
    owners: "{n} записа за собственици",
    insurance: "{n} застрахователни претенции",
    auctions: "{n} аукционни записа",
    registry: "{n} регистрационни записа",
    flood: "{n} записа за щети от наводнение",
    join: (parts) => parts.join(" · "),
    template: (vin, vehicle, findings) =>
      `За VIN ${vin} (${vehicle}) намерихме ${findings}. Отключете пълния доклад за дати, стойности и всички подробности.`,
  },
  ka: {
    mileage: "{n} გარბენის ჩანაწერი",
    owners: "{n} მფლობელის ჩანაწერი",
    insurance: "{n} სადაზღვევო პრეტენზია",
    auctions: "{n} აუქციონის ჩანაწერი",
    registry: "{n} რეესტრის ჩანაწერი",
    flood: "{n} წყალდიდობის ჩანაწერი",
    join: (parts) => parts.join(" · "),
    template: (vin, vehicle, findings) =>
      `VIN ${vin} (${vehicle})-ისთვის ვიპოვეთ ${findings}. განბლოკეთ სრული ანგარიში თარიღების, ღირებულებებისა და ყველა დეტალისთვის.`,
  },
  ar: {
    mileage: "{n} قراءات عداد المسافة",
    owners: "{n} سجلات ملكية",
    insurance: "{n} مطالبات تأمين",
    auctions: "{n} سجلات مزاد",
    registry: "{n} سجلات سجل",
    flood: "{n} سجلات أضرار فيضان",
    join: (parts) => parts.join(" · "),
    template: (vin, vehicle, findings) =>
      `لـ VIN ${vin} (${vehicle}) وجدنا ${findings}. افتح التقرير الكامل للتواريخ والقيم وجميع التفاصيل.`,
  },
  uk: {
    mileage: "{n} показів пробігу",
    owners: "{n} записів про власників",
    insurance: "{n} страхових випадків",
    auctions: "{n} аукціонних записів",
    registry: "{n} реєстрових записів",
    flood: "{n} записів про пошкодження від повені",
    join: (parts) => parts.join(" · "),
    template: (vin, vehicle, findings) =>
      `Для VIN ${vin} (${vehicle}) ми знайшли ${findings}. Розблокуйте повний звіт для дат, значень і всіх деталей.`,
  },
  ru: {
    mileage: "{n} показаний пробега",
    owners: "{n} записей о владельцах",
    insurance: "{n} страховых случаев",
    auctions: "{n} аукционных записей",
    registry: "{n} записей реестра",
    flood: "{n} записей о повреждениях от наводнения",
    join: (parts) => parts.join(" · "),
    template: (vin, vehicle, findings) =>
      `Для VIN ${vin} (${vehicle}) мы нашли ${findings}. Разблокируйте полный отчёт, чтобы увидеть даты, значения и все детали.`,
  },
  zh: {
    mileage: "{n} 条里程记录",
    owners: "{n} 条车主记录",
    insurance: "{n} 条保险理赔",
    auctions: "{n} 条拍卖记录",
    registry: "{n} 条登记记录",
    flood: "{n} 条水浸记录",
    join: (parts) => parts.join(" · "),
    template: (vin, vehicle, findings) =>
      `针对 VIN ${vin}（${vehicle}），我们找到了${findings}。解锁完整报告可查看日期、数值与全部详情。`,
  },
};

function fmtFinding(template: string, n: number): string {
  return template.replace("{n}", String(n));
}

/** Unique locked summary for SSR / meta / UI. Never mentions accidents. */
export function buildLockedHistorySummary(
  lang: LockedPreviewLang | string,
  vehicle: LockedPreviewVehicle,
  signals: LockedPreviewSignals,
  opts?: { eventsMode?: boolean },
): string | null {
  if (!lockedPreviewSignalsHaveFindings(signals)) return null;

  const copy = FINDING_COPY[(lang as LockedPreviewLang)] ?? FINDING_COPY.en;
  const registryTemplate = opts?.eventsMode
    ? (lang === "en" || !(lang as string) ? "{n} event records" : copy.registry)
    : copy.registry;
  const parts: string[] = [];
  if (signals.mileageRecordCount > 0) {
    parts.push(fmtFinding(copy.mileage, signals.mileageRecordCount));
  }
  if (signals.ownerCount > 0) {
    parts.push(fmtFinding(copy.owners, signals.ownerCount));
  }
  if (signals.insuranceClaimCount > 0) {
    parts.push(fmtFinding(copy.insurance, signals.insuranceClaimCount));
  }
  if (signals.auctionRecordCount > 0) {
    parts.push(fmtFinding(copy.auctions, signals.auctionRecordCount));
  }
  if (signals.registryRecordCount > 0) {
    parts.push(fmtFinding(registryTemplate, signals.registryRecordCount));
  }
  if (signals.floodRecordCount > 0) {
    parts.push(fmtFinding(copy.flood, signals.floodRecordCount));
  }
  if (parts.length === 0) return null;

  const vin = normalizeVin(vehicle.vin);
  return copy.template(vin, vehicleLabel(vehicle), copy.join(parts));
}
