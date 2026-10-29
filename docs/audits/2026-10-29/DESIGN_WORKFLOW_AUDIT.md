# MetalFlow OS — design and workflow audit

Date: 2026-10-29  
Baseline: `7263965a15c1e764a1c95d95523e36366602cee2` (`main`, equal to `origin/main` after `git pull --ff-only`)  
Live URL: https://terrytan.dev/metalflow

## Assessment

Keep the Foundry visual direction. The restrained forest-teal palette, clear headings, consistent surfaces and compact business tables are a credible foundation. The higher-value work is making business journeys dependable and easier to discover, not replacing the styling system.

The audit records **11 actionable findings: four high-priority and seven medium-priority**. Resolve the invoice-aging, cancellation, stock/non-stock completion and navigation-intent defects before treating the operational journeys as dependable.

This is a bounded audit, not certification that the complete product works in production. Live inspection reached the public authentication screens only. Authenticated findings below are verified against current source, not presented as live reproductions.

## Evidence and boundaries

- Live Ego browser TaskSpace 6: sign-in, registration and password-recovery screens; English and Simplified Chinese; 1440×1000, 390×844 and 320×568 viewports; keyboard order; empty-form required-field validation; language persistence after reload; computed control sizes and representative contrast.
- Mobile screenshots used viewport emulation, not physical iPhone/Android testing. The CLI reset viewport emulation on reload; measurements were repeated after explicitly restoring it.
- No credentials were supplied and the browser had no authenticated MetalFlow session. No accounts, emails, documents, payments, stock or other production records were created or modified. The empty sign-in submission was stopped by native required-field validation.
- Current source inspected with the repository knowledge graph and Serena; important lines checked directly. Index generation `2026-10-29T19:17:39Z`; cited application paths had no recorded coverage issue. That is not a proof of complete indexing.
- Existing screenshots in `tests/e2e/evidence/` were consulted only as historical design context. They are not screenshots from this audit and do not establish current live behavior.
- No integration/E2E test suite was run. This checkout has no installed dependencies, and pnpm/Docker were not available on the shell path. Tests that create synthetic data were not pointed at production.
- No application fixes, deployment, commit or push were performed as part of the audit.

## Verified business-workflow findings

All six findings in this section are source-confirmed. They were independently inspected and then checked against the current implementation by the audit lead; none is claimed as an authenticated live reproduction.

### B1 — Converted invoices cannot receive due dates and never age out of the current bucket

**Priority: High.**

The advertised quotation → order → invoice flow creates an invoice without `dueDate`. Both the API and the web prevent editing any draft with a `sourceId`, so the missing payment term cannot be added. The aging query substitutes the current timestamp for a null due date. Consequently, even a converted invoice left unpaid for 90 days remains in the first “Current / 0–30” bucket. This does not erase its receivable balance, but it makes collection prioritization misleading.

- [Conversion payload omits due date](../../../apps/api/src/commerce.ts:198)
- [Derived drafts cannot be edited](../../../apps/api/src/controller.ts:352)
- [Edit action hidden](../../../apps/web/components/workspace.tsx:2135)
- [Aging fallback](../../../apps/api/src/analytics.ts:56)

**Smallest correction:** collect a due date/payment term when creating the invoice, or allow safe invoice-metadata editing before issue. Clearly separate undated invoices from current invoices. Verify converted overdue invoices land in the correct aging bucket.

### B2 — Order cancellation is missing from the UI, leaving stock reserved

**Priority: High.**

The API supports cancellation of eligible draft/confirmed/reserved/processing orders and releases their remaining reservations. The document actions expose confirmation, stock operations and conversion but no cancellation. When a customer cancels a reserved, uninvoiced order, even an owner cannot release that stock through the web application. Purchase cancellation transitions are also not exposed.

- [Supported transitions and reservation release](../../../apps/api/src/commerce.ts:103)
- [Web document actions](../../../apps/web/components/workspace.tsx:2144)

**Smallest correction:** expose only the existing kind/status/permission-valid cancellation actions, with confirmation explaining the stock effect. Preserve API restrictions on invoiced or partially fulfilled orders. Derive action availability from shared transition rules instead of maintaining a different UI map.

### B3 — “Materials & services” allows documents that stock operations cannot finish

**Priority: High.**

The shared document editor permits non-catalog lines and labels the section “Materials & services.” Purchase receipt processing nevertheless rejects the entire purchase order if any line lacks a product ID. A purchase of catalog metal plus a manually entered freight/service charge can therefore be approved but cannot receive even its valid metal lines. A service-only sales order also cannot complete fulfillment: it has no stock to reserve, while fulfillment requires a reserved/processing/partially fulfilled state.

- [Optional catalog selection](../../../apps/web/components/forms.tsx:281)
- [Receipt rejects any non-catalog line](../../../apps/api/src/commerce.ts:505)
- [No-stock reservation rejection](../../../apps/api/src/commerce.ts:255)
- [Fulfillment requires stock reservation](../../../apps/api/src/commerce.ts:332)

