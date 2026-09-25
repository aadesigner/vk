/** Host suffixes allowed for VIN image proxy upstream fetches. */
const ALLOWED_HOST_SUFFIXES = [
  "encar.com",
  "api.encar.com",
  "ci.encar.com",
  "img.encar.com",
  "carstat.dev",
  "api.carstat.dev",
  "cloudfront.net",
  "amazonaws.com",
  "akamaized.net",
  "blob.core.windows.net",
  "googleusercontent.com",
  "wp.com",
  "imgix.net",
  "getcarapi.com",
  "imgsv.getcarapi.com",
];

export function isAllowedImageHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!host) return false;
  return ALLOWED_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

export function assertAllowedImageUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid image URL");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Image URL must use HTTP(S)");
  }
  if (!isAllowedImageHost(parsed.hostname)) {
    throw new Error(`Image host not allowed: ${parsed.hostname}`);
  }
  return parsed;
}
