import { cn } from "@/lib/utils";

type Props = {
  className?: string;
};

/** Bundled English US auto insurance ID card — avoids relying on a separate static SVG asset. */
export function InsuranceCardIllustration({ className }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 960 540"
      fill="none"
      className={cn("h-full w-full", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id="insurance-bg" x1="0" y1="0" x2="960" y2="540" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f8fafc" />
          <stop offset="1" stopColor="#e2e8f0" />
        </linearGradient>
        <linearGradient id="insurance-header" x1="0" y1="0" x2="960" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0f766e" />
          <stop offset="1" stopColor="#059669" />
        </linearGradient>
      </defs>
      <rect width="960" height="540" fill="url(#insurance-bg)" />
      <rect x="48" y="48" width="864" height="444" rx="24" fill="#ffffff" stroke="#cbd5e1" strokeWidth="3" />
      <rect x="48" y="48" width="864" height="92" rx="24" fill="url(#insurance-header)" />
      <rect x="48" y="116" width="864" height="24" fill="url(#insurance-header)" />
      <circle cx="108" cy="94" r="28" fill="#ffffff" fillOpacity="0.18" />
      <path d="M96 94h24M108 82v24" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" />
      <text x="156" y="88" fill="#ffffff" fontFamily="Arial, Helvetica, sans-serif" fontSize="28" fontWeight="700">
        AUTO INSURANCE ID CARD
      </text>
      <text x="156" y="118" fill="#d1fae5" fontFamily="Arial, Helvetica, sans-serif" fontSize="18">
        Proof of insurance - keep in vehicle
      </text>
      <text x="88" y="188" fill="#64748b" fontFamily="Arial, Helvetica, sans-serif" fontSize="16" fontWeight="700" letterSpacing="1.2">
        INSURED
      </text>
      <text x="88" y="218" fill="#0f172a" fontFamily="Arial, Helvetica, sans-serif" fontSize="26" fontWeight="700">
        JOHN SMITH
      </text>
      <text x="88" y="268" fill="#64748b" fontFamily="Arial, Helvetica, sans-serif" fontSize="16" fontWeight="700" letterSpacing="1.2">
        VEHICLE
      </text>
      <text x="88" y="298" fill="#0f172a" fontFamily="Arial, Helvetica, sans-serif" fontSize="24" fontWeight="700">
        2022 TOYOTA RAV4
      </text>
      <text x="88" y="332" fill="#475569" fontFamily="Arial, Helvetica, sans-serif" fontSize="20">
        Plate: ABC-1234 - Policy: P-8849201
      </text>
      <rect x="88" y="362" width="784" height="96" rx="14" fill="#ecfdf5" stroke="#6ee7b7" strokeWidth="2" />
      <text x="112" y="392" fill="#047857" fontFamily="Arial, Helvetica, sans-serif" fontSize="16" fontWeight="700" letterSpacing="1.1">
        VEHICLE IDENTIFICATION NUMBER (VIN)
      </text>
      <text x="112" y="432" fill="#075985" fontFamily="Consolas, Monaco, monospace" fontSize="34" fontWeight="700">
        1HGBH41JXMN109186
      </text>
      <text x="88" y="492" fill="#64748b" fontFamily="Arial, Helvetica, sans-serif" fontSize="16">
        Effective 01/15/2026 - 01/15/2027 - Insurer: Sample Mutual Insurance Co.
      </text>
    </svg>
  );
}
