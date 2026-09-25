import type { ReactNode } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useTranslation } from "@/i18n/context";
import { cn } from "@/lib/utils";

export type SiteFaqItem = {
  q: string;
  a: ReactNode;
};

/** Same question list used on the FAQ page. */
export function SiteFaqAccordion({
  items,
  idPrefix = "faq",
  startIndex = 0,
}: {
  items: SiteFaqItem[];
  idPrefix?: string;
  startIndex?: number;
}) {
  const { t } = useTranslation();

  return (
    <Accordion type="single" collapsible className="overflow-hidden rounded-md border border-border/70 bg-background">
      {items.map((item, i) => (
        <AccordionItem
          key={`${idPrefix}-${i}`}
          value={`${idPrefix}-${i}`}
          className={cn(
            "group relative border-b-0 data-[state=open]:bg-[#00a5fd]/[0.03]",
            i > 0 && "border-t border-border/60",
          )}
        >
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 w-[3px] bg-transparent transition-colors group-data-[state=open]:bg-[#00a5fd]"
          />
          <AccordionTrigger className="min-w-0 gap-3 px-4 py-3.5 pl-5 text-left text-[15px] font-semibold hover:no-underline sm:px-5 sm:pl-6">
            <span className="flex min-w-0 items-start gap-3">
              <span className="mt-0.5 shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#0088d4] dark:text-[#33bbfd]">
                {t("faq_question_abbr")}-{String(startIndex + i + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0 leading-snug">{item.q}</span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 pl-5 text-sm leading-relaxed text-muted-foreground sm:px-5 sm:pl-6">
            <div className="flex gap-3 border-t border-dashed border-border/60 pt-3">
              <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/60">
                {t("faq_answer_abbr")}
              </span>
              <div className="min-w-0 flex-1">{item.a}</div>
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
