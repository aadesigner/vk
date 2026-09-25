/**
 * E2E: manual-pending VIN flow (decode passes, not in catalog/local-exists).
 * Run: npx tsx scripts/e2e-manual-pending-flow.ts
 */
import "../load-env.mjs";
import { db, couponsTable, pendingVinChecksTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { decodeFreeVin } from "../src/lib/vinDecodeFree.js";
import { validateCheckDigit } from "@workspace/vin-decode";
import { isVinEligibleForManualPending } from "../src/lib/pendingVinService.js";
import { checkLocalExists, getCatalogVin } from "../src/lib/vinService.js";
import { providersTable } from "@workspace/db";

const API = process.env.API_BASE ?? "http://localhost:8080";
const CANDIDATES = [
  "WBA3V7106FJ995387",
  "5YJSA1E14HF000001",
  "WVWZZZ3CZCE064077",
  "WBA3A5C55FK123456",
  "WAUZZZF4XGN123456",
  "KMHSW81UBGU554169",
  "JTDKB20U797867720",
  "1N6ED1EJXNN664377",
  "YV1MC67278J058366",
  "1HGCM82633A004352",
];

const TEST_EMAIL = `e2e-manual-${Date.now()}@verifykm-test.local`;
const TEST_PASSWORD = "TestFlow123!";
const COUPON_CODE = "E2E100";

function cookieJar() {
  let cookie = "";
  return {
    store(res: Response) {
      const set = res.headers.getSetCookie?.() ?? [];
      for (const c of set) {
        const part = c.split(";")[0];
        const name = part.split("=")[0];
        if (cookie.includes(`${name}=`)) {
          cookie = cookie
            .split("; ")
            .filter((x) => !x.startsWith(`${name}=`))
            .concat(part)
            .join("; ");
        } else {
          cookie = cookie ? `${cookie}; ${part}` : part;
        }
      }
    },
    headers(): HeadersInit {
      return cookie ? { Cookie: cookie } : {};
    },
  };
}

async function api(path: string, init: RequestInit, jar: ReturnType<typeof cookieJar>) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...jar.headers(), ...(init.headers ?? {}) },
  });
  jar.store(res);
  const text = await res.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { res, body };
}

async function findTestVin(): Promise<string> {
  const [provider] = await db.select().from(providersTable)
    .where(eq(providersTable.isActive, true))
    .limit(1);

  console.log("\n=== Scanning candidate VINs ===");
  for (const vin of CANDIDATES) {
    const catalog = await getCatalogVin(vin);
    const free = await decodeFreeVin(vin, validateCheckDigit(vin));
    const eligible = await isVinEligibleForManualPending(vin);
    let exists = "no_provider";
    if (provider?.apiKey?.trim()) {
      const r = await checkLocalExists(vin, provider.baseUrl, provider.apiKey);
      exists = r.status;
    }
    const match = !catalog?.data && exists === "not_found" && eligible;
    console.log(
      `${match ? "✓" : "·"} ${vin} | catalog=${!!catalog?.data} exists=${exists} eligible=${eligible} | ${free.year} ${free.make} ${free.model}`,
    );
    if (match) return vin;
  }
  throw new Error("No candidate VIN matched manual-pending criteria");
}

async function ensureCoupon() {
  const [existing] = await db.select().from(couponsTable).where(eq(couponsTable.code, COUPON_CODE)).limit(1);
  if (existing) {
    await db.update(couponsTable).set({ isActive: true, type: "percent", value: 100, maxUses: null, uses: 0 }).where(eq(couponsTable.id, existing.id));
    return;
  }
  await db.insert(couponsTable).values({
    code: COUPON_CODE,
    type: "percent",
    value: 100,
    isActive: true,
    maxUses: null,
    uses: 0,
  });
}

