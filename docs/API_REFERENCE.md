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
