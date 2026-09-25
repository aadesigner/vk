import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

const getSettings = vi.fn();

vi.mock("./settingsCache.js", () => ({
  getSettings: () => getSettings(),
}));

const { maintenanceMiddleware } = await import("./maintenanceMiddleware.js");

function mockReq(overrides: Partial<Request> = {}): Request {
  return { path: "/vin/peek/WBA123", ...overrides } as Request;
}

function mockRes(): Response {
  return { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
}

describe("maintenanceMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSettings.mockResolvedValue({
      maintenanceMode: true,
      maintenanceRestrictions: [],
      maintenanceMessage: "Back soon",
    });
  });

  it("allows admins through during full-site maintenance", async () => {
    const next = vi.fn() as NextFunction;
    await maintenanceMiddleware(mockReq({ isAdmin: true }), mockRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("blocks non-admin requests on restricted paths", async () => {
    const res = mockRes();
    const next = vi.fn() as NextFunction;
    await maintenanceMiddleware(mockReq({ isAdmin: false }), res, next);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(next).not.toHaveBeenCalled();
  });

  it("passes through when maintenance is off", async () => {
    getSettings.mockResolvedValue({
      maintenanceMode: false,
      maintenanceRestrictions: [],
      maintenanceMessage: "",
    });
    const next = vi.fn() as NextFunction;
    await maintenanceMiddleware(mockReq(), mockRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });
});
