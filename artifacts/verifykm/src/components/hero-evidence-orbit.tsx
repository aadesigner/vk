/**
 * Decorative hero backdrop — VIN “dossier scan” (not a world map).
 * Pure CSS animation; no topojson / maps dependency.
 */
import { useTranslation } from "@/i18n/context";

export function HeroEvidenceOrbit({ className = "" }: { className?: string }) {
  const { t } = useTranslation();
  const slots = "WVWZZZ3CZWE123456".split("");

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      {/* Diagonal blueprint grid */}
      <div className="absolute inset-0 opacity-[0.14] [background-image:linear-gradient(rgba(0,165,253,0.35)_1px,transparent_1px),linear-gradient(90deg,rgba(0,165,253,0.35)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_40%,#000_20%,transparent_75%)]" />

      {/* Soft radial wash */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_50%_at_50%_35%,rgba(0,165,253,0.18),transparent_70%)]" />

      {/* Floating evidence chips */}
      <div className="absolute left-[6%] top-[28%] hidden xl:block rotate-[-8deg]">
        <EvidenceChip label={t("hero_chip_odometer_label")} value={t("hero_chip_odometer_value")} delay="0s" />
      </div>
      <div className="absolute right-[7%] top-[32%] hidden xl:block rotate-[7deg]">
        <EvidenceChip label={t("hero_chip_title_label")} value={t("hero_chip_title_value")} delay="0.4s" />
      </div>
      <div className="absolute left-[10%] bottom-[18%] hidden xl:block rotate-[4deg]">
        <EvidenceChip label={t("hero_chip_claims_label")} value={t("hero_chip_claims_value")} delay="0.8s" />
      </div>
      <div className="absolute right-[9%] bottom-[22%] hidden xl:block rotate-[-5deg]">
        <EvidenceChip label={t("hero_chip_auction_label")} value={t("hero_chip_auction_value")} delay="1.2s" />
      </div>

      {/* Center VIN digit rail — kept low so it never sits under the headline */}
      <div className="absolute left-1/2 bottom-[8%] hidden lg:flex -translate-x-1/2 gap-1 opacity-25">
        {slots.map((ch, i) => (
          <span
            key={`${ch}-${i}`}
            className="vk-vin-slot flex h-9 w-7 items-center justify-center rounded-sm border border-[#00a5fd]/35 bg-[#030712]/60 font-mono text-sm font-semibold text-[#7dd3fc]"
            style={{ animationDelay: `${i * 0.08}s` }}
          >
            {ch}
          </span>
        ))}
      </div>

      {/* Horizontal scan beam */}
      <div className="vk-hero-beam absolute inset-x-0 bottom-[18%] h-px bg-gradient-to-r from-transparent via-[#00a5fd]/70 to-transparent" />
    </div>
  );
}

function EvidenceChip({
  label,
  value,
  delay,
}: {
  label: string;
  value: string;
  delay: string;
}) {
  return (
    <div
      className="vk-evidence-float rounded-md border border-[#00a5fd]/30 bg-[#030712]/85 px-3.5 py-2.5 shadow-[0_12px_40px_-16px_rgba(0,165,253,0.55)] backdrop-blur-sm"
      style={{ animationDelay: delay }}
    >
      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#00a5fd]">{label}</p>
      <p className="mt-0.5 text-xs font-semibold text-white/85">{value}</p>
    </div>
  );
}
