import { unlinkSync } from "fs";

for (const lock of ["package-lock.json", "yarn.lock"]) {
  try {
    unlinkSync(lock);
  } catch {
    // missing is fine
  }
}

const ua = process.env.npm_config_user_agent ?? "";
if (!ua.includes("pnpm/")) {
  console.error("Use pnpm instead");
  process.exit(1);
}