**Smallest correction:** explicitly distinguish stock and non-stock lines. Receive stock lines independently and define service completion, or reject unsupported purchase content before approval with a clear explanation. Do not require fake inventory to represent labor or freight.

### B4 — Shortage purchasing has no UI entry point, and generated prices cannot be revised

**Priority: Medium.**

A shortage-purchase modal and API exist, but a search of the complete web source finds no action that opens `modal === "shortage"`. Its instruction promises price review and approval. However, the generated purchase copies catalog cost and sets `sourceId`, which makes it ineligible for the editor in both UI and API. The documented feature is therefore not an accessible end-to-end web workflow.

- [Existing modal](../../../apps/web/components/workspace.tsx:1597)
- [Generated purchase cost and source link](../../../apps/api/src/commerce.ts:728)
- [Derived-draft editing restriction](../../../apps/api/src/controller.ts:356)

**Smallest correction:** add the permitted order-level entry action, navigate to the resulting purchase, and allow legitimate supplier-price/draft edits while preserving source lineage and tenant checks.

### B5 — Reopened partial operations propose the original quantity, not what remains

**Priority: Medium.**

After receiving or fulfilling 4 of 10 units, the form again defaults to 10 because it renders the original document line quantity. It does not display completed and outstanding quantities, and fulfillment offers all lookup warehouses rather than selecting the actual reservation warehouse. The API correctly rejects the excess, so this is a workflow failure rather than permission to over-receive stock.

- [List response lacks operation progress](../../../apps/api/src/controller.ts:310)
- [Warehouse selector and quantity defaults](../../../apps/web/components/workspace.tsx:2322)
- [Reservation balance check](../../../apps/api/src/commerce.ts:340)
- [Receipt balance check](../../../apps/api/src/commerce.ts:520)

**Smallest correction:** return ordered/reserved, completed and remaining quantities; default and constrain inputs to the remaining balance. Show reservation-aware warehouse choices for fulfillment. Test a 4+6 completion explicitly.

### B6 — Clearing optional fields can silently preserve the old value

**Priority: Medium.**

`ResourceForm` excludes every empty-string value from its update payload. The PATCH endpoint correctly treats omitted fields as unchanged. Clearing an existing task/project due date, task project association, or notes therefore saves without clearing that value. Optional date/reference schemas also lack an explicit nullable clearing contract. A task removed from a schedule by clearing its due date still retains that date.

- [Empty values omitted](../../../apps/web/components/forms.tsx:59)
- [PATCH preserves omissions](../../../apps/api/src/controller.ts:1202)
- [Project/task optional schemas](../../../apps/api/src/resources.ts:85)

**Smallest correction:** distinguish unchanged from cleared values. Send empty strings for clearable text, and an explicit validated nullable value for nullable dates/references. Add edit → clear → save → reload regression cases.

## Verified interaction findings

### W1 — Navigation can dismiss the form or record it just opened

**Priority: High. Evidence: source-confirmed; authenticated runtime not exercised.**

`navigate()` changes `location.hash` and clears modal/selection state. Callers such as **Quick create** and global-search record results immediately set a new modal afterward. The later `hashchange` listener clears that modal and selection again. When the target module differs from the current hash, the requested form/detail is dismissed; when it is the same module, no hash change occurs, so behavior differs by starting page.

- [navigate and hashchange](../../../apps/web/components/workspace.tsx:286)
- [Quick create](../../../apps/web/components/workspace.tsx:785)
- [Global search record selection](../../../apps/web/components/workspace.tsx:1801)

**Smallest correction:** make route and modal intent one coordinated transition; distinguish browser back/forward handling from an internally initiated navigation. Add regressions for Quick create from another module and selecting a cross-module search result.

### W2 — Closing a dialog silently discards unsaved work

**Priority: Medium. Evidence: source-confirmed.**

The shared Radix dialog forwards every close event directly to `onClose`. Create/revise callers immediately clear the modal, and document lines/notes live only in component state. Escape, the close button or an outside dismissal can therefore discard a multi-line quotation without confirmation or recovery.

- [Shared modal](../../../apps/web/components/ui.tsx:17)
- [Document draft state](../../../apps/web/components/forms.tsx:189)
- [Create dialog](../../../apps/web/components/workspace.tsx:1844)
- [Revise draft dialog](../../../apps/web/components/workspace.tsx:2006)

**Smallest correction:** track dirty state, prompt before discarding, and preserve the draft during temporary navigation. Keep ordinary clean dialogs easy to dismiss. Never use an unscoped cross-tenant local-storage draft.

### W3 — Password recovery has no direct return to sign-in

**Priority: Medium. Evidence: live reproduction and source.**

Open **Forgot password?**. The reset screen offers only language switching, **Send reset link**, and **Create an account**. There is no **Back to sign in**, and the subtitle still says “Sign in to keep your operations moving.” A user must reload or navigate through registration to return to sign-in. Reset mode is component state, not its own history entry.

