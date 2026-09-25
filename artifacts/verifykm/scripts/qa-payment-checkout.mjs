/**
 * QA: VIN checkout, payment capture, and payment retrial invariants.
 *
 * Static checks + unit tests (+ optional live API probes).
 * Does not charge real payments or call provider local-report.
 *
 * Usage:
 *   node artifacts/verifykm/scripts/qa-payment-checkout.mjs
 *   API_BASE=http://127.0.0.1:5000 node artifacts/verifykm/scripts/qa-payment-checkout.mjs
 *   SKIP_TESTS=1 node artifacts/verifykm/scripts/qa-payment-checkout.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const apiRoot = join(root, "..", "api-server");
let errors = 0;

function fail(msg) {
  console.error("FAIL:", msg);
  errors++;
}

function warn(msg) {
  console.warn("WARN:", msg);
}

function read(rel) {
  const path = join(root, rel);
  if (!existsSync(path)) {
    fail(`missing file ${rel}`);
    return "";
  }
  return readFileSync(path, "utf8");
}

function readApi(rel) {
  const path = join(apiRoot, rel);
  if (!existsSync(path)) {
    fail(`missing api file ${rel}`);
    return "";
  }
  return readFileSync(path, "utf8");
}

function mustInclude(src, needle, label) {
  if (!src.includes(needle)) fail(`${label}: expected "${needle}"`);
}

function mustNotInclude(src, needle, label) {
  if (src.includes(needle)) fail(`${label}: must not contain "${needle}"`);
}

function mustMatch(src, re, label) {
  if (!re.test(src)) fail(`${label}: pattern ${re} not found`);
}

// ── API: pre-payment gate uses local-exists only ─────────────────────────────
const vinService = readApi("src/lib/vinService.ts");
const payments = readApi("src/routes/payments.ts");
const vinRoutes = readApi("src/routes/vin.ts");

mustInclude(vinService, "checkLocalExists", "vinService");
mustInclude(vinService, "ensureVinPayableForPayment", "vinService");
mustMatch(vinService, /ensureVinPayableForPayment[\s\S]*checkLocalExists/, "ensureVinPayableForPayment uses checkLocalExists");
mustNotInclude(payments, "fetchFromProvider", "payments.ts must not call fetchFromProvider (local-report)");
mustNotInclude(payments, "local-report", "payments.ts must not call local-report pre-payment");

for (const route of [
  "create-paypal-order",
  "redeem-credit",
  "create-pok-order",
]) {
  mustInclude(payments, route, `payments.ts defines ${route}`);
}
const ensurePayableUses = (payments.match(/ensureVinPayableForPayment/g) ?? []).length;
if (ensurePayableUses < 3) {
  fail(`payments.ts should call ensureVinPayableForPayment on create/redeem paths (found ${ensurePayableUses})`);
}

// peek uses local-exists, not local-report
mustMatch(vinRoutes, /\/vin\/peek[\s\S]*checkLocalExists/, "vin peek uses checkLocalExists");
mustNotInclude(vinRoutes, "fetchFromProvider", "vin peek must not fetch local-report");

// ── API: auth + rate limits on payment endpoints ─────────────────────────────
const protectedPaymentRoutes = [
  ["/payments/validate-coupon", "requireAuth"],
  ["/payments/create-paypal-order", "requireAuth"],
  ["/payments/capture-paypal-order", "requireAuth"],
  ["/payments/redeem-credit", "requireAuth"],
  ["/payments/create-pok-order", "requireAuth"],
  ["/payments/confirm-pok-order", "requireAuth"],
  ["/payments/history", "requireAuth"],
];

for (const [route, guard] of protectedPaymentRoutes) {
  mustMatch(
    payments,
    new RegExp(`${route.replace(/\//g, "\\/")}[\\s\\S]{0,120}${guard}`),
    `${route} requires ${guard}`,
  );
}

mustMatch(payments, /create-paypal-order[\s\S]{0,80}paypalOrderCreateLimiter/, "PayPal create rate limit");
mustMatch(payments, /capture-paypal-order[\s\S]{0,80}paypalCaptureLimiter/, "PayPal capture rate limit");
mustMatch(payments, /create-pok-order[\s\S]{0,80}pokOrderCreateLimiter/, "POK create rate limit");
mustMatch(payments, /confirm-pok-order[\s\S]{0,80}pokConfirmLimiter/, "POK confirm rate limit");

// ── API: capture / confirm idempotency + retrial ─────────────────────────────
mustMatch(
  payments,
  /capture-paypal-order[\s\S]*payment\.status === "completed"[\s\S]*success: true/,
  "PayPal capture is idempotent when payment already completed",
);
mustInclude(payments, "confirmPokPaymentByOrderId", "POK confirm uses shared confirm service");
mustInclude(payments, "/payments/webhook/pok", "POK webhook route registered");
mustInclude(payments, "resolvePokWebhookUrl", "POK orders register webhookUrl");
mustNotInclude(payments, 'pok_confirm_not_completed[\s\S]*status: "failed"', "POK not-completed must not mark failed in payments.ts");

const pokClient = readApi("src/lib/pokClient.ts");
mustInclude(pokClient, "waitForPokOrderCompleted", "POK server polls before giving up");
mustInclude(pokClient, "resolvePokWebhookUrl", "POK webhook URL helper");

const pokConfirmLib = readApi("src/lib/pokPaymentConfirm.ts");
mustMatch(
  pokConfirmLib,
  /PAYMENT_NOT_COMPLETED[\s\S]*retryable: true/,
  "POK not completed returns retryable without failing payment",
);

mustInclude(payments, "payment_captured_recovered", "PayPal capture recovery after network error");
mustInclude(payments, "interpretPaypalCaptureResponse", "PayPal already-captured retrial handling");
mustMatch(
  payments,
  /PAYMENT_NOT_COMPLETED[\s\S]*Please try again/,
  "failed capture returns PAYMENT_NOT_COMPLETED for client retrial",
);

// POK pending order reuse (avoid duplicate charges on refresh)
mustInclude(payments, 'msg: "payment_reused"', "POK/PayPal order reuse logging");
mustMatch(
  payments,
  /create-pok-order[\s\S]*existingPending[\s\S]*reused: true/,
  "create-pok-order reuses pending POK order",
);

// ── Client: checkout VIN handoff + PayPal resume ─────────────────────────────
const checkoutFlow = read("src/lib/checkout-vin-flow.ts");
const checkoutPage = read("src/pages/checkout.tsx");

mustInclude(checkoutFlow, "PAYPAL_CHECKOUT_SESSION_KEY", "checkout-vin-flow session key");
mustInclude(checkoutFlow, 'phase?: PaypalCheckoutSessionPhase', "PayPal session phase");
mustInclude(checkoutFlow, "shouldResumePaypalCapture", "capture resume helper");
mustInclude(checkoutFlow, "markPaypalCheckoutCapturePending", "mark capture pending");
mustInclude(checkoutFlow, "clearCheckoutPaymentResumeState", "clear resume state");
mustMatch(
  checkoutFlow,
  /preparePostAuthCheckoutLanding[\s\S]*clearCheckoutPaymentResumeState/,
  "post-auth checkout clears stale PayPal session",
);
mustMatch(
  checkoutFlow,
  /preparePostAuthCheckoutLanding[\s\S]*markCheckoutPrefillOnly/,
  "post-auth checkout marks prefill-only (no auto-pay)",
);

mustInclude(checkoutPage, "finalizePaidCheckout", "checkout finalizePaidCheckout");
mustInclude(checkoutPage, "/api/payments/capture-paypal-order", "checkout PayPal capture endpoint");
const pokCheckoutConfirm = read("src/lib/pok-checkout-confirm.ts");
mustInclude(pokCheckoutConfirm, "confirmPokOrderWithRetry", "client POK confirm retry");
mustInclude(pokCheckoutConfirm, "POK_CHECKOUT_SESSION_KEY", "POK session storage key");

mustInclude(checkoutPage, "confirmPokOrderWithRetry", "checkout uses POK confirm retry");
mustInclude(checkoutPage, "readPokCheckoutSession", "checkout resumes POK session");
mustInclude(checkoutPage, "/api/payments/confirm-pok-order", "checkout POK confirm endpoint");
mustMatch(
  checkoutPage,
  /PAYMENT_NOT_COMPLETED[\s\S]*markPaypalCheckoutAwaitingApproval[\s\S]*mountPaypalButtons/,
  "capture failure re-shows PayPal buttons for retrial",
);
mustMatch(
  checkoutPage,
  /shouldResumePaypalCapture[\s\S]*finalizePaidCheckout/,
  "refresh resumes capture when session phase is capture",
);
mustMatch(
  checkoutPage,
  /params\.get\("token"\)[\s\S]*markPaypalCheckoutCapturePending[\s\S]*finalizePaidCheckout/,
  "PayPal redirect return retries capture",
);
mustMatch(
  checkoutPage,
  /submitVinLookup[\s\S]*capture-paypal-order[\s\S]*submitVinLookup/,
  "VIN delivery retrial re-captures PayPal if lookup fails after payment",
);
mustMatch(
  checkoutPage,
  /consumeCheckoutPrefillOnly|CHECKOUT_PREFILL_ONLY_KEY/,
  "checkout respects post-auth prefill-only landing",
);

// Card path must not resume stale PayPal
mustMatch(
  checkoutPage,
  /payMethod === "card"[\s\S]*paypalResumeAttemptedRef|pokOrderId[\s\S]*return/,
  "card/POK checkout skips PayPal resume",
);

// ── Unit tests (payment + checkout resume) ───────────────────────────────────
function runPaymentUnitTests() {
  if (process.env.SKIP_TESTS === "1") {
    console.log("Skip unit tests (SKIP_TESTS=1)");
    return;
  }
  console.log("Running payment unit tests…");
  const testEnv = {
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://qa:qa@127.0.0.1:5432/qa",
  };

  const jsdomRun = spawnSync(
    "pnpm",
    ["exec", "vitest", "run", "checkout-vin-flow", "pok-checkout-confirm", "--environment", "jsdom"],
    { cwd: apiRoot, stdio: "inherit", shell: true, env: testEnv },
  );
  if (jsdomRun.status !== 0) {
    fail("checkout-vin-flow unit tests failed");
    return;
  }

  const apiRun = spawnSync(
    "pnpm",
    ["exec", "vitest", "run", "paypalCapture", "pokClient", "lookup-eligibility", "vinReportPaymentLabel", "recordedPayments"],
    { cwd: apiRoot, stdio: "inherit", shell: true, env: testEnv },
  );
  if (apiRun.status !== 0) {
    fail("payment API unit tests failed");
  }
}

try {
  runPaymentUnitTests();
} catch (err) {
  fail(`unit test runner error: ${err instanceof Error ? err.message : String(err)}`);
}

// ── Optional live API probes (no auth — smoke only) ─────────────────────────
const apiBase = (process.env.API_BASE ?? "").replace(/\/$/, "");

async function expectStatus(url, opts, expected, label) {
  const res = await fetch(url, opts);
  if (res.status !== expected) {
    fail(`${label}: expected HTTP ${expected}, got ${res.status}`);
  }
}

async function liveProbe() {
  console.log(`Live probes → ${apiBase}`);

  const healthRes = await fetch(`${apiBase}/api/healthz`);
  if (!healthRes.ok) fail(`/api/healthz returned ${healthRes.status}`);

  const settingsRes = await fetch(`${apiBase}/api/payments/public-settings`);
  if (!settingsRes.ok) fail(`/api/payments/public-settings returned ${settingsRes.status}`);
  const settings = await settingsRes.json();
  if (typeof settings !== "object" || settings === null) {
    fail("public-settings response is not JSON object");
  }

  const pricingRes = await fetch(`${apiBase}/api/payments/current-pricing`);
  if (!pricingRes.ok) fail(`/api/payments/current-pricing returned ${pricingRes.status}`);
  const pricing = await pricingRes.json();
  if (typeof pricing.basePrice !== "number") {
    fail("current-pricing missing basePrice");
  }

  const postJson = { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" };

  await expectStatus(`${apiBase}/api/payments/create-paypal-order`, postJson, 401, "create-paypal-order unauthenticated");
  await expectStatus(`${apiBase}/api/payments/capture-paypal-order`, postJson, 401, "capture-paypal-order unauthenticated");
  await expectStatus(`${apiBase}/api/payments/confirm-pok-order`, postJson, 401, "confirm-pok-order unauthenticated");
  await expectStatus(`${apiBase}/api/payments/validate-coupon`, postJson, 401, "validate-coupon unauthenticated");
  await expectStatus(`${apiBase}/api/payments/redeem-credit`, postJson, 401, "redeem-credit unauthenticated");
  await expectStatus(`${apiBase}/api/payments/create-pok-order`, postJson, 401, "create-pok-order unauthenticated");

  const peekVin = "1HGBH41JXMN109186";
  const peekRes = await fetch(`${apiBase}/api/vin/peek/${peekVin}`);
  if (peekRes.status !== 401) {
    fail(`/api/vin/peek/:vin without auth should 401, got ${peekRes.status}`);
  }

  // Invalid order id shape should 400 when authed — we only verify route exists via 401 above.
  console.log("Live smoke: payment routes reachable, auth enforced on mutations");
}

if (apiBase) {
  try {
    await liveProbe();
  } catch (err) {
    fail(`live probe error: ${err instanceof Error ? err.message : String(err)}`);
  }
} else {
  console.log("Skip live probes (set API_BASE to enable, e.g. API_BASE=http://127.0.0.1:5000)");
}

// ── Manual QA checklist (human / staging) ─────────────────────────────────────
console.log(`
Manual staging checklist (not automated):
  [ ] Guest VIN → sign-up → checkout prefill (?vin=), PayPal buttons appear (no auto-charge)
  [ ] PayPal approve → report delivers; refresh mid-capture completes via session retrial
  [ ] PayPal approve → close tab → reopen checkout → capture resumes (phase=capture)
  [ ] PayPal mobile redirect (?token=ORDER) → capture + delivery
  [ ] Card (POK): create order → pay → confirm-pok-order → report delivers
  [ ] Card refresh with pending pokOrderId reuses order (no duplicate POK charge)
  [ ] Free coupon: $0 checkout completes without PayPal mount
  [ ] Credit redeem: sufficient balance unlocks VIN without PayPal
  [ ] Already-unlocked VIN → 409 ALREADY_UNLOCKED, no new payment row
  [ ] VIN with no data → 422 VIN_NO_DATA before payment
`);

if (errors === 0) {
  console.log("OK — payment/checkout QA passed");
} else {
  console.error(`FAILED — ${errors} issue(s)`);
  process.exit(1);
}
