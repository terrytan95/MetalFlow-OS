# API reference
Base: /metalflow/api/v1. Interactive OpenAPI: /metalflow/api/docs.

All business requests require the Better Auth session cookie and X-Organization-ID for a verified membership. Mutations also require an Origin header equal to the configured public origin. JSON bodies are validated by Zod. Errors have error.code, error.message and error.requestId. Pagination: page and limit (maximum 100); search is server-side.

- /auth/sign-up/email, /auth/sign-in/email, /auth/sign-out, /auth/get-session, /auth/request-password-reset, /auth/reset-password: Better Auth.
- GET /me, POST /organizations, PATCH /settings, GET /team, PATCH /team/:id.
- POST /invitations, POST /invitations/accept.
- GET/POST /customers, /products, /inquiries, /suppliers, /warehouses, /projects, /tasks, /expenses, /fabrication, /takeoffs. PATCH /:resource/:id.
- GET/POST /documents; GET filter kind=QUOTATION|ORDER|PURCHASE|INVOICE. PATCH /documents/:id for original drafts.
- POST /documents/:id/status; POST /documents/:id/convert; POST /documents/:id/duplicate; GET /documents/:id/pdf.
- GET /inventory, POST /inventory/adjust, GET /movements.
- POST /orders/:id/reserve, /orders/:id/fulfill, /purchases/:id/receive.
- GET/POST /payments. Sensitive receiving/payment requests require UUID idempotencyKey.
- POST /cutting-plans, GET /analytics, GET /audit.
- POST /files (multipart, 15 MiB maximum); GET /files/:id (tenant-authenticated).
- GET/POST /ai/jobs. AI returns configuration-required errors until credentials/models exist.

OpenAPI currently enumerates routes; detailed body contracts are in Zod schemas and this document. Generated DTO schemas are a remaining documentation task.

Additional operations: POST /inventory/transfer (tenant-validated warehouses, available-stock guard, idempotent request); POST /imports/:resource for customers/products/inventory (500-row atomic import); GET/POST/PATCH /change-orders and POST /change-orders/:id/approve (budget adjustment once only).

Analytics definitions: revenue is issued invoice subtotal less document discount, excluding tax, by creation date. Receivables are all issued invoice totals less payments. Quote conversion is converted quotations / created quotations in the selected range. Catalog gross profit subtracts immutable quoted catalog cost snapshots from revenue; unavailable if any invoice lacks complete costs. Inventory valuation is on-hand × current catalog cost, not historical accounting COGS. Product sales are pre-document-discount line extensions. Project budget reports compare budget (including approved changes) with recorded expenses, not recognized project revenue.

### Organization AI configuration
All configuration routes require organization:manage and verified membership:
- GET/POST /ai/providers; PATCH /ai/providers/:id (endpoint/protocol immutable).
- POST /ai/providers/:id/keys (write-only plaintext input, encrypted storage).
- PATCH /ai/providers/:id/keys/:keyId (label, enable, daily limits, resetHealth).
- DELETE /ai/providers/:id/keys/:keyId (rejects an active lease).
- POST /ai/jobs accepts an optional tenant-owned providerId. The selected provider/model is saved with the queued job.

GET returns masked key suffixes, observed usage, status/cooldown and the most recent 30 attempt records; it never returns key plaintext/ciphertext/fingerprints. See AI_PROVIDERS.md for routing/error rules and native protocol limits.

Bilingual/performance update: inventory now honors page/limit/search with full count; analytics performs SQL aggregation and limits date ranges to 366 days, returns a separate lowStockCount and at most 50 preview/drilldown records. Added GET/POST credit-notes (idempotent, unpaid balance only), GET/POST/PATCH tax-rates, PATCH profile, GET schedule (up to 62 days/1,000 tasks), POST orders/:id/purchase-shortage, GET files and DELETE files/:id (only unlinked uploads). Stock adjustment and fabrication writes accept idempotencyKey.
