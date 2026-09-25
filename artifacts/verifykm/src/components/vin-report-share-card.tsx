import { useTranslation } from "@/i18n/context";
import {
  VinReportShareActions,
  VinReportDataDisclaimer,
  type VinShareActionsProps,
} from "@/components/vin-report-share-actions";

export function VinReportShareCard(props: VinShareActionsProps) {
  const { t } = useTranslation();
  const { vehicleTitle, vin } = props;

  return (
    <section
      className="print:hidden mt-10 sm:mt-12"
      aria-labelledby="vin-share-section-title"
    >
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
        <div className="min-w-0">
          <h2
            id="vin-share-section-title"
            className="font-mono text-[13px] font-bold uppercase tracking-[0.16em] text-slate-800 sm:text-sm"
          >
            {t("vin_result_share_title")}
          </h2>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-slate-500">
            {t("vin_share_panel_desc")}
          </p>
        </div>
        <p className="truncate font-mono text-[12px] text-slate-400">
          <span className="text-slate-600">{vehicleTitle}</span>
          <span className="mx-2 text-slate-300">·</span>
          <span className="tracking-wide">{vin}</span>
        </p>
      </div>

      <VinReportShareActions {...props} disabled={props.disabled} className="mt-6" />
      <VinReportDataDisclaimer className="mt-5" />
    </section>
  );
}
