import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "../verifykm/src"),
    },
  },
  test: {
    include: [
    "src/**/*.test.ts",
    "../verifykm/src/lib/**/*.test.ts",
    "../verifykm/src/components/admin/**/*.test.ts",
    "../../lib/korean-registry/**/*.test.ts",
    "../../lib/vin-decode/**/*.test.ts",
  ],
    environment: "node",
    reporters: ["verbose"],
  },
});
