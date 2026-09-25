# Railway deploy — VerifyKM (verifykm.com)

Clone of the kmcheck stack under `C:\Users\Pc\Downloads\vk`. Variable **names** match kmcheck; values are VerifyKM-specific.

## Required service variables

| Variable | Notes |
|----------|--------|
| `DATABASE_URL` | Railway Postgres plugin (append `?sslmode=require` if using public host) |
| `JWT_SECRET` | Long random string (unique to VerifyKM — do not reuse kmcheck) |
| `ADMIN_EMAIL` | First login admin |
| `CLIENT_GUARD_TOKEN` | Random; must match build-time `VITE_CLIENT_GUARD_TOKEN` |
| `VITE_CLIENT_GUARD_TOKEN` | **Build-time** — same value as `CLIENT_GUARD_TOKEN` |
| `NODE_ENV` | `production` |
| `SITE_URL` | `https://verifykm.com` |
| `CORS_ORIGIN` | `https://verifykm.com,https://www.verifykm.com` |

## Optional / same shape as kmcheck

| Variable | Notes |
|----------|--------|
| `CARSTAT_API_KEY` | Provider bootstrap |
| `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` | Or set in admin |
| `POK_MERCHANT_ID` / `POK_KEY_ID` / `POK_KEY_SECRET` / `POK_ENV` | Card payments |
| `GETCARAPI_API_KEY` / `GETCARAPI_BASE_URL` | VIN archive |
| `LOG_LEVEL` | default `info` |
| `PG_POOL_MAX` | default `20` |
| `SMTP_*` / `SMTP_INSECURE` | Email |

## Local ports (avoid clashing with kmcheck)

- API: `8082` (`PORT` / `API_PORT`)
- Vite: `5174` (`VITE_DEV_PORT`)
- DB: `verifykm` on local Postgres

## Build

`pnpm run build:railway` (requires `CLIENT_GUARD_TOKEN` in the environment).