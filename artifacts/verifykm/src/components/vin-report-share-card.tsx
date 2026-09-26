import { useTranslation } from "@/i18n/context";
import {
  VinReportShareActions,
  VinReportDataDisclaimer,
  type VinShareActionsProps,
} from "@/components/vin-report-share-actions";

export function VinReportShareCard(props: VinShareActionsProps) {
  const { t } = useTranslation();

  return (
    <section
      className="print:hidden mt-8 sm:mt-10"
      aria-labelledby="vin-share-section-title"
    >
      <div className="overflow-hidden rounded-2xl border border-[#071018] bg-[#071018] text-white">
        <div className="px-4 py-5 sm:px-6 sm:py-6">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#7dd3fc]">
            {t("vin_share_panel_badge")}
          </p>
          <h2
            id="vin-share-section-title"
            className="mt-1.5 text-lg font-extrabold tracking-tight sm:text-xl"
          >
            {t("vin_result_share_title")}
          </h2>
          <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-white/55">
            {t("vin_share_panel_desc")}
          </p>

          <VinReportShareActions {...props} disabled={props.disabled} className="mt-5" />
        </div>
        <div className="border-t border-white/10 px-4 py-3 sm:px-6">
          <VinReportDataDisclaimer className="text-white/40" />
        </div>
      </div>
    </section>
  );
}
