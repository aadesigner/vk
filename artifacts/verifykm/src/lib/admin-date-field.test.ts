import { describe, expect, it } from "vitest";
import {
  adminDateFromDisplay,
  adminDateToDisplay,
} from "../components/admin/admin-vin-form-fields";

describe("admin date DMY UI helpers", () => {
  it("shows ISO storage as day-month-year with dashes", () => {
    expect(adminDateToDisplay("2024-03-14")).toBe("14-03-2024");
    expect(adminDateToDisplay("2022-03-05")).toBe("05-03-2022");
    expect(adminDateToDisplay("")).toBe("");
    expect(adminDateToDisplay("March 2024")).toBe("March 2024");
  });

  it("stores complete day-month-year with dashes or slashes as ISO", () => {
    expect(adminDateFromDisplay("14-03-2024")).toBe("2024-03-14");
    expect(adminDateFromDisplay("05-03-2022")).toBe("2022-03-05");
    expect(adminDateFromDisplay("05/03/2022")).toBe("2022-03-05");
    expect(adminDateFromDisplay("14/03/2024")).toBe("2024-03-14");
    expect(adminDateFromDisplay("1/3/2024")).toBe("2024-03-01");
    expect(adminDateFromDisplay("1-3-2024")).toBe("2024-03-01");
    expect(adminDateFromDisplay("14.03.2024")).toBe("2024-03-14");
    expect(adminDateFromDisplay("2024-03-14")).toBe("2024-03-14");
  });

  it("normalizes complete slash DMY to dash display", () => {
    expect(adminDateToDisplay("05/03/2022")).toBe("05-03-2022");
  });

  it("leaves incomplete typing as-is", () => {
    expect(adminDateFromDisplay("14-03")).toBe("14-03");
    expect(adminDateFromDisplay("14/03")).toBe("14/03");
    expect(adminDateFromDisplay("14-03-20")).toBe("14-03-20");
  });
});