async function main() {
  const vin = await findTestVin();
  console.log(`\n=== Using test VIN: ${vin} ===\n`);
  await ensureCoupon();

  const jar = cookieJar();

  const reg = await api("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD, name: "E2E Manual Pending" }),
  }, jar);
  if (!reg.res.ok) throw new Error(`Register failed: ${reg.res.status} ${JSON.stringify(reg.body)}`);
  const userId = (reg.body as { user?: { id: string } }).user?.id;
  console.log("Registered user:", TEST_EMAIL, userId);

  const peek = await api(`/api/vin/peek/${vin}`, { method: "GET" }, jar);
  if (!peek.res.ok) throw new Error(`Peek failed: ${peek.res.status}`);
  const peekBody = peek.body as Record<string, unknown>;
  console.log("Peek:", {
    dataAvailable: peekBody.dataAvailable,
    manualPending: peekBody.manualPending,
    make: peekBody.make,
    model: peekBody.model,
  });
  if (!peekBody.dataAvailable || !peekBody.manualPending) {
    throw new Error("Peek did not return manual-pending eligible state");
  }

  const order = await api("/api/payments/create-paypal-order", {
    method: "POST",
    body: JSON.stringify({ vin, couponCode: COUPON_CODE }),
  }, jar);
  if (!order.res.ok) throw new Error(`Create order failed: ${order.res.status} ${JSON.stringify(order.body)}`);
  const orderBody = order.body as { free?: boolean; paymentId?: number };
  if (!orderBody.free || !orderBody.paymentId) throw new Error("Expected free coupon payment");
  console.log("Free payment created:", orderBody.paymentId);

  const lookup = await api("/api/vin/lookup", {
    method: "POST",
    body: JSON.stringify({ vin, paymentId: orderBody.paymentId }),
  }, jar);
  if (!lookup.res.ok) throw new Error(`Lookup failed: ${lookup.res.status} ${JSON.stringify(lookup.body)}`);
  const lookupBody = lookup.body as { id?: number; status?: string; vin?: string; isPendingManual?: boolean; data?: Record<string, unknown> };
  console.log("Lookup:", { id: lookupBody.id, status: lookupBody.status, isPendingManual: lookupBody.isPendingManual });

  if (lookupBody.status !== "pending_manual") {
    throw new Error(`Expected pending_manual status, got ${lookupBody.status}`);
  }
  if (!lookupBody.isPendingManual) {
    throw new Error("Expected isPendingManual=true in lookup response");
  }

  const [pendingRow] = await db.select().from(pendingVinChecksTable)
    .where(eq(pendingVinChecksTable.vin, vin))
    .limit(1);
  console.log("DB pending_vin_checks row:", pendingRow ? { id: pendingRow.id, status: pendingRow.status, vin: pendingRow.vin } : "NOT FOUND");
  if (!pendingRow || pendingRow.status !== "open") {
    throw new Error("Expected open pending_vin_checks row in database");
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) throw new Error("ADMIN_EMAIL not set in .env");
  const adminJar = cookieJar();
  const login = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: adminEmail, password: process.env.ADMIN_PASSWORD ?? "admin" }),
  }, adminJar);
  if (!login.res.ok) {
    console.warn("Admin login skipped (set ADMIN_PASSWORD in env for admin check):", login.res.status);
  } else {
    const pending = await api("/api/admin/pending-vin-checks?limit=20", { method: "GET" }, adminJar);
    if (pending.res.ok) {
      const items = (pending.body as { items?: Array<{ vin: string; id: number }> }).items ?? [];
      const row = items.find((i) => i.vin === vin);
      console.log("Admin pending list contains VIN:", !!row, row ? `(id=${row.id})` : "");
      if (!row) throw new Error("VIN not found in admin pending-vin-checks");
    }
  }

  console.log("\n✓ E2E manual-pending flow passed");
  console.log(`Test VIN for homepage: ${vin}`);
  console.log(`Test coupon (100% off): ${COUPON_CODE}`);
  console.log(`Test user: ${TEST_EMAIL} / ${TEST_PASSWORD}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("\n✗ E2E failed:", err);
  process.exit(1);
});
