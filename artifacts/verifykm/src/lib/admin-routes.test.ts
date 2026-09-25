import { describe, expect, it } from "vitest";
import { isAdminAppPath, matchAdminRoute } from "./admin-routes";

describe("admin-routes", () => {
  it("detects admin paths including wouter absolute prefix", () => {
    expect(isAdminAppPath("/adminx")).toBe(true);
    expect(isAdminAppPath("~/adminx")).toBe(true);
    expect(isAdminAppPath("/adminx/users")).toBe(true);
    expect(isAdminAppPath("/en/dashboard")).toBe(false);
  });

  it("maps bare /adminx to overview, not not-found", () => {
    expect(matchAdminRoute("/adminx").id).toBe("overview");
    expect(matchAdminRoute("/adminx/").id).toBe("overview");
    expect(matchAdminRoute("~/adminx").id).toBe("overview");
  });

  it("maps known subpaths to their routes", () => {
    expect(matchAdminRoute("/adminx/users").id).toBe("users");
    expect(matchAdminRoute("/adminx/users/abc")).toEqual({ id: "user-detail", userId: "abc" });
    expect(matchAdminRoute("/adminx/pending-vin-checks").id).toBe("pending-vin-checks");
    expect(matchAdminRoute("/adminx/pending-vin-checks/42")).toEqual({
      id: "pending-vin-detail",
      checkId: "42",
    });
  });

  it("uses not-found only for unknown subpaths", () => {
    expect(matchAdminRoute("/adminx/unknown-page").id).toBe("not-found");
  });
});
