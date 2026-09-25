import { useState, useRef, useLayoutEffect, useCallback } from "react";
import { Car, DoorOpen, FileText, Shield } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "@/i18n/context";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { VIN_HELP_SCENES } from "@/components/vin-find-help-illustrations";

const LOCATIONS = [
  {
    id: "dashboard" as const,
    icon: Car,
    tabKey: "vin_find_tab_dashboard",
    titleKey: "vin_find_loc_dashboard_title",
    descKey: "vin_find_loc_dashboard_desc",
    altKey: "vin_find_alt_dashboard",
  },
  {
    id: "door" as const,
    icon: DoorOpen,
    tabKey: "vin_find_tab_door",
    titleKey: "vin_find_loc_door_title",
    descKey: "vin_find_loc_door_desc",
    altKey: "vin_find_alt_door",
  },
  {
    id: "documents" as const,
    icon: FileText,
    tabKey: "vin_find_tab_documents",
    titleKey: "vin_find_loc_documents_title",
    descKey: "vin_find_loc_documents_desc",
    altKey: "vin_find_alt_documents",
  },
  {
    id: "insurance" as const,
    icon: Shield,
    tabKey: "vin_find_tab_insurance",
    titleKey: "vin_find_loc_insurance_title",
    descKey: "vin_find_loc_insurance_desc",
    altKey: "vin_find_loc_insurance_title",
  },
];

type Variant = "default" | "on-dark";

type Props = {
  variant?: Variant;
  className?: string;
};

export function WhereToFindVinHelp({ variant = "default", className }: Props) {
  const { t, language } = useTranslation();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [transformOrigin, setTransformOrigin] = useState("center center");

  const updateTransformOrigin = useCallback(() => {
    const trigger = triggerRef.current;
    const dialog = contentRef.current;
    if (!trigger || !dialog) return;
    const tr = trigger.getBoundingClientRect();
    const dr = dialog.getBoundingClientRect();
    const x = tr.left + tr.width / 2 - dr.left;
    const y = tr.top + tr.height / 2 - dr.top;
    setTransformOrigin(`${x}px ${y}px`);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updateTransformOrigin();
    const raf = requestAnimationFrame(updateTransformOrigin);
    return () => cancelAnimationFrame(raf);
  }, [open, updateTransformOrigin]);

  const loc = LOCATIONS[active];
  const Scene = VIN_HELP_SCENES[loc.id];
  const vinLabel = t("vin_label");

  return (
    <>
      <div className={cn("flex w-full justify-center pt-0.5", className)}>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "text-xs font-medium underline-offset-2 hover:underline sm:text-sm",
            variant === "on-dark" ? "text-[#9fd4f5] hover:text-white" : "text-[#0088d4] hover:text-[#0077c8]",
          )}
        >
          {t("vin_find_help_link")}
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          ref={contentRef}
          variant="anchored"
          style={{ transformOrigin }}
          className={cn(
            "gap-0 overflow-hidden p-0",
            "max-h-[min(92dvh,720px)] overflow-y-auto md:max-h-[min(90dvh,820px)]",
            "border-[#071018]/10 sm:max-w-xl md:max-w-2xl",
          )}
        >
          <div className="bg-[#071018] px-5 pb-4 pt-5 text-white sm:px-6 sm:pt-6">
            <DialogHeader className={cn("text-start", language === "ar" && "text-right")}>
              <DialogTitle className="pr-8 text-lg font-bold leading-snug text-white sm:text-xl">
                {t("vin_find_help_title")}
              </DialogTitle>
              <DialogDescription className="sr-only">
                {t("vin_find_help_intro")}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="border-b border-border/70 px-3 sm:px-5">
            <div
              className="grid grid-cols-2 sm:flex"
              role="tablist"
              aria-label={t("vin_find_help_title")}
            >
              {LOCATIONS.map((item, i) => {
                const Icon = item.icon;
                const selected = i === active;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setActive(i)}
                    className={cn(
                      "relative flex min-h-11 items-center justify-center gap-1.5 px-2 py-2.5 text-[11px] font-semibold sm:flex-1 sm:text-xs",
                      selected ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className={cn("h-3.5 w-3.5 shrink-0", selected && "text-[#0088d4]")} />
                    <span className="text-center leading-tight">{t(item.tabKey)}</span>
                    {selected ? (
                      <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[#00a5fd]" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-4 px-4 py-4 sm:px-6 sm:py-5">
            <div className="relative min-h-[210px] overflow-hidden rounded-xl border border-[#00a5fd]/20 bg-[#f7fafc] dark:bg-[#071018] sm:min-h-[250px] md:min-h-[300px]">
              <span aria-hidden className="absolute inset-y-0 left-0 z-[1] w-1 bg-[#00a5fd]" />
              <AnimatePresence mode="wait">
                <motion.div
                  key={loc.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="relative min-h-[210px] w-full sm:min-h-[250px] md:min-h-[300px]"
                >
                  <Scene
                    vinLabel={vinLabel}
                    lookHereLabel={t("vin_find_scene_look_here")}
                    imageAlt={t(loc.altKey)}
                    rtl={language === "ar"}
                    className="absolute inset-0"
                  />
                </motion.div>
              </AnimatePresence>
            </div>

            <div className={cn("space-y-1.5 text-start", language === "ar" && "text-right")}>
              <h3 className="text-base font-bold text-foreground sm:text-lg">{t(loc.titleKey)}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{t(loc.descKey)}</p>
              <p className="pt-1 font-mono text-[11px] font-semibold tracking-wide text-[#0088d4]">
                {t("vin_find_help_tip")}
              </p>
            </div>
          </div>

          <div className={cn("flex justify-end px-4 pb-5 sm:px-6", language === "ar" && "justify-start")}>
            <Button type="button" className="h-10 rounded-lg px-5 font-semibold" onClick={() => setOpen(false)}>
              {t("vin_find_help_got_it")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
