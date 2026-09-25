import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "@/i18n/context";
import { cn } from "@/lib/utils";
import type { ActiveMapLivePing } from "@/lib/coverage-live-events";

type Props = {
  pings: ActiveMapLivePing[];
  className?: string;
  /** Floating panel over the map */
  onMap?: boolean;
};

export function CountryLiveFeedStrip({ pings, className, onMap = false }: Props) {
  const { t } = useTranslation();
  const recent = [...pings].slice(-3).reverse();

  return (
    <div
      className={cn(
        onMap
          ? "rounded-xl border border-primary/20 bg-background/88 px-3 py-2.5 shadow-lg shadow-black/10 max-sm:backdrop-blur-none sm:backdrop-blur-md dark:bg-background/80 dark:shadow-black/30"
          : "border-t border-border/50 bg-muted/[0.18] px-2.5 py-2",
        className,
      )}
    >
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-50" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
        </span>
        <span className="text-[9px] font-bold uppercase tracking-wider text-primary">
          {t("live_feed_badge")}
        </span>
      </div>

      <ul className="space-y-1 min-h-[2.75rem]">
        <AnimatePresence initial={false} mode="popLayout">
          {recent.map((ping) => (
            <motion.li
              key={ping.pingId}
              layout
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className="flex items-center gap-1.5 text-[10px] leading-tight"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/80" />
              <span className="shrink-0 font-semibold text-foreground/85">
                {t(ping.city.cityLabelKey)}
              </span>
              <span className="min-w-0 truncate text-muted-foreground">
                {t(ping.eventKey)}
              </span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}
