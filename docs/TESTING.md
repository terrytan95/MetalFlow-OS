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
