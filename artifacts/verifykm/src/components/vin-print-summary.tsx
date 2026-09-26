import { useEffect, useState } from "react";
import { useTranslation } from "@/i18n/context";
import { VerifyKMPrintLogo } from "@/components/logo";
import { formatCountryName, countryLabelsFromT } from "@/lib/format-country-name";
import { formatAccidentCount } from "@/lib/format-accident-count";
import { translateTitleStatus } from "@/lib/translate-title-status";
import type { PrintAuctionRow, PrintMileageRow, PrintOwnerRow, PrintRegistryRow } from "@/lib/build-print-summary";
import { PRINT_GALLERY_PHOTO_LIMIT } from "@/lib/build-print-summary";
import { reportLinkQrDataUrl } from "@/lib/report-qr";
import { cn } from "@/lib/utils";
import { LANG_META } from "@/lib/languages";

export type PrintSummaryHighlight = {
  date?: string | null;
  label: string;
};

type VinPrintSummaryProps = {
  vehicleTitle: string;
  vin: string;
  country?: string | null;
  scoreValue?: string | null;
  scoreLabel?: string | null;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  trim?: string | null;
  engine?: string | null;
  transmission?: string | null;
  fuelType?: string | null;
  color?: string | null;
  bodyType?: string | null;
  hp?: number | null;
  odometer?: number | null;
  titleStatus?: string | null;
  photos?: string[];
  accidentCount: number;
  accidentHighlights: PrintSummaryHighlight[];
  insuranceCount: number;
  insuranceHighlights: PrintSummaryHighlight[];
  mileageRows?: PrintMileageRow[];
  ownerRows?: PrintOwnerRow[];
  registryRows?: PrintRegistryRow[];
  auctionRows?: PrintAuctionRow[];
  ownerCount?: number | null;
  isSalvage?: boolean | null;
  isStolen?: boolean | null;
  isTaxi?: boolean | null;
  isFlooded?: boolean | null;
  hasSalvageData: boolean;
  hasTheftData: boolean;
  hasFloodData?: boolean;
  marketValue?: string | null;
  lastAuction?: string | null;
  reportUrl?: string;
  className?: string;
};

