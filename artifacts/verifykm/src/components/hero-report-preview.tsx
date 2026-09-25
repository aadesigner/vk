import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "@/i18n/context";
import { FlagImg } from "@/components/flag-img";
import { DemoCarPhoto, preloadDemoCarPhotos } from "@/components/demo-car-photo";
import { useLightMotion } from "@/hooks/use-light-motion";
import { ALL_CARS, carsForCountry, type DemoCar } from "@/lib/demo-fleet";
import { cn } from "@/lib/utils";

/** Homepage samples: danger records from Korea, the USA, and Dubai. */
const HOME_SAMPLE_VINS = [
  "KNAE251D5J6038429",
  "KNDPM3AC9K7583241",
  "1G11C5SL4EF287341",
  "1FTEW1E50JKF08392",
  "WDDWJ6EB5KA012345",
] as const;

const HOME_SAMPLES: DemoCar[] = HOME_SAMPLE_VINS.flatMap((vin) => {
  const car = ALL_CARS.find((item) => item.vin === vin);
  return car ? [car] : [];
});

type Market = "usa" | "korea" | "canada" | "china" | "japan" | "uae";

const STATS = [
  { label: "hero_chip_odometer_label", value: "hero_chip_odometer_value" },
  { label: "hero_chip_claims_label", value: "hero_chip_claims_value" },
  { label: "hero_chip_auction_label", value: "hero_chip_auction_value" },
  { label: "hero_chip_title_label", value: "hero_chip_title_value" },
] as const;

const ORIGIN_FLAG: Record<DemoCar["origin"], string> = {
  USA: "us",
  Korea: "kr",
  Germany: "de",
  China: "cn",
  Japan: "jp",
  UAE: "ae",
};

const ORIGIN_LABEL: Record<DemoCar["origin"], string> = {
  USA: "demo_card_origin_usa",
  Korea: "demo_card_origin_korea",
  Germany: "demo_card_origin_germany",
  China: "demo_card_origin_china",
  Japan: "demo_card_origin_japan",
  UAE: "demo_card_origin_uae",
};

function pickFrozenCar(pool: DemoCar[]): DemoCar {
  return pool.find((c) => c.condition === "CLEAN") ?? pool[0]!;
}

