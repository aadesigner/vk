/** Popular makes for free-decoder SEO cards — sample VINs are valid 17-char examples for instant local decode. */
export const FREE_DECODER_BRAND_CARDS = [
  {
    id: "bmw",
    sampleVin: "WBA3V7106FJ995387",
    accent: "from-blue-600 to-sky-500",
    ring: "ring-blue-500/25",
    bg: "bg-blue-500/10",
    text: "text-blue-600 dark:text-blue-400",
  },
  {
    id: "audi",
    sampleVin: "WAUZZZ8V1MA046048",
    accent: "from-slate-700 to-slate-500",
    ring: "ring-slate-500/25",
    bg: "bg-slate-500/10",
    text: "text-slate-700 dark:text-slate-300",
  },
  {
    id: "mercedes",
    sampleVin: "WDDGF4HB0DR303826",
    accent: "from-zinc-600 to-zinc-400",
    ring: "ring-zinc-500/25",
    bg: "bg-zinc-500/10",
    text: "text-zinc-700 dark:text-zinc-300",
  },
  {
    id: "volkswagen",
    sampleVin: "3VW2B7AJ5HM316271",
    accent: "from-indigo-600 to-blue-500",
    ring: "ring-indigo-500/25",
    bg: "bg-indigo-500/10",
    text: "text-indigo-600 dark:text-indigo-400",
  },
  {
    id: "toyota",
    sampleVin: "4T1BF1FK5GU123456",
    accent: "from-red-600 to-rose-500",
    ring: "ring-red-500/25",
    bg: "bg-red-500/10",
    text: "text-red-600 dark:text-red-400",
  },
  {
    id: "ford",
    sampleVin: "1FTEW1EP5JKD12345",
    accent: "from-blue-700 to-blue-500",
    ring: "ring-blue-600/25",
    bg: "bg-blue-600/10",
    text: "text-blue-700 dark:text-blue-400",
  },
  {
    id: "honda",
    sampleVin: "1HGBH41JXMN109186",
    accent: "from-sky-600 to-sky-500",
    ring: "ring-[#00a5fd]/25",
    bg: "bg-[#00a5fd]/10",
    text: "text-[#0088d4] dark:text-[#00a5fd]",
  },
  {
    id: "hyundai",
    sampleVin: "KMHD35LE1JA103867",
    accent: "from-cyan-600 to-sky-500",
    ring: "ring-cyan-500/25",
    bg: "bg-cyan-500/10",
    text: "text-cyan-600 dark:text-cyan-400",
  },
  {
    id: "mazda",
    sampleVin: "JM1BPAM7XK1234567",
    accent: "from-red-700 to-red-500",
    ring: "ring-red-600/25",
    bg: "bg-red-600/10",
    text: "text-red-700 dark:text-red-400",
  },
] as const;

export type FreeDecoderBrandId = (typeof FREE_DECODER_BRAND_CARDS)[number]["id"];

export const FREE_DECODER_STEPS = [
  { icon: "search", key: "free_decoder_seo_step_0" },
  { icon: "factory", key: "free_decoder_seo_step_1" },
  { icon: "settings", key: "free_decoder_seo_step_2" },
  { icon: "shield", key: "free_decoder_seo_step_3" },
] as const;

export const FREE_DECODER_FAQ_COUNT = 4;