function PrintSection({
  title,
  count,
  empty,
  children,
  className,
}: {
  title: string;
  count?: number | null;
  empty?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const hasContent = count == null ? true : count > 0;
  return (
    <section className={cn("print-section rounded-md border border-border/55 overflow-hidden", className)}>
      <div className="print-section-head px-3 py-1.5 border-b border-border/40 flex items-center justify-between gap-2">
        <h2 className="text-[8pt] font-bold uppercase tracking-wide text-foreground">{title}</h2>
        {count != null && count > 0 && (
          <span className="print-section-count text-[7.5pt] font-bold tabular-nums">{count}</span>
        )}
      </div>
      <div className="px-3 py-1.5 print-section-body">
        {!hasContent && empty ? (
          <p className="text-[8pt] text-muted-foreground italic">{empty}</p>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

function PrintBlockTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="print-block-title text-[7.5pt] font-bold uppercase tracking-[0.12em] text-foreground mb-1 flex items-center gap-1.5">
      <span className="print-block-title-accent h-3 w-0.5 rounded-full shrink-0" aria-hidden />
      {children}
    </h3>
  );
}

function SpecCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="print-spec-cell rounded border border-border/40 bg-muted/20 px-2 py-1">
      <p className="text-[6.5pt] font-semibold uppercase tracking-wide text-muted-foreground leading-tight">{label}</p>
      <p className="text-[8pt] font-bold text-foreground mt-0.5 leading-snug break-words">{value}</p>
    </div>
  );
}

function FindingBadge({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative" | "neutral";
}) {
  const toneClass = tone === "positive"
    ? "print-finding-positive border-[#38bdf8]/60 bg-[#e6f6ff] text-[#0c4a6e]"
    : tone === "negative"
      ? "print-finding-negative border-red-400/60 bg-red-50 text-red-900"
      : "print-finding-neutral border-border/55 bg-muted/25 text-foreground";
  return (
    <div className={cn("rounded-md border px-2 py-1.5", toneClass)}>
      <p className="text-[6.5pt] font-semibold uppercase tracking-wide opacity-75 leading-tight">{label}</p>
      <p className="text-[8.5pt] font-bold mt-0.5 leading-snug">{value}</p>
    </div>
  );
}

function TimelineRows({ items }: { items: PrintSummaryHighlight[] }) {
  return (
    <table className="w-full text-[7.5pt] border-collapse print-timeline-table">
      <tbody>
        {items.map((item, i) => (
          <tr key={i} className="border-b border-border/25 last:border-0">
            <td className="py-0.5 pr-2 text-muted-foreground font-medium align-top whitespace-nowrap">
              {item.date ?? "—"}
            </td>
            <td className="py-0.5 text-foreground align-top leading-snug">{item.label}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MileageTable({ rows }: { rows: PrintMileageRow[] }) {
  return (
    <table className="w-full text-[7.5pt] border-collapse print-timeline-table">
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="border-b border-border/25 last:border-0">
            <td className="py-0.5 pr-2 text-muted-foreground align-top whitespace-nowrap">{row.date ?? "—"}</td>
            <td className="py-0.5 pr-2 font-semibold tabular-nums align-top whitespace-nowrap">{row.odometer}</td>
            <td className="py-0.5 text-foreground/90 align-top leading-snug">{row.detail ?? ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function OwnerTable({ rows }: { rows: PrintOwnerRow[] }) {
  return (
    <table className="w-full text-[7.5pt] border-collapse print-timeline-table">
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="border-b border-border/25 last:border-0">
            <td className="py-0.5 pr-2 text-muted-foreground align-top whitespace-nowrap">{row.date ?? "—"}</td>
            <td className="py-0.5 pr-2 align-top leading-snug">{row.location ?? "—"}</td>
            <td className="py-0.5 font-semibold tabular-nums align-top whitespace-nowrap">{row.mileage ?? ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DetailTable({ rows }: { rows: Array<{ date: string | null; title: string; detail: string | null }> }) {
  return (
    <table className="w-full text-[7.5pt] border-collapse print-timeline-table">
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="border-b border-border/25 last:border-0">
            <td className="py-0.5 pr-2 text-muted-foreground align-top whitespace-nowrap">{row.date ?? "—"}</td>
            <td className="py-0.5 align-top leading-snug">
              <span className="font-semibold text-foreground">{row.title}</span>
              {row.detail && (
                <p className="text-muted-foreground mt-0.5 font-normal leading-snug">{row.detail}</p>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Rich print-only report — cover page + history page(s). */
export function VinPrintSummary({
  vehicleTitle,
  vin,
  country,
  scoreValue,
  scoreLabel,
  make,
  model,
  year,
  trim,
  engine,
  transmission,
  fuelType,
  color,
  bodyType,
  hp,
  odometer,
  titleStatus,
  photos = [],
  accidentCount,
  accidentHighlights,
  insuranceCount,
  insuranceHighlights,
  mileageRows = [],
  ownerRows = [],
  registryRows = [],
  auctionRows = [],
  ownerCount,
  isSalvage,
  isStolen,
  isTaxi,
  isFlooded,
  hasSalvageData,
  hasTheftData,
  hasFloodData = false,
  marketValue,
  lastAuction,
  reportUrl,
  className,
}: VinPrintSummaryProps) {
  const { t, language } = useTranslation();
  const countryLabels = countryLabelsFromT(t);
  const displayCountry = country
    ? formatCountryName(country, language, countryLabels)
    : null;

  const salvageText = !hasSalvageData
    ? null
    : isSalvage
      ? t("report_salvage_flag")
      : t("report_clean_flag");
  const theftText = !hasTheftData
    ? null
    : isStolen
      ? t("report_stolen_flag")
      : t("report_not_stolen");
  const floodText = !hasFloodData
    ? null
    : isFlooded
      ? t("flood_flagged")
      : t("report_not_flooded");

  const filteredPhotos = photos.filter(Boolean);
  const heroPhoto = filteredPhotos[0];
  const galleryPhotos = filteredPhotos.slice(1, 1 + PRINT_GALLERY_PHOTO_LIMIT);
  const titleStatusLabel = translateTitleStatus(t, titleStatus);

  const ownerDisplay = ownerCount != null
    ? ownerCount === 1
      ? t("owner_single")
      : `${ownerCount} ${t("owner_many_suffix")}`
    : null;

  const printLocale: Record<string, string> = Object.fromEntries(
    Object.values(LANG_META).map((m) => [m.code, m.intl]),
  );
  const generatedDate = new Date().toLocaleDateString(printLocale[language] ?? "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!reportUrl) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    void reportLinkQrDataUrl(reportUrl).then((url) => {
      if (!cancelled) setQrDataUrl(url);
    }).catch(() => {
      if (!cancelled) setQrDataUrl(null);
    });
    return () => {
      cancelled = true;
    };
  }, [reportUrl]);

  const findingItems = [
    odometer != null ? (
      <FindingBadge
        key="odo"
        label={t("print_summary_latest_mileage")}
        value={`${odometer.toLocaleString()} km`}
      />
    ) : null,
    ownerDisplay ? (
      <FindingBadge key="owners" label={t("print_summary_owners")} value={ownerDisplay} />
    ) : null,
    accidentCount > 0 ? (
      <FindingBadge
        key="accidents"
        label={t("vin_public_accidents_section")}
        value={formatAccidentCount(t, accidentCount)}
        tone="negative"
      />
    ) : null,
    salvageText ? (
      <FindingBadge
        key="salvage"
        label={t("report_salvage")}
        value={salvageText}
        tone={isSalvage ? "negative" : "positive"}
      />
    ) : null,
    theftText ? (
      <FindingBadge
        key="theft"
        label={t("report_theft")}
        value={theftText}
        tone={isStolen ? "negative" : "positive"}
      />
    ) : null,
    floodText ? (
      <FindingBadge
        key="flood"
        label={t("report_flood")}
        value={floodText}
        tone={isFlooded ? "negative" : "positive"}
      />
    ) : null,
    <FindingBadge
      key="taxi"
      label={t("report_taxi")}
      value={isTaxi ? t("taxi_flagged") : t("report_not_taxi")}
      tone={isTaxi ? "negative" : "positive"}
    />,
    marketValue ? (
      <FindingBadge key="market" label={t("report_estimated_value")} value={marketValue} />
    ) : null,
    lastAuction ? (
      <FindingBadge key="auction" label={t("report_last_auction")} value={lastAuction} />
    ) : null,
  ].filter(Boolean);

  return (
    <div className={cn("hidden print:block vin-report-print-summary", className)} aria-hidden="true">
      {/* Cover — page 1 */}
      <div className="print-page print-page-cover">
        <header className="print-cover-header">
          <div className="h-0.5 rounded-full bg-gradient-to-r from-primary/60 via-primary to-primary/60 mb-2" />
          <div className="flex items-center justify-between gap-3 pb-2 border-b border-border/50">
            <VerifyKMPrintLogo />
            <p className="text-[7pt] text-muted-foreground text-end leading-snug shrink-0">
              {t("print_brand_generated_label")}: {generatedDate}
            </p>
          </div>

          <div className="flex items-start justify-between gap-3 pt-2 pb-1.5">
            <div className="min-w-0 flex-1">
              <p className="text-[7pt] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                {t("print_summary_title")}
              </p>
              <h1 className="text-[15pt] font-black leading-tight mt-0.5 text-foreground">{vehicleTitle}</h1>
              <p className="font-mono text-[8.5pt] text-muted-foreground mt-0.5 tracking-wide">{vin}</p>
              {(displayCountry || trim) && (
                <p className="text-[7.5pt] text-muted-foreground mt-0.5">
                  {[displayCountry, trim].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
            {scoreValue && (
              <div className="print-score-box shrink-0 text-center rounded-lg border-2 px-3 py-2">
                <p className="text-[18pt] font-black text-primary leading-none tabular-nums">{scoreValue}</p>
                <p className="text-[7pt] text-muted-foreground font-semibold">/10</p>
                {scoreLabel && (
                  <p className="text-[6.5pt] font-bold text-foreground mt-0.5 max-w-[5rem] leading-tight">
                    {scoreLabel}
                  </p>
                )}
              </div>
            )}
          </div>
          <p className="text-[7pt] text-muted-foreground leading-snug pb-2 border-b border-border/30">
            {t("print_summary_subtitle")}
          </p>
        </header>

        <div className="print-hero-layout grid grid-cols-2 gap-2 mt-2">
          {heroPhoto ? (
            <div className="print-hero-photo-wrap rounded-md border border-border/50 overflow-hidden shadow-sm">
              <img src={heroPhoto} alt="" loading="eager" decoding="async" referrerPolicy="no-referrer" className="print-hero-photo-main w-full h-full object-cover" />
            </div>
          ) : (
            <div className="print-hero-photo-wrap rounded-md border border-dashed border-border/45 flex items-center justify-center bg-muted/15">
              <p className="text-[7.5pt] text-muted-foreground px-2 text-center">{t("print_summary_no_photos")}</p>
            </div>
          )}

          <div className="min-w-0">
            <PrintBlockTitle>{t("print_summary_specs")}</PrintBlockTitle>
            <div className="print-spec-grid grid grid-cols-2 gap-1 content-start">
            <SpecCell label={t("free_decoder_field_make")} value={make ?? "—"} />
            <SpecCell label={t("free_decoder_field_model")} value={model ?? "—"} />
            <SpecCell label={t("free_decoder_field_year")} value={year ? String(year) : "—"} />
            <SpecCell label={t("free_decoder_field_engine")} value={engine ?? "—"} />
            <SpecCell label={t("free_decoder_field_transmission")} value={transmission ?? "—"} />
            {fuelType && <SpecCell label={t("free_decoder_field_fuel_type")} value={fuelType} />}
            {color && <SpecCell label={t("color")} value={color} />}
            {bodyType && <SpecCell label={t("free_decoder_field_body_type")} value={bodyType} />}
            {hp != null && <SpecCell label={t("hp")} value={`${hp} hp`} />}
            {titleStatusLabel && <SpecCell label={t("title_status")} value={titleStatusLabel} />}
            </div>
          </div>
        </div>

        {findingItems.length > 0 && (
          <div className="mt-2">
            <PrintBlockTitle>{t("print_summary_findings")}</PrintBlockTitle>
            <div className="print-findings-grid grid grid-cols-2 gap-1.5">
              {findingItems}
            </div>
          </div>
        )}

        {galleryPhotos.length > 0 && (
          <div className="print-photo-gallery mt-2">
            <p className="text-[7.5pt] font-bold uppercase tracking-wide text-muted-foreground mb-1">
              {t("print_summary_photos")}
            </p>
            <div className="grid grid-cols-4 gap-1 print-photo-grid">
              {galleryPhotos.map((src, i) => (
                <div key={i} className="print-gallery-cell rounded border border-border/40 overflow-hidden aspect-[4/3]">
                  <img src={src} alt="" loading="eager" decoding="async" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* History — continues on same page when space allows */}
      <div className="print-page print-page-history">
        <PrintBlockTitle>{t("print_summary_history_title")}</PrintBlockTitle>
        <div className="grid grid-cols-1 gap-1.5 mt-1">
          <PrintSection
            title={t("vin_public_accidents_section")}
            count={accidentCount}
            empty={t("print_summary_no_accidents")}
          >
            {accidentCount > 0 && <TimelineRows items={accidentHighlights} />}
          </PrintSection>

          <PrintSection
            title={t("report_insurance_claims")}
            count={insuranceCount}
            empty={t("print_summary_no_insurance")}
          >
            {insuranceCount > 0 && <TimelineRows items={insuranceHighlights} />}
          </PrintSection>

          {auctionRows.length > 0 && (
            <PrintSection title={t("auction_history")} count={auctionRows.length}>
              <DetailTable rows={auctionRows} />
            </PrintSection>
          )}

          <PrintSection
            title={t("print_summary_mileage_history")}
            count={mileageRows.length}
            empty={t("print_summary_no_mileage")}
          >
            {mileageRows.length > 0 && <MileageTable rows={mileageRows} />}
          </PrintSection>

          <PrintSection
            title={t("print_summary_ownership")}
            count={ownerRows.length || ownerCount}
            empty={t("print_summary_no_owners")}
          >
            {ownerRows.length > 0 ? (
              <OwnerTable rows={ownerRows} />
            ) : ownerDisplay ? (
              <p className="text-[8pt] font-semibold">{ownerDisplay}</p>
            ) : null}
          </PrintSection>

          {registryRows.length > 0 && (
            <PrintSection title={t("print_summary_registry")} count={registryRows.length}>
              <DetailTable rows={registryRows} />
            </PrintSection>
          )}
        </div>

        {reportUrl && (
          <div className="print-report-link mt-2.5 rounded-lg border-2 px-3 py-2.5 text-center">
            <p className="text-[7.5pt] font-semibold text-muted-foreground leading-snug max-w-[42ch] mx-auto">
              {t("print_summary_full_report")}
            </p>
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt=""
                width={112}
                height={112}
                className="print-report-qr mx-auto mt-1.5 h-28 w-28"
              />
            ) : (
              <p className="font-mono text-[8pt] font-semibold text-foreground break-all mt-1 leading-snug">
                {reportUrl}
              </p>
            )}
          </div>
        )}

        <footer className="print-cover-footer mt-2.5 pt-2 border-t border-border/50 flex items-center justify-between gap-3">
          <VerifyKMPrintLogo className="h-5" />
          <p className="text-[6.5pt] text-muted-foreground text-end leading-snug max-w-[60%]">
            {t("print_brand_disclaimer")}
          </p>
        </footer>
      </div>
    </div>
  );
}
