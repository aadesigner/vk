import { describe, expect, it } from "vitest";
import {
  localizeProviderDate,
  translateProviderChartLabel,
} from "../../../verifykm/src/lib/korean-provider-text";

const ENGLISH_MONTH =
  /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\b/i;

const LANGS = ["sq", "ar", "uk", "ru"] as const;

const AUCTION_SAMPLES = [
  "2025-11-13",
  "2025-11-13T21:55:12.000000Z",
  "May 18, 2021",
  "November 13, 2025",
  "2021-05-18",
  "Jun 07, 2026",
  "Nov 13, 2025",
  "13 Nov 2025",
  "2026-06-07",
  "05/18/2021",
  "2021-05",
  "July 2015",
  "Mon Nov 13 2025 00:00:00 GMT",
];

const EDGE_SAMPLES = [
  "23.08.2016",
  "08.23.2016",
  "2016/08/23",
  "23-08-2016",
  "18 May 2021",
  "2025-11-13 00:00:00",
];

describe("verifykm auction date localization", () => {
  for (const lang of LANGS) {
    for (const input of AUCTION_SAMPLES) {
      it(`${lang}: ${input}`, () => {
        const result = localizeProviderDate(input, lang, 2020);
        expect(result, `localizeProviderDate(${input})`).toBeTruthy();
        expect(result!, `localizeProviderDate(${input})`).not.toMatch(ENGLISH_MONTH);

        const chart = translateProviderChartLabel(input, lang);
        if (chart) {
          expect(chart, `translateProviderChartLabel(${input})`).not.toMatch(ENGLISH_MONTH);
        }
      });
    }
  }
});

describe("verifykm auction date edge formats", () => {
  for (const lang of LANGS) {
    for (const input of EDGE_SAMPLES) {
      it(`${lang}: ${input}`, () => {
        const result = localizeProviderDate(input, lang, 2020);
        expect(result, `localizeProviderDate(${input})`).toBeTruthy();
        expect(result!, `localizeProviderDate(${input})`).not.toMatch(ENGLISH_MONTH);
      });
    }
  }
});