/** Sample report. Homepage cycles five danger cars; country pages cycle that market. */
export function HeroReportPreview({
  className,
  country,
  fill = false,
}: {
  className?: string;
  country?: Market;
  /** Homepage: grow the photo so the card matches the left column height. */
  fill?: boolean;
}) {
  const { t } = useTranslation();
  const lightMotion = useLightMotion();
  const pool = useMemo(() => (country ? carsForCountry(country) : HOME_SAMPLES), [country]);
  const cars = country && lightMotion ? [pickFrozenCar(pool)] : pool;

  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setIdx(0);
  }, [country]);

  useEffect(() => {
    if (cars.length < 2) return;
    if (country && lightMotion) return;
    if (!country && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => setIdx((i) => (i + 1) % cars.length), 5000);
    return () => clearInterval(timer);
  }, [country, lightMotion, cars.length]);

  useEffect(() => {
    if (cars.length === 0) return;
    const next = cars[(idx + 1) % cars.length];
    preloadDemoCarPhotos([cars[idx]?.photo, next?.photo].filter((u): u is string => Boolean(u)));
  }, [cars, idx]);

  const car = cars[idx] ?? cars[0];
  const flagCode = car
    ? country === "canada" && car.origin === "USA"
      ? "ca"
      : ORIGIN_FLAG[car.origin]
    : "de";

  const status = !car
    ? t("hero_preview_status")
    : t(car.condition === "CLEAN" ? "report_clean" : car.condition === "CAUTION" ? "report_caution" : "report_risk");

  const stats = STATS.map((s) => ({ label: s.label, value: t(s.value) }));

  const extraLabel = "mock_label_owners";
  const extraValue = "2";
  const mileageMax = car?.unit === "mi" ? 200_000 : 320_000;
  const mileagePct = car ? Math.min(100, Math.round((car.mileage / mileageMax) * 100)) : 0;
  const countryRows = car
    ? [
        {
          label: "demo_odometer",
          value: `${car.mileage.toLocaleString()} ${car.unit}`,
          tone: mileagePct > 70 ? "text-red-600" : mileagePct > 40 ? "text-amber-700" : "text-slate-950",
        },
        {
          label: "mock_label_accidents",
          value: car.accidents === 0 ? t("demo_none_found") : `${car.accidents} ${t("demo_found")}`,
          tone: car.accidents === 0 ? "text-emerald-700" : car.accidents >= 3 ? "text-red-600" : "text-amber-700",
        },
        {
          label: "mock_label_owners",
          value: String(car.owners),
          tone: car.owners <= 1 ? "text-emerald-700" : car.owners >= 4 ? "text-red-600" : "text-amber-700",
        },
        {
          label: "mock_label_salvage",
          value: car.salvage ? t("demo_flagged") : t("report_clean"),
          tone: car.salvage ? "text-red-600" : "text-emerald-700",
        },
        {
          label: "mock_label_stolen",
          value: car.stolen ? t("stolen") : t("demo_none_found"),
          tone: car.stolen ? "text-red-600" : "text-emerald-700",
        },
      ]
    : [];

  return (
    <aside
      className={cn(
        country ? "relative block w-full" : "relative w-full",
        className,
      )}
      aria-hidden
    >
      <article className={cn("relative flex h-full flex-col overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white text-slate-950 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.28)]")}>
        <div className={cn("relative h-48 overflow-hidden sm:h-56", fill && "lg:h-auto lg:min-h-56 lg:flex-1")}>
          {car ? (
            cars.map((slide, slideIdx) => {
              const isActive = slideIdx === idx;
              const isNext = slideIdx === (idx + 1) % cars.length;
              if (!isActive && !isNext) return null;
              return (
              <div
                key={slide.vin}
                className={cn(
                  "absolute inset-0 transition-opacity duration-500",
                  isActive ? "opacity-100" : "pointer-events-none opacity-0",
                )}
              >
                <DemoCarPhoto
                  src={slide.photo}
                  alt=""
                  eager={isActive}
                  className="object-[center_42%]"
                  placeholderClassName="bg-slate-100"
                />
              </div>
              );
            })
          ) : null}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/50 via-transparent to-slate-950/10" />
          <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-3 px-4 pt-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white">
              {t("what_we_check_sample_badge")}
            </p>
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                !car || car.condition === "CLEAN"
                  ? "bg-black/55 text-emerald-200"
                  : car.condition === "CAUTION"
                    ? "bg-amber-400 text-slate-950"
                    : "bg-red-600 text-white",
              )}
            >
              {status}
            </span>
          </div>
          <div className="absolute inset-x-0 bottom-0 px-4 pb-3">
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-xl font-bold tracking-tight text-white">
                  {car ? `${car.year} ${car.name}` : t("hero_preview_vehicle")}
                </p>
                <p className="mt-1 truncate font-mono text-[11px] tracking-[0.14em] text-[#e7eef6]">
                  {car ? car.vin : ""}
                </p>
              </div>
              {car ? (
                <p className="shrink-0 text-right text-white">
                  <span className="block font-mono text-2xl font-bold leading-none tabular-nums">{car.score.toFixed(1)}</span>
                  <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#d7e4f2]">
                    {t("demo_trust_score")}
                  </span>
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {car ? (
          <div>
            <div className="border-b border-slate-200 px-4 py-3">
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{t("demo_odometer")}</p>
                <p className={cn("text-sm font-semibold tabular-nums", countryRows[0]?.tone)}>{countryRows[0]?.value}</p>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={cn(
                    "h-full rounded-full",
                    mileagePct > 70 ? "bg-red-500" : mileagePct > 40 ? "bg-amber-500" : "bg-[#00a5fd]",
                  )}
                  style={{ width: `${Math.max(mileagePct, 6)}%` }}
                />
              </div>
            </div>
            {countryRows.slice(1).map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 last:border-b-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{t(row.label)}</p>
                <p className={cn("text-right text-sm font-semibold", row.tone)}>{row.value}</p>
              </div>
            ))}
          </div>
        ) : (
          <div>
            {[...stats, { label: extraLabel, value: extraValue }].map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 last:border-b-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{t(row.label)}</p>
                <p className="text-right text-sm font-semibold text-slate-950">{row.value}</p>
              </div>
            ))}
          </div>
        )}

        {car ? (
          <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-[#f7fafc] px-4 py-3">
            <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-600">
              <FlagImg code={flagCode} variant="nav" size={14} alt="" />
              <span>
                {!country && car.origin === "UAE"
                  ? t("home_stat_uae")
                  : country === "canada" && car.origin === "USA"
                    ? t("home_stat_canada")
                    : t(ORIGIN_LABEL[car.origin])}
              </span>
            </span>
            {cars.length > 1 ? (
              <span className="flex items-center gap-0.5">
                {cars.map((slide, slideIdx) => (
                  <button
                    key={slide.vin}
                    type="button"
                    onClick={() => setIdx(slideIdx)}
                    className="p-1"
                  >
                    <span
                      className={cn(
                        "block h-1.5 rounded-full transition-all",
                        slideIdx === idx ? "w-4 bg-[#00a5fd]" : "w-1.5 bg-slate-300",
                      )}
                    />
                  </button>
                ))}
              </span>
            ) : null}
          </div>
        ) : null}
      </article>
    </aside>
  );
}
