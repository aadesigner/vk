import { InsuranceCardIllustration } from "@/components/insurance-card-illustration";
import { cn } from "@/lib/utils";

const VIN_SAMPLE = "1HGBH41JXMN109186";

const vinHelpPhoto = (file: string) => {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${base}/vin-help/${file}`;
};

type SceneId = "dashboard" | "door" | "documents";

type SceneLayout = {
  src: string;
  objectPosition: string;
  imageScale?: number;
  lookClass: string;
  vinClass: string;
};

const SCENE_LAYOUT: Record<SceneId, SceneLayout> = {
  dashboard: {
    src: "windshield-vin.jpg",
    objectPosition: "35% 78%",
    imageScale: 1.12,
    lookClass: "top-[8%] left-[6%] sm:left-[8%]",
    vinClass: "bottom-[18%] left-[8%] w-[58%] max-w-[210px]",
  },
  door: {
    src: "door-jamb-vin.jpg",
    objectPosition: "48% 55%",
    imageScale: 1.2,
    lookClass: "top-[8%] left-[8%] sm:left-[10%]",
    vinClass: "bottom-[20%] left-[8%] w-[48%] max-w-[170px]",
  },
  documents: {
    src: "registration-doc.jpg",
    objectPosition: "50% 32%",
    imageScale: 1.02,
    lookClass: "top-[10%] left-[6%] sm:left-[8%]",
    vinClass: "top-[28%] left-[8%] w-[58%] max-w-[220px]",
  },
};

const INSURANCE_SCENE_LAYOUT = {
  lookClass: "top-[8%] right-[8%] sm:right-[10%]",
  vinClass: "bottom-[22%] left-[8%] w-[62%] max-w-[240px]",
};

type SceneProps = {
  vinLabel: string;
  lookHereLabel: string;
  imageAlt?: string;
  className?: string;
  rtl?: boolean;
};

function VinHighlight({
  vinLabel,
  vin = VIN_SAMPLE,
  className,
  compact,
}: {
  vinLabel: string;
  vin?: string;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border-2 border-primary bg-background/95 backdrop-blur-sm shadow-lg shadow-black/25",
        compact ? "px-2 py-1.5" : "px-2.5 py-2",
        className,
      )}
    >
      <p
        className={cn(
          "font-semibold uppercase tracking-wide text-muted-foreground",
          compact ? "text-[7px]" : "text-[8px]",
        )}
      >
        {vinLabel}
      </p>
      <p
        className={cn(
          "font-mono font-bold text-primary leading-tight break-all",
          compact ? "text-[8px] sm:text-[9px]" : "text-[9px] sm:text-[10px]",
        )}
      >
        {vin}
      </p>
    </div>
  );
}

function LookHereBadge({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide text-primary-foreground shadow-md shadow-black/30 whitespace-nowrap",
        className,
      )}
    >
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-foreground opacity-70" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-foreground" />
      </span>
      {label}
    </span>
  );
}

function mirrorRtlClass(cls: string) {
  return cls
    .replace(/left-/g, "TEMP-")
    .replace(/right-/g, "left-")
    .replace(/TEMP-/g, "right-")
    .replace("translate-x-1/2", "translate-x-0");
}

function PhotoVinScene({
  sceneId,
  vinLabel,
  lookHereLabel,
  imageAlt,
  className,
  rtl,
}: SceneProps & { sceneId: SceneId }) {
  const layout = SCENE_LAYOUT[sceneId];
  const lookPos = rtl && sceneId === "dashboard"
    ? mirrorRtlClass(layout.lookClass)
    : layout.lookClass;
  const vinPos = rtl && (sceneId === "dashboard" || sceneId === "door")
    ? mirrorRtlClass(layout.vinClass)
    : layout.vinClass;

  return (
    <div className={cn("relative w-full h-full min-h-[210px] sm:min-h-[250px] overflow-hidden", className)}>
      <img
        src={vinHelpPhoto(layout.src)}
        alt={imageAlt}
        className="absolute inset-0 h-full w-full object-cover"
        style={{
          objectPosition: layout.objectPosition,
          transform: layout.imageScale ? `scale(${layout.imageScale})` : undefined,
        }}
        loading="eager"
        decoding="async"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/30" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_45%_at_50%_55%,transparent_0%,rgba(0,0,0,0.35)_100%)]" />

      <div className={cn("absolute z-10", lookPos)}>
        <LookHereBadge label={lookHereLabel} />
      </div>

      <div className={cn("absolute z-10", vinPos)}>
        <div className="relative">
          <span
            aria-hidden
            className="absolute -inset-1 rounded-lg bg-primary/35 blur-sm animate-pulse"
          />
          <VinHighlight vinLabel={vinLabel} compact={sceneId === "door"} />
        </div>
      </div>
    </div>
  );
}

export function VinHelpSceneWindshield(props: SceneProps) {
  return <PhotoVinScene sceneId="dashboard" {...props} />;
}

export function VinHelpSceneDoor(props: SceneProps) {
  return <PhotoVinScene sceneId="door" {...props} />;
}

export function VinHelpSceneDocuments(props: SceneProps) {
  return <PhotoVinScene sceneId="documents" {...props} />;
}

export function VinHelpSceneInsurance({
  vinLabel,
  lookHereLabel,
  className,
}: SceneProps) {
  const layout = INSURANCE_SCENE_LAYOUT;
  const lookPos = layout.lookClass;
  const vinPos = layout.vinClass;

  return (
    <div className={cn("relative w-full h-full min-h-[210px] sm:min-h-[250px] overflow-hidden bg-slate-100", className)}>
      <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-5">
        <InsuranceCardIllustration className="max-h-full max-w-full drop-shadow-md" />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none" />

      <div className={cn("absolute z-10", lookPos)}>
        <LookHereBadge label={lookHereLabel} />
      </div>

      <div className={cn("absolute z-10", vinPos)}>
        <div className="relative">
          <span
            aria-hidden
            className="absolute -inset-1 rounded-lg bg-primary/35 blur-sm animate-pulse"
          />
          <VinHighlight vinLabel={vinLabel} />
        </div>
      </div>
    </div>
  );
}

export const VIN_HELP_SCENES = {
  dashboard: VinHelpSceneWindshield,
  door: VinHelpSceneDoor,
  documents: VinHelpSceneDocuments,
  insurance: VinHelpSceneInsurance,
} as const;
