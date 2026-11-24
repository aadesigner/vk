export type CreditPackId = "pack3" | "pack5";

export interface CreditPack {
  id: CreditPackId;
  credits: number;
  unitPrice: number;
  totalPrice: number;
  currency: "EUR";
}

function pack(id: CreditPackId, credits: number, unitPrice: number): CreditPack {
  return {
    id,
    credits,
    unitPrice,
    totalPrice: Math.round(unitPrice * credits * 100) / 100,
    currency: "EUR",
  };
}

export const CREDIT_PACKS: Record<CreditPackId, CreditPack> = {
  pack3: pack("pack3", 3, 14.99),
  pack5: pack("pack5", 5, 11.99),
};

export function isCreditPackId(value: unknown): value is CreditPackId {
  return value === "pack3" || value === "pack5";
}

export function getCreditPack(packId: CreditPackId): CreditPack {
  return CREDIT_PACKS[packId];
}

/** What n singles would cost at the current one-report offer (for strikethrough / save %). */
export function packSeparateTotal(pack: CreditPack, singleUnitPrice: number): number {
  return Math.round(singleUnitPrice * pack.credits * 100) / 100;
}

export function packSaveAmount(pack: CreditPack, singleUnitPrice: number): number {
  return Math.max(0, Math.round((packSeparateTotal(pack, singleUnitPrice) - pack.totalPrice) * 100) / 100);
}

const CREDIT_PACK_INTENT_KEY = "vk_credit_pack";

/** Remember the pack the buyer picked, so a language change cannot drop ?pack=. */
export function rememberCreditPack(packId: CreditPackId): void {
  try {
    sessionStorage.setItem(CREDIT_PACK_INTENT_KEY, packId);
  } catch {
    /* private mode */
  }
}

export function readRememberedCreditPack(): CreditPackId | null {
  try {
    const raw = sessionStorage.getItem(CREDIT_PACK_INTENT_KEY);
    return isCreditPackId(raw) ? raw : null;
  } catch {
    return null;
  }
}
