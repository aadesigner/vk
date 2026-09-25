import { SEOHead } from "@/components/seo";
import {
  SalvageMeaningHint,
  MileageRollbackHint,
  TitleBrandHint,
  HighOwnerCountHint,
} from "@/components/salvage-meaning-hint";
import { useTranslation } from "@/i18n/context";
import type { SeoLang } from "@/lib/seo-config";

/**
 * DEV-only showcase for report “what this means” hints.
 * Open: /en/dev/meaning-hints
 */
export default function MeaningHintsPreviewPage() {
  const { t, language } = useTranslation();

  const rows = [
    {
      label: "Salvage (existing)",
      sample: t("salvage_flagged"),
      hint: <SalvageMeaningHint labeled />,
      tone: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/40",
    },
    {
      label: "Mileage rollback",
      sample: t("mileage_rollback_warning"),
      hint: <MileageRollbackHint labeled />,
      tone: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/40",
    },
    {
      label: "Lemon / buyback title",
      sample: "Lemon / manufacturer buyback",
      hint: <TitleBrandHint kind="lemon" labeled />,
      tone: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/40",
    },
    {
      label: "Rebuilt title",
      sample: "Rebuilt title",
      hint: <TitleBrandHint kind="rebuilt" labeled />,
      tone: "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800/40",
    },
    {
      label: "Other branded title",
      sample: "Flood / junk / hail brand",
      hint: <TitleBrandHint kind="branded" labeled />,
      tone: "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800/40",
    },
    {
      label: "High owner count (>5)",
      sample: `7 ${t("owner_many_suffix")}`,
      hint: <HighOwnerCountHint labeled />,
      tone: "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800/40",
    },
  ] as const;

  return (
    <>
      <SEOHead
        title="Meaning hints (dev)"
        description="Local preview of VIN report meaning hints"
        lang={language as SeoLang}
        noIndex
      />
      <div className="mx-auto max-w-2xl px-4 py-10 space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
            Local preview
          </p>
          <h1 className="text-2xl font-bold tracking-tight">Report “what this means” hints</h1>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            Tap the help control on each row. The same popovers appear on live VIN reports next to
            salvage, mileage rollback, problem titles, and high owner counts.
          </p>
        </div>

        <ul className="space-y-3">
          {rows.map((row) => (
            <li
              key={row.label}
              className={`rounded-2xl border p-4 flex items-start justify-between gap-3 ${row.tone}`}
            >
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {row.label}
                </p>
                <p className="text-sm font-semibold mt-0.5">{row.sample}</p>
              </div>
              <div className="shrink-0 pt-0.5">{row.hint}</div>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
