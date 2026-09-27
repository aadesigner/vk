/** Instagram / Facebook / TikTok in-app browsers — grecaptcha often never loads. */
const IN_APP_UA =
  /Instagram|FBAN|FBAV|FB_IAB|FB4A|FBIOS|FB_FW|Messenger|Orca|TikTok|BytedanceWebview|Line\/|Snapchat/i;

export function isInAppWebViewUserAgent(ua: string | undefined | null): boolean {
  if (!ua) return false;
  return IN_APP_UA.test(ua);
}

export function requestUserAgent(headers?: {
  "user-agent"?: string | string[];
}): string {
  const raw = headers?.["user-agent"];
  if (Array.isArray(raw)) return raw[0] ?? "";
  return raw ?? "";
}
