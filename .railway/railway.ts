import { defineRailway, github, postgres, preserve, project, service } from "railway/iac";

/**
 * VerifyKM is one web service + Postgres.
 * Workspace folders (vin-decode, api-zod, …) are libraries, not Railway services.
 */
export default defineRailway(() => {
  const db = postgres("postgres");

  const web = service("verifykm", {
    source: github("aadesigner/vk"),
    build: "node scripts/railway-build.mjs",
    start: "node --import ./artifacts/api-server/load-env.mjs ./artifacts/api-server/dist/index.mjs",
    healthcheck: "/api/healthz",
    healthcheckTimeout: 120,
    env: {
      NODE_ENV: "production",
      SITE_URL: "https://verifykm.com",
      CORS_ORIGIN: "https://verifykm.com,https://www.verifykm.com",
      DATABASE_URL: db.env.DATABASE_URL,
      JWT_SECRET: preserve(),
      ADMIN_EMAIL: preserve(),
      CLIENT_GUARD_TOKEN: preserve(),
      VITE_CLIENT_GUARD_TOKEN: preserve(),
      CARSTAT_API_KEY: preserve(),
      PAYPAL_CLIENT_ID: preserve(),
      PAYPAL_CLIENT_SECRET: preserve(),
      POK_MERCHANT_ID: preserve(),
      POK_KEY_ID: preserve(),
      POK_KEY_SECRET: preserve(),
      POK_ENV: preserve(),
      GETCARAPI_API_KEY: preserve(),
      GETCARAPI_BASE_URL: preserve(),
    },
  });

  return project("verifykm", {
    resources: [db, web],
  });
});
