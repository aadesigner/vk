/** Refuse to start in production without required secrets configured. */
export function assertProductionConfig(): void {
  if (process.env.NODE_ENV !== "production") return;
  if (!process.env.CLIENT_GUARD_TOKEN?.trim()) {
    throw new Error("CLIENT_GUARD_TOKEN is required in production");
  }
  if (!process.env.JWT_SECRET?.trim()) {
    throw new Error("JWT_SECRET is required in production");
  }
  if (!process.env.ADMIN_AREA_PIN?.trim()) {
    throw new Error("ADMIN_AREA_PIN is required in production");
  }
}

export function exitOnProductionConfigFailure(): void {
  try {
    assertProductionConfig();
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