- [Mode-specific subtitle](../../../apps/web/components/auth.tsx:78)
- [Auth mode controls](../../../apps/web/components/auth.tsx:163)
- [Desktop evidence](live-reset-desktop.png)
- [Chinese mobile evidence](live-reset-mobile-zh.png)

**Smallest correction:** add a direct return action, recovery-specific instructions and a neutral success state separate from error styling. Email delivery itself was not tested; existing progress documentation says SMTP is unconfigured.

### W4 — Mobile fits the viewport, but controls remain desktop-sized

**Priority: Medium. Evidence: live measurements and source.**

At 390px, the sign-in/registration primary button and language button are approximately **34.8px high**. The inline account switch is **18px high**; the recovery action is **16.5px high**. Input text is **12px**. Width containment works, but touch accuracy and readability are weaker than the layout's appearance suggests.

- [Base control styles](../../../apps/web/app/globals.css:78)
- [Button sizing](../../../apps/web/app/globals.css:132)
- [Mobile header controls](../../../apps/web/app/globals.css:1241)
- [Live mobile sign-in](live-login-mobile-en.png)
- [Live mobile registration](live-register-mobile.png)

**Smallest correction:** give mobile primary/icon actions at least 44×44px touch targets and form inputs 16px text; extend inline action hit areas without overlap. This is a usability target, not a blanket claim of WCAG failure. Physical iOS focus/zoom behavior was not tested.

### W5 — Empty search results are presented as an empty business

**Priority: Medium. Evidence: source-confirmed.**

`RecordsTable` renders the same default `Empty` component whenever its items array is empty. The message says “No records yet / Create your first record to get started,” including when an existing populated module has no search matches. The filter state is not passed to the empty-state component. Read-only users can also be told to create records they cannot create.

- [Unconditional empty state](../../../apps/web/components/table.tsx:89)
- [Default empty copy](../../../apps/web/components/ui.tsx:71)
- [Filtered list and table](../../../apps/web/components/workspace.tsx:1393)

**Smallest correction:** distinguish no data, no matches, no permission and load error. For no matches, show the query and a clear-search action; show a create action only when permitted.

## Design direction and workflow recommendations

These are product-design recommendations, not claims of runtime defects.

1. **Make daily work the primary hierarchy.** The navigation exposes 28 destinations across six groups, all initially expanded. Keep the module structure, but prioritize the next actions for the current role: quotes awaiting approval, stock shortages, receiving and overdue invoices. Let lower-frequency administration and visual preferences recede.
2. **Use an explicit document journey.** Show the source inquiry/quotation, current order, reservation and fulfillment progress, related invoice, payments and next allowed action together. Persistent record URLs would let teammates share exact work and recover after refresh; module-only hashes do not identify the selected record.
3. **Improve list decision support.** The shared list toolbar is primarily text search and page export, and the table uses only a core row model. Add domain-specific status/date/customer/warehouse filters and meaningful sorting before adding decorative controls. Make the order of work obvious.
4. **Make first-run setup actionable.** Organization onboarding captures business type, currency, country and language, but a new organization still needs customers, catalog, tax and stock setup. A short role-aware checklist should lead into a first successful quotation or receiving flow instead of generic empty tables.
5. **Preserve density selectively.** Compact desktop tables are appropriate; tiny mobile controls and secondary text are not necessary to preserve that density. Use a stronger distinction between amounts/status/next action and secondary metadata. Keep the current tokens and Radix components.
6. **Make activity useful for follow-through.** Notifications show an action, truncated record ID and time, but no record-opening action. Prefer the business document/customer name, actor and a link to the relevant record where permission permits. Do not suggest that this activity feed is outbound notification delivery.

## What passed in this audit

- Public login rendered coherently at desktop size; the primary action has a clear visual hierarchy.
- At the tested 390px and 320px widths, document scroll width matched viewport width: no horizontal page overflow on sign-in.
- English/Chinese switching worked, and Chinese locale persisted after reload (`lang="zh-CN"`).
- Email/password fields have associated labels and appropriate email/current-password/new-password autocomplete values.
- Keyboard order followed email → password → sign-in; empty submission focused email and displayed required-field validation.
- Measured login contrast: heading **13.91:1**, muted copy **5.00:1**, primary button text **7.05:1**, footer **5.00:1**. These checks do not cover all themes, application states or focus indicators.
- Anonymous `/api/v1/me` returned 401 in browser logs, which is expected at the sign-in screen; it was not classified as a defect.

## Scope not claimed complete

The repository already identifies unconfigured SMTP, off-VPS recovery and live AI-provider verification as operational dependencies. Customer addresses/contacts, stock-linked project requirements, advanced fabrication and full accounting are explicit roadmap gaps, not newly discovered regressions. This audit does not certify those capabilities or exercise production mutations.
