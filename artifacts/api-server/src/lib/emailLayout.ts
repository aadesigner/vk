/** Table-based email wrapper — no DB dependencies. */

/** Navbar wordmark with a transparent background (not the black-canvas original). */
const EMAIL_LOGO_PATH = "/brand/logo-nav.png";
const EMAIL_LOGO_WIDTH = 200;

/** Matches public navbar / admin chrome — navy + cyan, not kmcheck green. */
export const EMAIL_BRAND = {
  navy: "#030712",
  navyMid: "#071018",
  cyan: "#00a5fd",
  cyanDeep: "#0088d4",
  cyanSoft: "#7dd3fc",
  wash: "#f7fbfe",
  page: "#eef6fb",
  ink: "#111111",
  muted: "#444444",
} as const;

const EMAIL_HEADER_GRADIENT =
  `linear-gradient(135deg, #02060c 0%, ${EMAIL_BRAND.navy} 38%, ${EMAIL_BRAND.navyMid} 72%, ${EMAIL_BRAND.navy} 100%)`;
const EMAIL_ACCENT_GRADIENT =
  `linear-gradient(90deg, ${EMAIL_BRAND.cyanDeep} 0%, ${EMAIL_BRAND.cyan} 50%, ${EMAIL_BRAND.cyanSoft} 100%)`;

export function emailBrandLogoUrl(siteUrl?: string): string {
  const base = (siteUrl ?? "https://verifykm.com").replace(/\/$/, "");
  return `${base}${EMAIL_LOGO_PATH}`;
}

export function emailCtaButton(href: string, label: string): string {
  return `
<table cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td bgcolor="${EMAIL_BRAND.cyan}" style="border-radius:8px;background-color:${EMAIL_BRAND.cyan}">
      <a href="${href}" style="display:inline-block;padding:13px 28px;color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;font-family:Arial,Helvetica,sans-serif">${label}</a>
    </td>
  </tr>
</table>`;
}

function emailHeaderBlock(siteUrl: string): string {
  const logoUrl = emailBrandLogoUrl(siteUrl);
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
  <tr>
    <td bgcolor="${EMAIL_BRAND.navy}" style="padding:26px 32px 22px;background-color:${EMAIL_BRAND.navy};background-image:${EMAIL_HEADER_GRADIENT};text-align:left">
      <a href="${siteUrl}" style="text-decoration:none;display:inline-block;line-height:0">
        <img src="${logoUrl}" width="${EMAIL_LOGO_WIDTH}" alt="verifykm.com" border="0" style="display:block;border:0;outline:none;text-decoration:none;width:${EMAIL_LOGO_WIDTH}px;max-width:100%;height:auto;background-color:transparent" />
      </a>
    </td>
  </tr>
  <tr>
    <td bgcolor="${EMAIL_BRAND.cyan}" style="height:4px;line-height:4px;font-size:0;background-color:${EMAIL_BRAND.cyan};background-image:${EMAIL_ACCENT_GRADIENT}">&nbsp;</td>
  </tr>
</table>`;
}

export function buildEmailBase(content: string, preheader?: string, siteUrl?: string): string {
  const year = new Date().getFullYear();
  const base = (siteUrl ?? "https://verifykm.com").replace(/\/$/, "");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>verifykm</title>
</head>
<body style="margin:0;padding:0;background:${EMAIL_BRAND.page};font-family:Arial,Helvetica,sans-serif">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:${EMAIL_BRAND.page};line-height:1px">${preheader}&nbsp;&zwnj;&nbsp;</div>` : ""}
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${EMAIL_BRAND.page}">
  <tr>
    <td align="center" style="padding:32px 16px">
      <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #d7e6f0">
        <tr>
          <td style="padding:0">
            ${emailHeaderBlock(base)}
          </td>
        </tr>
        <tr>
          <td style="padding:32px;color:${EMAIL_BRAND.ink};font-size:15px;line-height:1.6;font-family:Arial,Helvetica,sans-serif">
            ${content}
          </td>
        </tr>
        <tr>
          <td bgcolor="${EMAIL_BRAND.wash}" style="padding:20px 32px;background:${EMAIL_BRAND.wash};border-top:1px solid #d7e6f0;text-align:center">
            <p style="margin:0;font-size:11px;color:#7a8b99;font-family:Arial,Helvetica,sans-serif">
              <a href="${base}" style="color:#7a8b99;text-decoration:none">${base.replace(/^https?:\/\//, "")}</a> &middot; VIN History Reports
            </p>
            <p style="margin:5px 0 0;font-size:11px;color:#7a8b99;font-family:Arial,Helvetica,sans-serif">
              &copy; ${year} verifykm. All rights reserved.
            </p>
            <p style="margin:8px 0 0;font-size:11px;color:#7a8b99;font-family:Arial,Helvetica,sans-serif">
              You received this email because you have an account on our platform.<br>
              If you no longer wish to receive these emails, <a href="${base}/unsubscribe" style="color:#7a8b99;text-decoration:underline">unsubscribe here</a>.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
