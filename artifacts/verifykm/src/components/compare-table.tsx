import { useTranslation } from "@/i18n/context";
import { useDisplayPrice } from "@/hooks/use-display-price";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Check, Minus, X } from "lucide-react";
import { EnterReveal } from "@/components/enter-reveal";
import { cn } from "@/lib/utils";
import { pathFor } from "@/lib/localized-routes";

type CompareRow = {
  labelKey: string;
  special?: "price";
  highlight?: boolean;
  badgeKey?: string;
  values: (boolean | string | null)[];
};

type Props = {
  market?: "default" | "home" | "usa" | "korea" | "canada" | "china" | "japan" | "uae";
};

/** Verdict mark for one capability — brand slot reads louder than competitor notes. */
function Verdict({ value, brand }: { value: boolean | string | null; brand?: boolean }) {
  if (value === true) {
    return (
      <Check
        aria-hidden
        className={cn(
          "h-3.5 w-3.5 shrink-0 stroke-[2.75]",
          brand ? "text-[#0088d4] dark:text-[#33bbfd]" : "text-[#00a5fd]/55",
        )}
      />
    );
  }

  if (value === false) {
    return <X aria-hidden className="h-3.5 w-3.5 shrink-0 stroke-[2.75] text-muted-foreground/45" />;
  }

  if (value == null || value === "") {
    return <Minus aria-hidden className="h-3 w-3 shrink-0 text-muted-foreground/30" />;
  }

  return (
    <span
      className={cn(
        "font-mono text-[10px] font-semibold leading-none",
        brand ? "text-[#0088d4] dark:text-[#33bbfd]" : "text-muted-foreground/75",
      )}
    >
      {value}
    </span>
  );
}

