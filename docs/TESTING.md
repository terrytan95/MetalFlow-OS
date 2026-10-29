# Verification
- `pnpm db:generate` generates Prisma client.
- `pnpm typecheck` checks backend/shared/frontend strict TypeScript.
- `pnpm lint` checks source with ESLint.
- `pnpm test` runs deterministic financial, unit, geometry, cutting and permission tests.
- `pnpm --filter @metalflow/web build` produces the Next.js release build.
- `TEST_BASE_URL=http://127.0.0.1:3411/metalflow TEST_ORIGIN=http://127.0.0.1:3411 pnpm exec tsx tests/api-workflow.ts` creates synthetic tenants and tests the commercial lifecycle, isolation, role restrictions, partial operations, idempotency and concurrent reservations.
- `TEST_BASE_URL=http://127.0.0.1:3411/metalflow pnpm test:e2e` runs browser onboarding through payment plus light/dark/mobile checks.
- `pnpm audit --prod` checks current known dependency advisories.

Tests create uniquely named fictional records in an isolated Compose project. They must not run against the live business database. Tests are not a proof of zero defects or full compliance.

Performance: after seeding a dedicated test tenant, use browser network timings and repeated authenticated list requests at 25/100 rows. Record hardware, row counts, date and p50/p95. No unmeasured latency or throughput target is claimed.

Security review used two read-only Luna Max workers for bounded static inspection. Lead verified and repaired findings, then added regression tests. No worker changed files or accessed production. Observed runtime model metadata was not returned beyond the configured role.

Browser QA found and fixed hidden-dialog data assumptions, TTC PDF font selection, stale Docker proxy addresses, asynchronous upload state loss, and a screen-reader-only element escaping a mobile scroll container. Regression coverage remains in tests/e2e.

Appearance regression checks all seven palettes in light and dark modes (14 combinations), including body/muted/button contrast ratios, reload persistence and mobile width. Results must be read from the actual test output, not inferred from the presence of the test.

GitHub Actions is not enabled: the connected OAuth credential lacks the workflow scope, and GitHub rejected the initial push containing .github/workflows/ci.yml. The same configuration is preserved at infrastructure/ci/github-actions.yml.example. An authorized operator can later copy it to .github/workflows/ci.yml with workflow-capable credentials. Local and VPS verification ran independently; no GitHub CI success is claimed.

AI provider test overlay: start isolated Compose with `-p metalflow-test -f docker-compose.yml -f docker-compose.test.yml -f docker-compose.ai-test.yml`. It adds an internal-only synthetic provider and a localhost-public-URL-gated exception for that one mock origin. Never include this overlay in production. Run `tests/ai-provider-integration.ts` inside test-api, and `tests/e2e/ai-settings.spec.ts` through the loopback test proxy. Assertions cover encrypted-at-rest/no-readback, duplicate key rejection, 429/401/quota failover, usage/thresholds, sixth-key selection, invalid-output usage, no 5xx replay, interrupted job reconciliation, concurrent leasing, tenant isolation and network policy.

Bilingual/performance suite: `pnpm exec tsx scripts/check-i18n.ts` verifies static UI coverage; `scripts/benchmark-cutting.ts` compares worst-case first-fit implementations; `tests/performance-seed.ts` and `tests/performance-run.ts` reproduce isolated large-tenant API fixtures. `tests/extended-workflow.ts` covers credit/payment reconciliation, full low-stock counts, 110-position pagination, imports, shortage procurement, replay-safe adjustment/fabrication, atomic AI job quota and protected-file deletion. Browser completion/i18n-motion cases cover profile, tax, calendar, multi-workspace state, Chinese persistence, no /me refresh on customer save and reduced-motion behavior.
