import type { Transition, Variants } from "framer-motion";

export const EASE_OUT_EXPO: Transition["ease"] = [0.22, 1, 0.36, 1];

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.04, duration: 0.28, ease: EASE_OUT_EXPO },
  }),
};

export const fadeUpSoft: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.26, ease: EASE_OUT_EXPO },
  },
};

export const fadeDown: Variants = {
  hidden: { opacity: 0, y: -6 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.22, ease: EASE_OUT_EXPO },
  },
};
