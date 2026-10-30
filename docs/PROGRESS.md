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

## Mobile Viewport Polish (2026-10-29)
- Fixed mobile authentication form width and padding to ensure exactly 390px viewport fit without horizontal scrollbar.
- Re-verified full Chinese login screen rendering and form validity messages via headless Chromium on production environment.

## Design and workflow audit (2026-10-29)
- Pulled `main` with `--ff-only`; checkout and `origin/main` already matched `7263965`.
- [Audit report and fresh screenshots](audits/2026-10-29/DESIGN_WORKFLOW_AUDIT.md) record 11 findings, including four high-priority workflow issues. No application fixes were made.
- Live Ego checks covered public English/Chinese auth, desktop/mobile widths, language persistence, keyboard order, required-field validation and representative contrast. Authenticated business findings were verified against source, not exercised in production.
- Source findings include missing due dates on converted invoices, inaccessible order cancellation, incompatible non-stock receiving/fulfillment, navigation/modal state conflicts, and incomplete shortage/partial-operation UX. These qualify earlier implementation claims; fixes and dedicated regression verification remain outstanding.
- No production data changes, test-suite rerun, deployment, commit or push occurred during this audit.

## Design and workflow audit fixes (2026-10-29)
- Resolved all 11 audit issues (4 high-priority, 7 medium-priority) across commercial workflows and frontend interactions:
  - B1: Converted invoices now preserve due dates; added draft-only payment terms endpoint; updated aging query to distinguish undated and overdue buckets (-1 to 4).
  - B2: Exposed order/purchase cancellation with confirmation explaining stock effects; automatically releases reservations for eligible orders.
  - B3: Separated catalog lines (which track inventory) from non-stock lines (labor/freight); service-only orders/purchases complete without inventory operations.
  - B4: Added purchase shortage draft creation modal from order detail, preserving source lineage while allowing supplier price edits.
  - B5: Stock receiving/fulfillment now tracks ordered, completed, and remaining quantities; inputs default and constrain to remaining balances; warehouse selection for orders is restricted to reservation warehouses.
  - B6: ResourceForm now explicitly distinguishes unchanged omissions from cleared fields; sends validated nulls for nullable dates and foreign keys.
  - W1: Coordinated route navigation and modal intent into single transitions; prevented hashchange from dismissing freshly opened forms.
  - W2: Added dirty state tracking and confirmation prompt before closing modals with unsaved changes.
  - W3: Added "Back to sign in" navigation to password recovery, recovery-specific instructions, and neutral status message.
  - W4: Updated mobile touch targets to >= 44x44px for primary/icon/text buttons and form inputs to >= 16px font size to prevent mobile zoom.
  - W5: RecordsTable now renders distinct states for no data, no search matches (with clear search action), and permission/load errors.
- Verification: 43 unit tests passing in Vitest, 8/8 comprehensive audit E2E scenarios passing in Playwright, strict TypeScript, lint, and production Next.js build verified.

