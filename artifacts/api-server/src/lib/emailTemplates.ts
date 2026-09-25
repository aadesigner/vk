import { buildEmailBase } from "./emailLayout.js";

/**
 * `vinready` is the single combined report-ready + payment-confirmation email.
 * The former separate `confirm` template was merged into it.
 */
export type EmailTemplateKey = "welcome" | "vinready" | "reset" | "abandoned" | "noinfo" | "noinforefund";

export type EmailTemplateOverride = {
  subject?: string;
  contentHtml?: string;
};

export type EmailTemplatesConfig = Partial<Record<EmailTemplateKey, EmailTemplateOverride>>;

export const EMAIL_TEMPLATE_VARIABLES: Record<EmailTemplateKey, string[]> = {
  welcome: ["name", "siteUrl"],
  vinready: [
    "name", "email", "vin", "reportUrl", "vehicleLabel", "year", "make", "model",
    "mileage", "mileageText", "accidents", "owners", "amount", "paymentRef", "siteUrl",
  ],
  reset: ["resetUrl", "siteUrl"],
  abandoned: ["name", "vin", "checkoutUrl", "price", "siteUrl"],
  noinfo: ["name", "vin", "credits", "checkoutUrl", "siteUrl"],
  noinforefund: ["name", "vin", "checkoutUrl", "siteUrl"],
};

type TemplateDefaults = {
  subject: string;
  contentHtml: string;
  preheader?: string;
};

const btn = (href: string, label: string) => `
<table cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td bgcolor="#16a34a" style="border-radius:8px">
      <a href="${href}" style="display:inline-block;padding:13px 28px;color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;font-family:Arial,Helvetica,sans-serif">${label}</a>
    </td>
  </tr>
</table>`;

