import { describe, it, expect } from "vitest";
import { buildPendingVinAdminEmail } from "./emailService.js";

describe("buildPendingVinAdminEmail", () => {
  it("uses new-pending subject when isNewPending is true", () => {
    const { subject, html, text } = buildPendingVinAdminEmail({
      vin: "1HGCM82633A123456",
      vehicleLabel: "2003 Honda Accord",
      adminUrl: "https://verifykm.com/adminx/pending-vin-checks/1",
      isNewPending: true,
      requestCount: 1,
      customerEmail: "buyer@example.com",
      customerName: "Buyer",
      siteUrl: "https://verifykm.com",
    });

    expect(subject).toContain("new pending VIN check");
    expect(subject).toContain("1HGCM82633A123456");
    expect(html).toContain("Review &amp; Publish");
    expect(html).toContain("buyer@example.com");
    expect(text).toContain("Review: https://verifykm.com/adminx/pending-vin-checks/1");
  });

  it("uses update subject when another customer joins the queue", () => {
    const { subject } = buildPendingVinAdminEmail({
      vin: "1HGCM82633A123456",
      vehicleLabel: "2003 Honda Accord",
      adminUrl: "https://verifykm.com/adminx/pending-vin-checks/1",
      isNewPending: false,
      requestCount: 3,
      customerEmail: "second@example.com",
      siteUrl: "https://verifykm.com",
    });

    expect(subject).toContain("3 customers waiting");
  });
});
