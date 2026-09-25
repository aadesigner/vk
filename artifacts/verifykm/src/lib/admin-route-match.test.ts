import { describe, expect, it } from "vitest";
import { matchAdminRoute } from "./admin-routes";

/** Regression: public /:lang must never win over /adminx. */
describe("admin route matching (legacy wouter patterns)", () => {
  it("maps bare /adminx to overview, not catch-all", () => {
    expect(matchAdminRoute("/adminx").id).toBe("overview");
    expect(matchAdminRoute("/adminx/").id).toBe("overview");
  });

  it("maps known subpaths to their routes", () => {
    expect(matchAdminRoute("/adminx/users").id).toBe("users");
    expect(matchAdminRoute("/adminx/pending-vin-checks").id).toBe("pending-vin-checks");
  });

  it("uses not-found only for unknown subpaths", () => {
    expect(matchAdminRoute("/adminx/unknown-page").id).toBe("not-found");
  });
});