## UI Spacing, Select Alignment, and Morandi Palettes (2026-10-29)
- Standardized empty-state record creation button margins with a dedicated `.table-empty-actions` wrapper providing consistent 20px padding (14px on mobile) matching filter bar and pagination.
- Aligned dropdown select arrows across all native selects with custom SVG chevron and balanced horizontal/vertical margins.
- Desaturated default Foundry theme to Morandi pine-teal (#365c52 / dark #8faea5) and added 6 new Morandi palettes (olive, clay, stone, pine, sand, mauve) with verified WCAG AA (>= 4.5:1) contrast across light and dark modes.
- Bound global scrollbar colors (standard `scrollbar-color` and `::-webkit-scrollbar` thumb/hover) to active theme tokens (`--scrollbar-thumb` and `--scrollbar-thumb-hover`), replacing browser default grey scrollbars across the sidebar, tables, dialogs and kanban views.

## Page text size preference (2026-10-29)
- Added page text size setting with four tiers (small 90%, standard 100%, large 110%, extra large 120%) available in both Organization Settings and Appearance modal.
- Dynamically scales typography across body, headings, tables, labels and sidebar via `--text-scale` while preserving layout stability, mobile viewport fit, and local persistence via `metalflow.textSize`.

## Morandi desaturation, notifications error handling & i18n (2026-10-29)
- Reduced color saturation across all 13 Morandi themes to 0–15% for genuine muted tones while maintaining WCAG AA contrast compliance (>= 4.5:1) in both light and dark modes.
- Handled fetch network exceptions gracefully in client API layer with localized feedback and added Retry action to the activity notifications modal.
- Expanded audit action entity and status localization to cover all business documents (quotation, order, purchase, invoice, file, AI providers, API keys).

## Comprehensive UI polish, whitespace optimization & humanized Chinese copy (2026-10-29)
- Applied make-interfaces-feel-better principles: root antialiasing, text-wrap balance for headings and pretty for body/descriptions, multi-layer subtle elevation shadow tokens, concentric radii, and smooth hover lifts.
- Compacted layout whitespace: streamlined header height from 68px to 54px, main padding to 20px 26px, tighter metric cards (15px 17px padding, 25px font), and high-density enterprise table cells (11px 15px).
- Humanized Chinese localization with humanizer-zh guidelines: eliminated robotic and hollow marketing phrasing across notifications, workspace headlines, role explanations, token limits, and document workflow confirmations.

## Typography scale expansion, input placeholders & spacing polish (2026-10-29)
- Substantially increased baseline typography across all tiers from 13px to 15px base (small: 14px, standard: 15px, large: 16.5px, extra large: 18px) for high readability across tables, inputs, labels, headings and sidebars.
- Added contextual and localized placeholder hints to all input and textarea fields across ResourceForm, DocumentForm, auth screens, settings, takeoffs and modal dialogs.
- Refined component spacing and reduced dead whitespace: tightened form label margins, notice boxes, modal footers, and quote line margins.

## Conversational ChatGPT-style AI Workspace (2026-10-29)
- Transformed the static dual-panel AI assistant and design views into a modern ChatGPT-style conversational chat stream with user and assistant speech bubbles.
- Replaced legacy form submit with pill-shaped input dock featuring a dedicated plus (+) button for file attachments, auto-expanding textarea, round send button, and disclaimer notes.
- Maintained compatibility with AI job generation, concept image rendering, model tags, and empty state prompt suggestions.

## Multimodal OCR image recognition & pre-save review (2026-10-29)
- Added unified OCR photo/document recognition endpoint `POST /metalflow/api/v1/ai/extract` supporting vision extraction across orders, quotations, purchases, customers, inventory, and fabrication work orders via the organization's bound AI provider.
- Integrated camera/upload OCR action button into both ResourceForm and DocumentForm; parsed fields and line items pre-fill the form automatically.
- Enforced pre-save user confirmation: displays prominent review notice, allowing users to verify, edit, or adjust all recognized values before final save.

## Quick Create dropdown menu (2026-10-29)
- Upgraded top header "+ 快速创建" button into an accessible dropdown menu providing instant one-click creation across CRM, supply chain, operations, and finance.
- Categorized options into Sales (Customer, Inquiry, Quotation, Order), Supply Chain (Product, Inventory Adjust, Stock Transfer, Purchase Order, Supplier), Operations (Fabrication, Project, Task), and Finance (Invoice, Credit Note) with permission filtering.
- Integrated click-outside and Escape key closing with smooth chevron rotation animation.

## Expanded AI chat canvas & input width (2026-10-29)
- Expanded `.chat-container` maximum width from 980px to 1400px and pill input dock to 1080px to utilize wide desktop displays and eliminate excess side margin voids.
- Enlarged welcome hero card and prompt suggestion grid to 880px with increased 90% message bubble row span.

## Markdown rendering in AI chat responses (2026-10-29)
- Integrated GitHub Flavored Markdown (GFM) rendering with sanitization for AI assistant and design conversation messages.
- Formatted headings, lists, blockquotes, inline/fenced code blocks, tables, and links with theme typography tokens.

## Multi-session AI chats, conversation deletion & history clearing (2026-10-29)
- Implemented full multi-session chat management in AIWorkspace: added ChatGPT-style left sidebar with "+ New chat" button, session listing, dynamic titles, and timestamps.
- Supported individual chat deletion with user confirmation via `DELETE /metalflow/api/v1/ai/sessions/:sessionId` (or `DELETE /metalflow/api/v1/ai/jobs/:id`).
- Added "Clear all AI conversation history" action in Organization Settings via `DELETE /metalflow/api/v1/ai/history` with tenant-isolated database cleanup and user confirmation gate.
- Replaced browser-native window.confirm with in-page theme-matched confirmation modals for both single chat deletion and global history clearing.
- Extended AI chat layout height to dynamically fill viewport (`calc(100dvh - 200px)`), eliminating lower dead whitespace and maintaining balanced 14px bottom margins to footer across screen resolutions.
- Fixed "+ New chat" action in AI Workspace to transition into a blank conversation state rather than falling back to historical sessions, generating fresh session IDs on submission.
