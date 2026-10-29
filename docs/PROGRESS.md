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
Local source and isolated VPS test stack exist. Public repository: https://github.com/terrytan95/MetalFlow-OS. Production stack runs on the VPS with five applied migrations. HTTPS /metalflow returned 200; /metalflow/api/v1/health returned status=ok. Final visual-layout image update verified; source pushed to main. GitHub Actions is retained as an inactive template because the connected OAuth token lacks workflow scope.

## Remaining operational dependencies
SMTP/email delivery and independently recoverable off-VPS backups are not configured. AI credentials/models can now be configured per organization in Settings; no real provider credentials were supplied or used in this delivery. No scheduled backup job was installed. No real customer data was seeded.

## Next action
Continue remaining master-spec features from IMPLEMENTATION_ROADMAP.md. Configure SMTP, dedicated AI models/credentials, and independent off-VPS backups before using irreplaceable customer data.

## Final verification (2026-10-29)
- All 3 Playwright E2E scenarios passed in 12.5 seconds. Theme-only rerun after final card-layout correction passed in 3.0 seconds.
- Palette combinations: seven palettes × light/dark. Measured body/muted/button contrast all >=4.5; palette choice survives reload.
- Production browser login screen rendered with no document overflow at 796px viewport. HTTP page 200, health ok, anonymous /me 401.
- Existing /fhr/ and /gex/ both returned 200 after following normal redirects.
- Public repository visibility and main branch confirmed. Actions template remains inactive due credential scope; no CI run claimed.
- Production database started empty; test and demo tenants were not seeded there.

## AI provider / multi-key update (2026-10-29)
- Added organization-admin settings for OpenAI and OpenAI-compatible Responses/Chat endpoints, configured text/image models, encrypted multiple keys, per-key request caps/token thresholds, health reset, enable/disable/delete and attempt history.
- Added tenant-bound AES-GCM encryption, immutable endpoints, DNS/socket public-network checks, per-key leases, usage-aware selection and bounded key switching. Unknown-completion calls are not replayed. Output-validation failures retain reported usage.
- Migration: 202610290006_ai_providers (provider/key/attempt tables).
- Unit suite: 21 tests passed, including crypto, DNS rebinding rejection, routing and existing business calculations. Strict types, lint, production web build and dependency audit passed.
- Dedicated mock-provider queue integration passed: 429/401/quota failover, usage caps, sixth-key fallback, no 5xx replay, malformed-output usage, interrupted jobs, concurrent lease, tenant isolation and no-secret readback.
- All 4 browser E2E scenarios passed in 27.5 seconds, including AI settings and existing business/theme workflows. Queue integration rerun passed. PR #1 merged (e221cad); production migration and rollout verified.
- No real provider credential or paid API call used. Production master encryption key generated privately on VPS; no provider keys seeded in production.

## Bilingual / performance / completion update (2026-10-29)
- Unified English/Chinese interface, login/onboarding language persistence, forms/status/errors/AI settings and localization coverage check.
- SQL analytics and real inventory pagination; bulk imports/validation, receipt aggregation, lookup maps, bounded stable caches, debounced search and lazy charts.
- FHR-inspired immediate page update + 220ms 4px transition; dialog transitions and reduced-motion support.
- Profile editing, tax settings, credit notes for unpaid balances, task calendar/timeline, customer tags/credit limit, shortage purchase drafts, verified BOM-to-quote, unused-file removal.
- Replay-safe stock adjustments/fabrication, atomic AI quota, organization/signout cache cleanup, preview cleanup and mobile focus fixes.
- Migrations 202610290007_finance_indexes and 202610290008_operations verified on isolated test database.
- Baseline large analytics exhausted test API memory; new fixture median 184.3ms, no unsupported speedup claim. Cutting 5k fixture measured ~8.17x locally; see docs/performance.
- All six browser E2E scenarios passed (57.4s); extended finance/stock/files/quota and AI pool integration passed. Static translation coverage has no missing literal UI keys. 24 unit tests, strict typecheck, lint, dependency audit and production build passed. PDF label localization verified. PR #2 merged (bba33cc); production migrations 007/008 and health checks passed. Remaining scope is explicit in PERFORMANCE_AUDIT.md and IMPLEMENTATION_ROADMAP.md.

Production deployment check: MetalFlow health returned ok; existing FHR/GEX URLs returned HTTP 200. Benchmark data stayed in the isolated test database. No new external service credentials or production demo data were introduced.

## Comprehensive Chinese localization repair (2026-10-29)
- Audited every navigation module with populated synthetic data, all configured creation forms, AI extraction/results, audit history, notifications, CSV exports, validation and mobile layout.
- Repaired contextual material/unit labels, boolean values, movement/action codes, dynamic modal/accessibility labels, locale-specific dates/numbers, native file-input text and structured record presentations. User-authored content and stable identifiers remain intact.
- Added structured validation metadata with no submitted values, localized native constraint feedback, and request-language reset/verification email templates (SMTP delivery not exercised).
- Replaced the prior literal-only i18n check with attribute/template/fallback/formatting/schema checks and explicit regression fixtures. The standard lint command now runs this gate.
- 33 unit tests and all 7 Playwright scenarios passed. The final populated Chinese audit plus completion workflow rerun passed (29.9s), including all 28 navigation pages, calendar month labels, native/backend validation, CSV/BOM exports, name preservation and mobile layout. API business regression, production build and dependency audit passed. PR #3 merged (9583df3); production rollout and health checks passed. Production images match the tested images, test mode is disabled.
- Test environment: task checkout fix/complete-chinese-localization, pnpm; @playwright/test/playwright/playwright-core declared ^1.64.1, locked/installed 1.64.1; bundled headless Chromium 156.0.8078.4, 1440×1000 and 390×844 viewports; isolated VPS Compose via localhost:3411. No production business data was seeded.
