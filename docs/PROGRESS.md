# MetalFlow OS progress

## Scope
Initial operational release. The full master specification is **not complete**; see IMPLEMENTATION_ROADMAP.md for remaining work. No synthetic metrics are injected into production.

## Implemented
- Tenant-aware Better Auth sessions, organization onboarding, memberships, default roles, invitation acceptance, password-reset form, settings and audit logs.
- Customer/product/inquiry persistence; reviewed extraction gate; quotation lines, precise tax/discount totals, draft revisions, versions, approval, duplicate, PDF, accepted quote conversion.
- Orders, concurrent-safe reservations, partial fulfillment with idempotency, invoice conversion, issued invoices, idempotent partial payments.
- Suppliers, approved purchases, partial receipts, warehouse stock adjustments/transfers, transactional CSV imports.
- Deterministic 1D cutting, printable plans, saved fabrication jobs.
- Projects, task boards, expenses, approved budget change orders.
- Protected drawing uploads, manual and scale-derived image measurements, verification flags, saved takeoffs, BOM CSV export.
- Real tenant metrics, revenue, receivables aging, cost-snapshot catalog gross profit, product/customer sales, current-cost inventory valuation, project budget tracking.
- Configurable async AI gateway and worker. AI unavailable without dedicated credentials/models; no live provider test claimed.
- Seven persistent palettes (including monochrome), each with independent light/dark mode.
- Three baoyu-design dashboard directions, Foundry selection, module HTML prototypes, compiled design tokens and components, screenshots.

## Verification so far
- pnpm db:generate: passed.
- pnpm typecheck: passed (strict backend/shared/web).
- pnpm lint: passed.
- pnpm test: 11 tests passed, 3 files.
- pnpm --filter @metalflow/web build: passed; production Next.js build.
- pnpm audit --prod: no known vulnerabilities at check time.
- Five migrations applied to isolated PostgreSQL test database.
- API workflow including tenant isolation, quote/order/payment, partial fulfillment/receiving, concurrent reservations, imports, transfers, change approval, cost redaction, CSRF and protected files: passed.
- Browser commercial workflow and extended modules passed functional steps; mobile regression fixed and both business E2E flows passed. All 3 browser E2E tests passed (12.5 seconds), including 14 palette/mode combinations, contrast, persistence and mobile width.
- Backup/restore drill passed: a PostgreSQL-consistent dump restored into an isolated database; 54 commercial documents matched. Asset/config archives passed readability checks.

## Delivery status
Local source and isolated VPS test stack exist. Public repository: https://github.com/terrytan95/MetalFlow-OS. Production stack runs on the VPS with five applied migrations. HTTPS /metalflow returned 200; /metalflow/api/v1/health returned status=ok. Final visual-layout image update verified; source push in progress. GitHub Actions is retained as an inactive template because the connected OAuth token lacks workflow scope.

## Remaining operational dependencies
SMTP/email delivery, live AI credentials/models and independently recoverable off-VPS backups are not configured. No scheduled backup job was installed. No real customer data was seeded.

## Next action
Verify final theme layout, push reviewed source, validate production HTTPS/health and record the deployed commit.