export function CompareTable({ market = "default" }: Props) {
  const { t, language } = useTranslation();
  const { displayPrice, loading: priceLoading, fmtPrice } = useDisplayPrice();

  const partial = t("compare_partial");

  const homeRows: CompareRow[] = [
    { labelKey: "compare_row_price", special: "price", values: [null, "€39.99", "€25.99", "€29.99"] },
    { labelKey: "compare_row_korean", highlight: true, badgeKey: "compare_row_only_us", values: [true, false, false, false] },
    { labelKey: "compare_row_canadian", highlight: true, badgeKey: "compare_row_only_us", values: [true, partial, false, false] },
    { labelKey: "compare_row_us", values: [true, true, partial, true] },
    { labelKey: "compare_row_mileage", values: [true, true, true, true] },
    { labelKey: "compare_row_accident", values: [true, true, true, true] },
    { labelKey: "compare_row_salvage", values: [true, true, true, true] },
    { labelKey: "compare_row_theft", values: [true, "US/CA", "EU only", "US only"] },
    { labelKey: "compare_row_ownership", values: [true, true, true, true] },
  ];

  const koreaRows: CompareRow[] = [
    { labelKey: "compare_row_price", special: "price", values: [null, "€39.99", "€25.99"] },
    { labelKey: "compare_row_korean", highlight: true, badgeKey: "compare_row_only_us", values: [true, false, false] },
    { labelKey: "compare_row_canadian", highlight: true, badgeKey: "compare_row_only_us", values: [true, partial, false] },
    { labelKey: "compare_row_us", values: [true, true, partial] },
    { labelKey: "compare_row_mileage", values: [true, true, true] },
    { labelKey: "compare_row_accident", values: [true, true, true] },
    { labelKey: "compare_row_salvage", values: [true, true, true] },
    { labelKey: "compare_row_theft", values: [true, "US/CA", "EU only"] },
    { labelKey: "compare_row_ownership", values: [true, true, true] },
  ];

  const usaRows: CompareRow[] = [
    { labelKey: "compare_row_price", special: "price", values: [null, "€39.99", "€25.99", "€29.99"] },
    { labelKey: "compare_row_us", highlight: true, badgeKey: "compare_row_us_focus", values: [true, true, partial, true] },
    { labelKey: "compare_row_korean", highlight: true, badgeKey: "compare_row_only_us", values: [true, false, false, false] },
    { labelKey: "compare_row_canadian", highlight: true, badgeKey: "compare_row_only_us", values: [true, true, false, false] },
    { labelKey: "compare_row_auction", values: [true, true, partial, true] },
    { labelKey: "compare_row_mileage", values: [true, true, true, true] },
    { labelKey: "compare_row_accident", values: [true, true, true, true] },
    { labelKey: "compare_row_salvage", values: [true, true, true, true] },
    { labelKey: "compare_row_theft", values: [true, "US/CA", "EU only", "US only"] },
    { labelKey: "compare_row_ownership", values: [true, true, true, true] },
  ];

  const canadaRows: CompareRow[] = [
    { labelKey: "compare_row_price", special: "price", values: [null, "€39.99", "€25.99", "€29.99"] },
    { labelKey: "compare_row_canadian", highlight: true, badgeKey: "compare_row_us_focus", values: [true, true, partial, partial] },
    { labelKey: "compare_row_korean", highlight: true, badgeKey: "compare_row_only_us", values: [true, false, false, false] },
    { labelKey: "compare_row_us", values: [true, true, partial, true] },
    { labelKey: "compare_row_mileage", values: [true, true, true, true] },
    { labelKey: "compare_row_accident", values: [true, true, true, true] },
    { labelKey: "compare_row_salvage", values: [true, true, true, true] },
    { labelKey: "compare_row_theft", values: [true, "US/CA", "EU only", "US only"] },
    { labelKey: "compare_row_ownership", values: [true, true, true, true] },
  ];

  const chinaRows: CompareRow[] = [
    { labelKey: "compare_row_price", special: "price", values: [null, "€39.99", "€25.99", "€29.99"] },
    { labelKey: "compare_row_chinese", highlight: true, badgeKey: "compare_row_us_focus", values: [true, partial, false, false] },
    { labelKey: "compare_row_korean", highlight: true, badgeKey: "compare_row_only_us", values: [true, false, false, false] },
    { labelKey: "compare_row_us", values: [true, true, partial, true] },
    { labelKey: "compare_row_mileage", values: [true, true, true, true] },
    { labelKey: "compare_row_accident", values: [true, true, true, true] },
    { labelKey: "compare_row_salvage", values: [true, true, true, true] },
    { labelKey: "compare_row_theft", values: [true, "US/CA", "EU only", "US only"] },
    { labelKey: "compare_row_ownership", values: [true, true, true, true] },
  ];

  const japanRows: CompareRow[] = [
    { labelKey: "compare_row_price", special: "price", values: [null, "€39.99", "€25.99", "€29.99"] },
    { labelKey: "compare_row_japanese", highlight: true, badgeKey: "compare_row_us_focus", values: [true, partial, false, false] },
    { labelKey: "compare_row_korean", highlight: true, badgeKey: "compare_row_only_us", values: [true, false, false, false] },
    { labelKey: "compare_row_us", values: [true, true, partial, true] },
    { labelKey: "compare_row_mileage", values: [true, true, true, true] },
    { labelKey: "compare_row_accident", values: [true, true, true, true] },
    { labelKey: "compare_row_salvage", values: [true, true, true, true] },
    { labelKey: "compare_row_theft", values: [true, "US/CA", "EU only", "US only"] },
    { labelKey: "compare_row_ownership", values: [true, true, true, true] },
  ];

  const uaeRows: CompareRow[] = [
    { labelKey: "compare_row_price", special: "price", values: [null, "€39.99", "€25.99", "€29.99"] },
    { labelKey: "compare_row_uae", highlight: true, badgeKey: "compare_row_us_focus", values: [true, partial, false, false] },
    { labelKey: "compare_row_korean", highlight: true, badgeKey: "compare_row_only_us", values: [true, false, false, false] },
    { labelKey: "compare_row_us", values: [true, true, partial, true] },
    { labelKey: "compare_row_mileage", values: [true, true, true, true] },
    { labelKey: "compare_row_accident", values: [true, true, true, true] },
    { labelKey: "compare_row_salvage", values: [true, true, true, true] },
    { labelKey: "compare_row_theft", values: [true, "US/CA", "EU only", "US only"] },
    { labelKey: "compare_row_ownership", values: [true, true, true, true] },
  ];

  const rows =
    market === "usa"
      ? usaRows
      : market === "canada"
        ? canadaRows
        : market === "china"
          ? chinaRows
          : market === "japan"
            ? japanRows
            : market === "uae"
              ? uaeRows
              : market === "home"
                ? homeRows
                : koreaRows;

  const descKey = market === "usa"
    ? "compare_desc_usa"
    : market === "korea"
      ? "compare_desc_korea"
      : market === "canada"
        ? "compare_desc_canada"
        : market === "china"
          ? "compare_desc_china"
          : market === "japan"
            ? "compare_desc_japan"
            : market === "uae"
              ? "compare_desc_uae"
              : "compare_desc";

  const competitors =
    market === "home" || market === "usa" || market === "canada" || market === "china" || market === "japan" || market === "uae"
      ? [
          { name: "Carfax", subKey: "compare_comp_carfax" },
          { name: "CarVertical", subKey: "compare_comp_carvertical" },
          { name: "AutoCheck", subKey: "compare_comp_autocheck" },
        ]
      : [
          { name: "Carfax", subKey: "compare_comp_carfax" },
          { name: "CarVertical", subKey: "compare_comp_carvertical" },
        ];

  const verifykmSub = t("compare_verifykm_sub");
  const priceLabel = priceLoading || displayPrice == null ? "…" : fmtPrice(displayPrice);

  const brands = [{ name: "VerifyKM", sub: verifykmSub, brand: true }, ...competitors.map((c) => ({ name: c.name, sub: t(c.subKey), brand: false }))];

  return (
    <section className="relative overflow-hidden bg-background px-4 py-16 md:py-24">
      <div className="relative mx-auto max-w-6xl">
        <EnterReveal inView y={12} className="mb-8 max-w-2xl space-y-3 md:mb-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#0088d4]">
            {t("compare_badge")}
          </p>
          <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">{t("compare_title")}</h2>
          <p className="text-base leading-relaxed text-muted-foreground">{t(descKey)}</p>
        </EnterReveal>

        <EnterReveal inView y={14}>
          <div className="overflow-hidden rounded-3xl border border-[#00a5fd]/20 bg-card shadow-[0_24px_60px_-36px_rgba(0,165,253,0.55)]">
            <div className="overflow-x-auto">
              <div className="min-w-[40rem]" style={{ display: "grid", gridTemplateColumns: `minmax(9.5rem,1.25fr) repeat(${brands.length}, minmax(6.5rem,1fr))` }}>
                <div className="border-b border-border/70 px-4 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {t("pricing_compare_feature")}
                </div>
                {brands.map((brand) => (
                  <div
                    key={brand.name}
                    className={cn(
                      "border-b border-border/70 px-3 py-4 text-center",
                      brand.brand && "bg-gradient-to-b from-[#00a5fd] to-[#0077c8] text-white",
                    )}
                  >
                    <p className={cn("text-sm font-bold", !brand.brand && "text-foreground")}>{brand.name}</p>
                    <p className={cn("mt-1 text-[11px] leading-snug", brand.brand ? "text-white/80" : "text-muted-foreground")}>
                      {brand.sub}
                    </p>
                  </div>
                ))}
                {rows.map((row) => (
                  <div key={row.labelKey} className="contents">
                    <div className="flex items-center border-b border-border/50 px-4 py-3.5 text-sm font-medium">
                      {t(row.labelKey)}
                    </div>
                    <div className="flex items-center justify-center border-b border-[#00a5fd]/15 bg-[#00a5fd]/[0.07] px-2 py-3.5">
                      {row.special === "price" ? (
                        <span className="text-sm font-bold tabular-nums text-[#0088d4] dark:text-[#33bbfd]">{priceLabel}</span>
                      ) : (
                        <Verdict value={row.values[0]} brand />
                      )}
                    </div>
                    {competitors.map((c, ci) => (
                      <div key={c.name} className="flex items-center justify-center border-b border-border/50 px-2 py-3.5 text-muted-foreground">
                        {row.special === "price" ? (
                          <span className="text-sm tabular-nums">{row.values[ci + 1]}</span>
                        ) : (
                          <Verdict value={row.values[ci + 1]} />
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-border/70 bg-muted/30 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-xl text-[11px] leading-relaxed text-muted-foreground">
                {t(
                  market === "home" || market === "usa" || market === "canada"
                    ? "compare_disclaimer_usa"
                    : "compare_disclaimer",
                )}
              </p>
              <Button asChild className="h-10 shrink-0 rounded-full px-5 font-bold">
                <Link href={pathFor(language, "pricing")}>{t("compare_cta_label")}</Link>
              </Button>
            </div>
          </div>
        </EnterReveal>
      </div>
    </section>
  );
}
