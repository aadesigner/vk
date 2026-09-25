import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { useLightMotion } from "@/hooks/use-light-motion";

type EnterRevealProps = {
  children: ReactNode;
  className?: string;
  /** Stagger delay — capped on desktop; ignored when light motion. */
  delay?: number;
  y?: number;
  /** Fade when scrolled into view (below-the-fold blocks). */
  inView?: boolean;
};

/** Slightly snappier “scan reveal” — distinct from kmcheck’s soft ease. */
const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/**
 * Page/section enter animation that never blanks content.
 *
 * - Never starts at opacity:0 (SEO + iOS Safari first paint).
 * - Mobile / touch / reduced-motion: plain DOM, instant paint.
 * - Desktop: short clip-style rise + subtle scale.
 */
export function EnterReveal({
  children,
  className,
  delay = 0,
  y = 18,
  inView = false,
}: EnterRevealProps) {
  const light = useLightMotion();

  if (light) {
    return <div className={className}>{children}</div>;
  }

  const offset = Math.min(Math.max(y, 0), 22);
  const transition = {
    duration: 0.42,
    ease: EASE,
    delay: Math.min(Math.max(delay, 0), 0.12),
  };

  const initial = { opacity: 1, y: offset, scale: 0.985 };
  const animate = { opacity: 1, y: 0, scale: 1 };

  if (inView) {
    return (
      <motion.div
        className={className}
        initial={initial}
        whileInView={animate}
        viewport={{ once: true, margin: "80px 0px", amount: 0.08 }}
        transition={transition}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      className={className}
      initial={initial}
      animate={animate}
      transition={transition}
    >
      {children}
    </motion.div>
  );
}
