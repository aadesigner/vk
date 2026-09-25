import type { Response } from "express";

export const ADMIN_CONFIRM_PHRASES = {
  DELETE_ALL_CATALOG: "DELETE ALL CATALOG",
  CLEAR_ALL_LOCKOUTS: "CLEAR ALL LOCKOUTS",
  RESTORE_BACKUP: "RESTORE BACKUP",
} as const;

export type AdminConfirmPhrase = typeof ADMIN_CONFIRM_PHRASES[keyof typeof ADMIN_CONFIRM_PHRASES];

export function requireConfirmPhrase(
  body: { confirmPhrase?: string },
  expected: AdminConfirmPhrase,
  res: Response,
): boolean {
  if (body.confirmPhrase?.trim() !== expected) {
    res.status(400).json({ error: `confirmPhrase must be exactly: ${expected}` });
    return false;
  }
  return true;
}
