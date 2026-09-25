import { describe, it, expect } from "vitest";

process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://qa:qa@127.0.0.1:5432/qa";

import { pokAmountsMatch, POK_ORDER_ID_RE, getPokEnv, extractPokOrderIdFromWebhook } from "./pokClient.js";

describe("pokClient", () => {
  it("validates UUID order ids", () => {
    expect(POK_ORDER_ID_RE.test("8ee5193a-7592-464d-91ba-dc2206edd133")).toBe(true);
    expect(POK_ORDER_ID_RE.test("not-an-id")).toBe(false);
    expect(POK_ORDER_ID_RE.test("")).toBe(false);
  });

  it("matches amounts in major units or cents", () => {
    expect(pokAmountsMatch(15.99, "EUR", { id: "x", amount: 15.99, currencyCode: "EUR" })).toBe(true);
    expect(pokAmountsMatch(15.99, "EUR", { id: "x", amount: 1599, currencyCode: "EUR" })).toBe(true);
    expect(pokAmountsMatch(15.99, "EUR", { id: "x", amount: 10, currencyCode: "EUR" })).toBe(false);
    expect(pokAmountsMatch(15.99, "EUR", { id: "x", amount: 15.99, currencyCode: "USD" })).toBe(false);
  });

  it("reads POK_ENV", () => {
    const prev = process.env.POK_ENV;
    process.env.POK_ENV = "staging";
    expect(getPokEnv()).toBe("staging");
    process.env.POK_ENV = "production";
    expect(getPokEnv()).toBe("production");
    process.env.POK_ENV = prev;
  });

  it("prefers settings pokEnv over process.env", () => {
    const prev = process.env.POK_ENV;
    process.env.POK_ENV = "production";
    expect(getPokEnv({ pokEnv: "staging" })).toBe("staging");
    process.env.POK_ENV = prev;
  });

  it("extracts sdk order id from webhook payloads", () => {
    const id = "8ee5193a-7592-464d-91ba-dc2206edd133";
    expect(extractPokOrderIdFromWebhook({ data: { sdkOrder: { id } } })).toBe(id);
    expect(extractPokOrderIdFromWebhook({ orderId: id })).toBe(id);
    expect(extractPokOrderIdFromWebhook({ orderId: "bad" })).toBeNull();
  });
});