export const EMAIL_TEMPLATE_DEFAULTS: Record<EmailTemplateKey, TemplateDefaults> = {
  welcome: {
    subject: "Welcome to verifykm — VIN history at your fingertips",
    preheader: "Hi {{name}}, your verifykm account is ready.",
    contentHtml: `
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#111111">Welcome to verifykm! &#128075;</h1>
    <p style="margin:0 0 12px;color:#444444">Hi {{name}},</p>
    <p style="margin:0 0 24px;color:#444444">Your account is ready. You can now look up full VIN history reports &mdash; accidents, mileage, previous owners, and more &mdash; for any vehicle.</p>
    ${btn("{{siteUrl}}", "Check a VIN &rarr;")}
  `,
  },
  vinready: {
    subject: "Your verifykm report is ready — {{vin}}",
    preheader: "Payment confirmed — your VIN history report for {{vin}} is ready to view.",
    contentHtml: `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#111111">Your report is ready! &#127881;</h1>
    <p style="margin:0 0 4px;color:#444444">Hi {{name}},</p>
    <p style="margin:0 0 16px;color:#444444">Your payment is confirmed and your full VIN history report is ready to view.</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb">
      <tr>
        <td bgcolor="#f9fafb" style="padding:16px 20px;background:#f9fafb">
          <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;font-family:Arial,Helvetica,sans-serif">Vehicle</p>
          <p style="margin:0 0 6px;font-size:18px;font-weight:800;color:#111111;font-family:Arial,Helvetica,sans-serif">{{vehicleLabel}}</p>
          <p style="margin:0;font-family:monospace;font-size:13px;color:#6b7280;background:#e5e7eb;display:inline-block;padding:2px 8px;border-radius:4px">{{vin}}</p>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;font-family:Arial,Helvetica,sans-serif">Key findings</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;margin-bottom:20px">
      <tr>
        <td style="padding:10px 16px;border-bottom:1px solid #f3f4f6;font-size:14px;color:#555555;font-family:Arial,Helvetica,sans-serif">Recorded mileage</td>
        <td style="padding:10px 16px;border-bottom:1px solid #f3f4f6;font-size:14px;font-weight:700;color:#111111;text-align:right;font-family:Arial,Helvetica,sans-serif">{{mileageText}}</td>
      </tr>
      <tr>
        <td style="padding:10px 16px;border-bottom:1px solid #f3f4f6;font-size:14px;color:#555555;font-family:Arial,Helvetica,sans-serif">Reported accidents</td>
        <td style="padding:10px 16px;border-bottom:1px solid #f3f4f6;font-size:14px;font-weight:700;color:#111111;text-align:right;font-family:Arial,Helvetica,sans-serif">{{accidents}}</td>
      </tr>
      <tr>
        <td style="padding:10px 16px;font-size:14px;color:#555555;font-family:Arial,Helvetica,sans-serif">Previous owners</td>
        <td style="padding:10px 16px;font-size:14px;font-weight:700;color:#111111;text-align:right;font-family:Arial,Helvetica,sans-serif">{{owners}}</td>
      </tr>
    </table>
    ${btn("{{reportUrl}}", "View Full Report &rarr;")}
    <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;font-family:Arial,Helvetica,sans-serif">
      Amount paid: <strong style="color:#555555">{{amount}}</strong> &middot; Ref: <span style="font-family:monospace;font-size:11px">{{paymentRef}}</span>
    </p>
  `,
  },
  reset: {
    subject: "Reset your verifykm password",
    preheader: "Reset your verifykm account password — link expires in 1 hour.",
    contentHtml: `
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#111111">Reset your password</h1>
    <p style="margin:0 0 8px;color:#444444">We received a request to reset the password on your verifykm account.</p>
    <p style="margin:0 0 24px;color:#444444">Click the button below to choose a new password. This link expires in <strong>1 hour</strong>.</p>
    ${btn("{{resetUrl}}", "Reset Password &rarr;")}
    <p style="margin:24px 0 0;font-size:13px;color:#9ca3af">If you didn&apos;t request this, you can safely ignore this email. Your password won&apos;t change.</p>
  `,
  },
  abandoned: {
    subject: "Your VIN lookup is waiting — complete your purchase",
    preheader: "Complete your VIN check for {{vin}} — {{price}}.",
    contentHtml: `
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#111111">You left something behind &#128064;</h1>
    <p style="margin:0 0 8px;color:#444444">Hi {{name}},</p>
    <p style="margin:0 0 8px;color:#444444">You started a VIN check for <strong style="font-family:monospace;background:#f3f4f6;padding:2px 6px;border-radius:4px;font-size:13px">{{vin}}</strong> but haven&apos;t completed your purchase.</p>
    <p style="margin:0 0 24px;color:#444444">Your full history report is just <strong>{{price}}</strong> away.</p>
    ${btn("{{checkoutUrl}}", "Complete Purchase &mdash; {{price}} &rarr;")}
  `,
  },
  noinfo: {
    subject: "No information found for {{vin}} — {{credits}} free credit added",
    preheader: "Please double-check your VIN. Meanwhile we credited {{credits}} free report to your account.",
    contentHtml: `
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#111111">No information found</h1>
    <p style="margin:0 0 8px;color:#444444">Hi {{name}},</p>
    <p style="margin:0 0 12px;color:#444444">We looked into VIN <strong style="font-family:monospace;background:#f3f4f6;padding:2px 6px;border-radius:4px;font-size:13px">{{vin}}</strong> and found no information on this VIN.</p>
    <p style="margin:0 0 12px;color:#444444">If you typed a digit or character wrong, try again with the correct one.</p>
    <p style="margin:0 0 24px;color:#444444">Meanwhile, we have credited <strong>{{credits}} free report credit</strong> to your account. You can use it on our marketplace for another VIN check at no charge.</p>
    ${btn("{{checkoutUrl}}", "Check another VIN &rarr;")}
    <p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#888888">If you don&apos;t want to check another car, you can request a refund &mdash; just <a href="mailto:info@verifykm.com" style="color:#16a34a;text-decoration:underline">send us an email</a>.</p>
  `,
  },
  noinforefund: {
    subject: "No information for {{vin}} — full refund",
    preheader: "We found no data for this VIN and have refunded you in full.",
    contentHtml: `
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#111111">No information found</h1>
    <p style="margin:0 0 8px;color:#444444">Hi {{name}},</p>
    <p style="margin:0 0 12px;color:#444444">We looked into VIN <strong style="font-family:monospace;background:#f3f4f6;padding:2px 6px;border-radius:4px;font-size:13px">{{vin}}</strong> and found no information for this VIN.</p>
    <p style="margin:0 0 12px;color:#444444">Please double-check that the VIN was entered correctly. If it was wrong, you can purchase a new report with the correct number.</p>
    <p style="margin:0 0 24px;color:#444444">We have <strong>refunded you in full</strong>. Depending on your payment method, the refund may take a few business days to appear.</p>
    ${btn("{{checkoutUrl}}", "Check another VIN &rarr;")}
    <p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#888888">Questions? <a href="mailto:info@verifykm.com" style="color:#16a34a;text-decoration:underline">Email us</a>.</p>
  `,
  },
};

