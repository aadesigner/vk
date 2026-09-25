import { useTranslation } from "@/i18n/context";
import type { ActiveMapLivePing } from "@/lib/coverage-live-events";
import { cn } from "@/lib/utils";
import { Marker } from "react-simple-maps";

type Props = {
  pings: ActiveMapLivePing[];
  highlightPingId?: string | null;
};

const CARD_W_LTR = 88;
const CARD_W_RTL = 92;
const CARD_H = 22;
const CARET_H = 7;
const GAP = 5;

function LiveFeedLabel({ eventKey }: { eventKey: string }) {
  const { t, dir } = useTranslation();

  return (
    <div
      dir={dir}
      className="coverage-map-live-label-chip"
      {...({ xmlns: "http://www.w3.org/1999/xhtml" } as React.HTMLAttributes<HTMLDivElement>)}
    >
      <span className="coverage-map-live-label-dot" aria-hidden />
      <span className="coverage-map-live-label-text">{t(eventKey)}</span>
    </div>
  );
}

export function CoverageMapLiveMarkers({ pings, highlightPingId = null }: Props) {
  const { dir } = useTranslation();
  const cardW = dir === "rtl" ? CARD_W_RTL : CARD_W_LTR;
  const labelOffsetY = -(CARD_H + CARET_H + GAP);

  return (
    <>
      {pings.map((ping, i) => {
        const { city, eventKey, showLabel, pingId } = ping;
        const delay = `${i * 0.3}s`;
        const highlighted = pingId === highlightPingId;

        return (
          <Marker key={pingId} coordinates={city.coordinates}>
            <g className="coverage-map-live-marker" style={{ animationDelay: delay }}>
              <circle
                r={highlighted ? 20 : 16}
                fill={highlighted ? "hsl(var(--primary) / 0.32)" : "hsl(var(--primary) / 0.2)"}
                className={cn("coverage-map-live-ring", highlighted && "coverage-map-live-ring-active")}
              />
              <circle
                r={highlighted ? 5.25 : 4.25}
                fill="hsl(var(--primary))"
                stroke="hsl(var(--background))"
                strokeWidth={highlighted ? 2 : 1.5}
              />

              {showLabel && (
                <g transform={`translate(${-cardW / 2}, ${labelOffsetY})`} className="coverage-map-live-label-layer">
                  <g className={cn("coverage-map-live-label", highlighted && "coverage-map-live-label-active")}>
                    <foreignObject x={0} y={0} width={cardW} height={CARD_H}>
                      <LiveFeedLabel eventKey={eventKey} />
                    </foreignObject>
                    <path
                      d={`M ${cardW / 2 - 7} ${CARD_H} L ${cardW / 2} ${CARD_H + CARET_H} L ${cardW / 2 + 7} ${CARD_H} Z`}
                      fill="hsl(var(--background) / 0.96)"
                      stroke="hsl(var(--primary) / 0.35)"
                      strokeWidth={0.85}
                      strokeLinejoin="round"
                    />
                    <path
                      d={`M ${cardW / 2 - 6} ${CARD_H + 0.5} L ${cardW / 2} ${CARD_H + CARET_H - 0.5} L ${cardW / 2 + 6} ${CARD_H + 0.5} Z`}
                      fill="hsl(var(--background) / 0.96)"
                    />
                  </g>
                </g>
              )}
            </g>
          </Marker>
        );
      })}
    </>
  );
}
