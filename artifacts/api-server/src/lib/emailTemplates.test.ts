import { describe, expect, it } from "vitest";
import {
  EMAIL_TEMPLATE_DEFAULTS,
  EMAIL_TEMPLATE_VARIABLES,
  buildVehicleLabel,
  formatEmailAmount,
  getSampleTemplateVars,
  interpolateEmailVars,
  renderEmailTemplate,
  varsFromReportReady,
} from "./emailTemplates";

describe("interpolateEmailVars", () => {
  it("replaces placeholders", () => {
    expect(interpolateEmailVars("Hi {{name}}, VIN {{vin}}", { name: "Alex", vin: "ABC" }))
      .toBe("Hi Alex, VIN ABC");
  });

  it("leaves unknown placeholders empty", () => {
    expect(interpolateEmailVars("{{missing}}", {})).toBe("");
  });
});

describe("renderEmailTemplate", () => {
  it("uses custom subject and content", () => {
    const { subject, html } = renderEmailTemplate(
      "welcome",
      getSampleTemplateVars("welcome", "https://verifykm.com"),
      { subject: "Hello {{name}}!", contentHtml: "<p>Custom for {{name}}</p>" },
      "https://verifykm.com",
    );
    expect(subject).toBe("Hello Alex!");
    expect(html).toContain("Custom for Alex");
    expect(html).toContain("<!DOCTYPE html>");
  });

  it("falls back to defaults when no override", () => {
    const { subject } = renderEmailTemplate(
      "welcome",
      getSampleTemplateVars("welcome", "https://verifykm.com"),
      undefined,
      "https://verifykm.com",
    );
    expect(subject).toBe(EMAIL_TEMPLATE_DEFAULTS.welcome.subject);
  });
});

describe("buildVehicleLabel", () => {
  it("uses year, make and model when all are known", () => {
    expect(buildVehicleLabel(2019, "BMW", "3 Series")).toBe("2019 BMW 3 Series");
  });

  it("falls back to whichever parts exist", () => {
    expect(buildVehicleLabel(2019, "BMW", null)).toBe("2019 BMW");
    expect(buildVehicleLabel(null, "BMW", "3 Series")).toBe("BMW 3 Series");
    expect(buildVehicleLabel(null, "BMW", null)).toBe("BMW");
  });

  it("never renders an empty title", () => {
    expect(buildVehicleLabel(null, null, null)).toBe("your vehicle");
  });
});

describe("formatEmailAmount", () => {
  it("formats euro and dollar amounts", () => {
    expect(formatEmailAmount(19.99, "EUR")).toBe("€19.99");
    expect(formatEmailAmount(15.9, "USD")).toBe("$15.90");
  });

  it("shows Free when there is nothing to charge", () => {
    expect(formatEmailAmount(0, "EUR")).toBe("Free");
    expect(formatEmailAmount(null, "EUR")).toBe("Free");
    expect(formatEmailAmount(undefined, undefined)).toBe("Free");
  });
});

describe("varsFromReportReady", () => {
  const base = {
    name: "Alex",
    vin: "WBA3A5G59DNP26082",
    reportUrl: "https://verifykm.com/vin/WBA3A5G59DNP26082",
    siteUrl: "https://verifykm.com",
  };

  it("appends the unit to a known mileage and dashes an unknown one", () => {
    expect(varsFromReportReady({ ...base, mileage: 48200 }).mileageText).toBe("48,200 km");
    expect(varsFromReportReady({ ...base, mileage: null }).mileageText).toBe("—");
  });

  it("dashes missing key findings instead of inventing zeros", () => {
    const vars = varsFromReportReady(base);
    expect(vars.accidents).toBe("—");
    expect(vars.owners).toBe("—");
  });

  it("counts accidents from a list when no explicit count exists", () => {
    expect(varsFromReportReady({ ...base, accidents: 2 }).accidents).toBe("2");
    expect(varsFromReportReady({ ...base, owners: 0 }).owners).toBe("0");
  });

  it("carries payment details into the receipt line", () => {
    const vars = varsFromReportReady({ ...base, amount: 19.99, currency: "EUR", paymentRef: "5XG29384BK" });
    expect(vars.amount).toBe("€19.99");
    expect(vars.paymentRef).toBe("5XG29384BK");
  });
});

describe("combined report-ready template", () => {
  const siteUrl = "https://verifykm.com";

  it("renders the vehicle title, VIN, all key findings, CTA and amount paid", () => {
    const { html, subject } = renderEmailTemplate(
      "vinready",
      getSampleTemplateVars("vinready", siteUrl),
      undefined,
      siteUrl,
    );

    expect(subject).toContain("WBA3A5G59DNP26082");
    expect(html).toContain("2019 BMW 3 Series");
    expect(html).toContain("WBA3A5G59DNP26082");
    expect(html).toContain("Recorded mileage");
    expect(html).toContain("48,200 km");
    expect(html).toContain("Reported accidents");
    expect(html).toContain("Previous owners");
    expect(html).toContain("View Full Report");
    expect(html).toContain("Amount paid");
    expect(html).toContain("€19.99");
  });

  it("leaves no unresolved placeholders", () => {
    const { html } = renderEmailTemplate(
      "vinready",
      getSampleTemplateVars("vinready", siteUrl),
      undefined,
      siteUrl,
    );
    expect(html).not.toMatch(/\{\{\w+\}\}/);
  });

  it("exposes every template variable it renders", () => {
    const declared = new Set(EMAIL_TEMPLATE_VARIABLES.vinready);
    const used = [...EMAIL_TEMPLATE_DEFAULTS.vinready.contentHtml.matchAll(/\{\{(\w+)\}\}/g)]
      .map((m) => m[1]);
    for (const name of used) {
      expect(declared.has(name)).toBe(true);
    }
  });

  it("no longer offers a separate payment-confirmation template", () => {
    expect(Object.keys(EMAIL_TEMPLATE_DEFAULTS)).not.toContain("confirm");
  });
});
