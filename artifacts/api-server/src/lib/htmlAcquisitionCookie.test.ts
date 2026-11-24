import { describe, expect, it, vi } from "vitest";
import { htmlAcquisitionCookie, isHtmlAcquisitionRequest } from "./htmlAcquisitionCookie.js";
import type { Request, Response } from "express";

function req(partial: Partial<Request> & { headers?: Request["headers"] }): Request {
  return {
    method: "GET",
    path: "/sq",
    originalUrl: "/sq/?fbclid=IgTest",
    protocol: "https",
    secure: true,
    cookies: {},
    headers: {
      host: "kmcheck.com",
      "user-agent": "Mozilla/5.0 Instagram 1.0",
      referer: "https://l.instagram.com/",
      accept: "text/html",
      ...partial.headers,
    },
    ...partial,
  } as Request;
}

function resMock() {
  const cookie = vi.fn();
  return { cookie, mock: { cookie } } as unknown as Response & { mock: { cookie: ReturnType<typeof vi.fn> } };
}

describe("htmlAcquisitionCookie", () => {
  it("does not run on Googlebot", () => {
    expect(isHtmlAcquisitionRequest(req({
      headers: { "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" },
    }))).toBe(false);
  });

  it("does not run on API or assets", () => {
    expect(isHtmlAcquisitionRequest(req({ path: "/api/payments/public-settings" }))).toBe(false);
    expect(isHtmlAcquisitionRequest(req({ path: "/assets/index.js" }))).toBe(false);
    expect(isHtmlAcquisitionRequest(req({ method: "HEAD", path: "/sq" }))).toBe(false);
  });

  it("does not set a cookie on a typed visit with no source", () => {
    const res = resMock();
    htmlAcquisitionCookie(
      req({
        originalUrl: "/en",
        headers: { host: "kmcheck.com", "user-agent": "Mozilla/5.0", accept: "text/html" },
      }),
      res,
      () => {},
    );
    expect(res.mock.cookie).not.toHaveBeenCalled();
  });

  it("sets a cookie for an Instagram landing and leaves the response body alone", () => {
    const res = resMock();
    htmlAcquisitionCookie(req({}), res, () => {});
    expect(res.mock.cookie).toHaveBeenCalledTimes(1);
    const [name, value, opts] = res.mock.cookie.mock.calls[0];
    expect(name).toBe("vk_acq");
    expect(typeof value).toBe("string");
    expect(value.length).toBeLessThan(800);
    expect(opts).toMatchObject({ path: "/", sameSite: "lax", httpOnly: false, secure: true });
  });
});