export function interpolateEmailVars(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

export function renderEmailTemplate(
  type: EmailTemplateKey,
  vars: Record<string, string>,
  override: EmailTemplateOverride | undefined,
  siteUrl: string,
): { subject: string; html: string } {
  const defaults = EMAIL_TEMPLATE_DEFAULTS[type];
  const base = siteUrl.replace(/\/$/, "");
  const subjectTpl = override?.subject?.trim() ? override.subject : defaults.subject;
  const contentTpl = override?.contentHtml?.trim() ? override.contentHtml : defaults.contentHtml;
  const subject = interpolateEmailVars(subjectTpl, vars);
  const content = interpolateEmailVars(contentTpl, vars);
  const preheader = defaults.preheader
    ? interpolateEmailVars(defaults.preheader, vars)
    : undefined;
  return {
    subject,
    html: buildEmailBase(content, preheader, base),
  };
}

export function getSampleTemplateVars(type: EmailTemplateKey, siteUrl: string): Record<string, string> {
  const base = siteUrl.replace(/\/$/, "");
  const common = { siteUrl: base, name: "Alex" };
  switch (type) {
    case "welcome":
      return common;
    case "reset":
      return { ...common, resetUrl: `${base}/en/reset-password?token=sample-token` };
    case "abandoned":
      return {
        ...common,
        vin: "WBA3A5G59DNP26082",
        checkoutUrl: `${base}/en/checkout?vin=WBA3A5G59DNP26082`,
        price: "€19.99",
      };
    case "noinfo":
      return {
        ...common,
        vin: "WBA3A5G59DNP26082",
        credits: "1",
        checkoutUrl: `${base}/en`,
      };
    case "noinforefund":
      return {
        ...common,
        vin: "WBA3A5G59DNP26082",
        checkoutUrl: `${base}/en`,
      };
    case "vinready":
      return {
        ...common,
        email: "alex@example.com",
        vin: "WBA3A5G59DNP26082",
        reportUrl: `${base}/vin/WBA3A5G59DNP26082`,
        year: "2019",
        make: "BMW",
        model: "3 Series",
        vehicleLabel: "2019 BMW 3 Series",
        mileage: "48,200",
        mileageText: "48,200 km",
        accidents: "1",
        owners: "2",
        amount: "€19.99",
        paymentRef: "5XG29384BK",
      };
    default:
      return common;
  }
}

export function mergeTemplateForAdmin(
  type: EmailTemplateKey,
  stored: EmailTemplatesConfig,
): { subject: string; contentHtml: string; isCustom: boolean; variables: string[] } {
  const defaults = EMAIL_TEMPLATE_DEFAULTS[type];
  const override = stored[type];
  const isCustom = Boolean(override?.subject?.trim() || override?.contentHtml?.trim());
  return {
    subject: override?.subject?.trim() ? override.subject : defaults.subject,
    contentHtml: override?.contentHtml?.trim() ? override.contentHtml : defaults.contentHtml,
    isCustom,
    variables: EMAIL_TEMPLATE_VARIABLES[type],
  };
}

/**
 * Vehicle title from whatever the report actually knows — "2019 BMW 3 Series",
 * "2019 BMW", or "BMW 3 Series" all render naturally.
 */
export function buildVehicleLabel(
  year?: number | null,
  make?: string | null,
  model?: string | null,
): string {
  return [year, make, model].filter(Boolean).join(" ") || "your vehicle";
}

export function formatEmailAmount(amount: number | null | undefined, currency?: string | null): string {
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return "Free";
  const symbol = (currency ?? "EUR") === "EUR" ? "€" : "$";
  return `${symbol}${amount.toFixed(2)}`;
}

/** Build string vars for the combined report-ready + payment-confirmation email. */
export function varsFromReportReady(data: {
  name: string;
  email?: string | null;
  vin: string;
  reportUrl: string;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  mileage?: number | null;
  accidents?: number | null;
  owners?: number | null;
  amount?: number | null;
  currency?: string | null;
  paymentRef?: string | null;
  siteUrl: string;
}): Record<string, string> {
  const mileage = data.mileage != null ? data.mileage.toLocaleString() : "—";
  return {
    name: data.name || "there",
    email: data.email ?? "",
    vin: data.vin,
    reportUrl: data.reportUrl,
    year: data.year != null ? String(data.year) : "",
    make: data.make ?? "",
    model: data.model ?? "",
    vehicleLabel: buildVehicleLabel(data.year, data.make, data.model),
    mileage,
    mileageText: data.mileage != null ? `${mileage} km` : "—",
    accidents: data.accidents != null ? String(data.accidents) : "—",
    owners: data.owners != null ? String(data.owners) : "—",
    amount: formatEmailAmount(data.amount, data.currency),
    paymentRef: data.paymentRef ?? "—",
    siteUrl: data.siteUrl.replace(/\/$/, ""),
  };
}
