# Railway — one service only

This repo is a pnpm workspace. `@workspace/vin-decode`, `api-zod`, `verifykm`, and the other folders are **libraries**, not apps.

Production is:

1. **verifykm** — repo root (`railway.toml` / this file)
2. **postgres**

Do not accept Railway’s “detected monorepo packages” list. Add an empty service from the GitHub repo with root `/`, or run `railway config apply` after `railway link`.
