declare module "../../scripts/country-page-json-ld.mjs" {
  export function buildCountryPageJsonLd(params: {
    pageKey: string;
    title: string;
    description: string;
    canonicalUrl: string;
    lang: string;
    ogImage?: string;
  }): Record<string, unknown>;
}
