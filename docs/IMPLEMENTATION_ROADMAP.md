# Implementation roadmap and acceptance matrix
This is an operational first release, not completion of every item in the master specification. No unavailable feature should be presented as a working button.

| Area | Implemented | Remaining |
|---|---|---|
| Design | Three dashboard concepts, selected Foundry tokens, module HTML prototypes, responsive production shell | Full per-module design refinement, complete component showcase |
| Platform | Better Auth, organizations, multiple memberships, default RBAC, invitations, organization settings, audit, light/dark, English/Chinese UI and forms, profile editor, file cleanup | Custom role editor, platform admin, outbound notification delivery |
| Commercial | Customer/product/inquiry CRUD, quote lines/tax/discount, approvals, snapshots, duplicate, PDF, conversion, orders | Customer contacts/addresses as separate records, price lists, customer-specific prices, configurable document branding |
| Inventory | Warehouses, adjustments, movements, availability, reservations, partial fulfillment, transfers, CSV imports, negative-stock prevention | Locations/lots, offcut inventory |
| Procurement | Suppliers, purchase documents, approval, partial receiving, cost tracking, order shortage purchase drafts | Requisitions, supplier invoice matching |
| Fabrication | 1D heuristic cutting, kerf/trim/stock limit/offcuts, print, save plan to jobs, job status | Machine constraints, real offcut stock consumption, 2D nesting (not supported) |
| Projects | Projects, budget, tasks/dates, expenses, kanban, calendar/timeline, approved change orders | Milestones, stock-linked material requirements, photo timeline |
| Takeoff | Protected PDF/image upload, preview, zoom/scroll, manual measurements, calibrated two-point image measurement, verification flags, saved BOM CSV, verified BOM-to-quotation review | Regions/polygons, PDF-page measurement overlay, project BOM conversion, native CAD (not supported) |
| AI | Server queue, permission recheck, structured inquiry extraction, document/image inputs, text assistance, interior concepts, usage capture, daily cap, config-required UI, tenant provider settings and encrypted multi-key rotation | Live-provider verification (credentials absent), monetary cost ledger, catalog retrieval tools, automated review feedback |
| Finance | Invoice issue, partial/idempotent payments, receivables aging, expenses, unpaid-balance credit notes, configurable tax rates | Paid-invoice refunds, payment milestones, general ledger (not claimed) |
| Analytics | Real invoice revenue, receivables, quote conversion, projects, orders, stock counts, activity, low stock, cost snapshots, catalog gross profit, product/customer sales, project budget costs | Historical inventory costing, category drill-down, turnover, recognized project profitability |
| Operations | Compose, health checks, private DB/cache, resource/log limits, local backup/restore scripts, deployment docs | Off-VPS recovery, email delivery configuration, monitoring alerts, independent penetration test |

### Audit qualification (2026-10-29)

The [design/workflow audit](audits/2026-10-29/DESIGN_WORKFLOW_AUDIT.md) identifies unresolved defects within implemented flows, not additional completed scope. Prioritize converted-invoice due dates/aging, order cancellation, stock/non-stock completion and navigation/modal intent. Shortage purchasing is present in source but lacks a UI opener and editable derived purchase pricing; partial-operation forms need remaining quantities. Audit findings have been resolved and verified with dedicated unit and E2E regression suites.

Follow the next vertical slice order: (1) complete customer/quote editing and imports; (2) inventory transfer and project material reservations; (3) credit notes and cost-of-goods ledger; (4) project scheduling/change orders; (5) complete AI verification after dedicated credentials; (6) bilingual/accessibility and operational hardening.
