import { describe, expect, it } from "vitest";
import type { Request } from "express";
import {
  isPrivateOrLoopbackIp,
  resolveRequestCountryCode,
} from "./geoCountry.js";

function mockReq(init: {
  headers?: Record<string, string>;
  query?: Record<string, string>;
  remoteAddress?: string;
  nodeEnv?: string;
}): Request {
  const prev = process.env.NODE_ENV;
  if (init.nodeEnv) process.env.NODE_ENV = init.nodeEnv;
  const req = {
    headers: init.headers ?? {},
    query: init.query ?? {},
    socket: { remoteAddress: init.remoteAddress ?? "127.0.0.1" },
  } as Request;
  if (init.nodeEnv) process.env.NODE_ENV = prev;
  return req;
}

describe("isPrivateOrLoopbackIp", () => {
  it("detects loopback and LAN addresses", () => {
    expect(isPrivateOrLoopbackIp("127.0.0.1")).toBe(true);
    expect(isPrivateOrLoopbackIp("::1")).toBe(true);
    expect(isPrivateOrLoopbackIp("192.168.1.4")).toBe(true);
    expect(isPrivateOrLoopbackIp("8.8.8.8")).toBe(false);
  });
});

describe("resolveRequestCountryCode", () => {
  it("reads Cloudflare country header", () => {
    const req = mockReq({ headers: { "cf-ipcountry": "AL" }, nodeEnv: "production" });
    expect(resolveRequestCountryCode(req)).toBe("AL");
  });

  it("ignores invalid Cloudflare placeholders", () => {
    const req = mockReq({ headers: { "cf-ipcountry": "XX" }, nodeEnv: "production" });
    expect(resolveRequestCountryCode(req)).toBeNull();
  });

  it("supports debug query in development", () => {
    const req = mockReq({ query: { debug_country: "al" }, nodeEnv: "development" });
    expect(resolveRequestCountryCode(req)).toBe("AL");
  });

  it("ignores debug query in production", () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const req = mockReq({ query: { debug_country: "AL" } });
      expect(resolveRequestCountryCode(req)).toBeNull();
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it("resolves country from public IP via geoip", () => {
    const prevEnabled = process.env.GEOIP_ENABLED;
    const prevNode = process.env.NODE_ENV;
    process.env.GEOIP_ENABLED = "true";
    process.env.NODE_ENV = "production";
    try {
      const req = mockReq({
        headers: { "x-forwarded-for": "8.8.8.8" },
        remoteAddress: "127.0.0.1",
      });
      expect(resolveRequestCountryCode(req)).toBe("US");
    } finally {
      if (prevEnabled === undefined) delete process.env.GEOIP_ENABLED;
      else process.env.GEOIP_ENABLED = prevEnabled;
      process.env.NODE_ENV = prevNode ?? "test";
    }
  });
});
