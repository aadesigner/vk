import { useTranslation } from "@/i18n/context";

/** Hero / country VIN form — short label when inline on narrow screens; full CTA when stacked (home mobile). */
export function VinCheckSubmitLabel({ stacked = false }: { stacked?: boolean }) {
  const { t } = useTranslation();
  if (stacked) {
    return <>{t("check_vin")}</>;
  }
  return (
    <>
      <span className="sm:hidden">{t("check_vin_short")}</span>
      <span className="hidden sm:inline">{t("check_vin")}</span>
    </>
  );
}
