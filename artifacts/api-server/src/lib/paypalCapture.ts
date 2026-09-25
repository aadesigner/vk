export const PAYPAL_ORDER_ID_RE = /^[A-Z0-9]{8,20}$/;

export function isPaypalOrderAlreadyCaptured(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const record = body as Record<string, unknown>;
  if (record.name === "RESOURCE_ALREADY_EXISTS") return true;
  if (record.name === "UNPROCESSABLE_ENTITY" && Array.isArray(record.details)) {
    return (record.details as Array<{ issue?: string }>).some(
      (d) => d.issue === "ORDER_ALREADY_CAPTURED",
    );
  }
  return false;
}

export function readPaypalOrderStatus(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const status = (body as { status?: unknown }).status;
  return typeof status === "string" ? status : null;
}

export async function fetchPaypalOrderStatus(
  base: string,
  accessToken: string,
  orderId: string,
): Promise<string | null> {
  const resp = await fetch(`${base}/v2/checkout/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15000),
  });
  const body = await resp.json().catch(() => null);
  return readPaypalOrderStatus(body);
}

export type PaypalCaptureAttempt = {
  httpOk: boolean;
  body: unknown;
  orderStatus: string | null;
  treatedAsCompleted: boolean;
  capturedAmount?: number | null;
  capturedCurrency?: string | null;
};

export function readPaypalCapturedAmount(body: unknown): { amount: number; currency: string } | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const units = record.purchase_units;
  if (!Array.isArray(units) || !units[0] || typeof units[0] !== "object") return null;
  const payments = (units[0] as Record<string, unknown>).payments;
  if (!payments || typeof payments !== "object") return null;
  const captures = (payments as Record<string, unknown>).captures;
  if (!Array.isArray(captures) || !captures[0] || typeof captures[0] !== "object") return null;
  const amount = (captures[0] as Record<string, unknown>).amount;
  if (!amount || typeof amount !== "object") return null;
  const value = (amount as Record<string, unknown>).value;
  const currency = (amount as Record<string, unknown>).currency_code;
  const parsed = typeof value === "string" ? Number(value) : Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (typeof currency !== "string" || !currency.trim()) return null;
  return { amount: parsed, currency: currency.trim().toUpperCase() };
}

export function paypalAmountsMatch(expected: number, currency: string, captured: { amount: number; currency: string }): boolean {
  if (captured.currency.toUpperCase() !== currency.toUpperCase()) return false;
  return Math.abs(expected - captured.amount) < 0.02;
}

export async function fetchPaypalOrderCaptureAmount(
  base: string,
  accessToken: string,
  orderId: string,
): Promise<{ amount: number; currency: string } | null> {
  const resp = await fetch(`${base}/v2/checkout/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15000),
  });
  const body = await resp.json().catch(() => null);
  return readPaypalCapturedAmount(body);
}

/** Normalize PayPal capture response — handles already-captured orders. */
export async function interpretPaypalCaptureResponse(
  captureResp: Response,
  fetchOrderStatus: () => Promise<string | null>,
): Promise<PaypalCaptureAttempt> {
  const body = await captureResp.json().catch(() => ({}));
  let orderStatus = readPaypalOrderStatus(body);

  if (captureResp.ok && orderStatus === "COMPLETED") {
    const captured = readPaypalCapturedAmount(body);
    return {
      httpOk: true,
      body,
      orderStatus,
      treatedAsCompleted: true,
      capturedAmount: captured?.amount ?? null,
      capturedCurrency: captured?.currency ?? null,
    };
  }

  if (!captureResp.ok && isPaypalOrderAlreadyCaptured(body)) {
    orderStatus = await fetchOrderStatus();
    if (orderStatus === "COMPLETED") {
      const captured = readPaypalCapturedAmount(body);
      return {
        httpOk: true,
        body,
        orderStatus,
        treatedAsCompleted: true,
        capturedAmount: captured?.amount ?? null,
        capturedCurrency: captured?.currency ?? null,
      };
    }
  }

  if (!orderStatus) {
    orderStatus = await fetchOrderStatus();
    if (orderStatus === "COMPLETED") {
      const captured = readPaypalCapturedAmount(body);
      return {
        httpOk: true,
        body,
        orderStatus,
        treatedAsCompleted: true,
        capturedAmount: captured?.amount ?? null,
        capturedCurrency: captured?.currency ?? null,
      };
    }
  }

  const captured = readPaypalCapturedAmount(body);
  return {
    httpOk: captureResp.ok,
    body,
    orderStatus,
    treatedAsCompleted: orderStatus === "COMPLETED",
    capturedAmount: captured?.amount ?? null,
    capturedCurrency: captured?.currency ?? null,
  };
}
