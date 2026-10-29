# Performance and workflow audit — 2026-10-29

Scope: web shell/forms/tables/drawings, API read/write paths, analytics, inventory, cutting, AI quota and storage lifecycle. Target: SMB multi-tenant workload with 10k products, 50k documents and 100k stock positions. Two read-only reviewers checked backend and frontend; the lead applied and verified fixes. This is not a penetration-test certification.

## Fixed findings

| Finding / impact | Implemented correction | Evidence |
|---|---|---|
| Analytics loaded full tenant records and nested product/stock/cost/expense scans; exhausted 768 MiB fixture container | SQL aggregation, joins, counts and bounded drilldowns; returned only compact summaries | Real API fixture, analytics median 184.3ms; details in performance/README.md |
| Inventory returned only first 500 positions, fake pagination | Tenant SQL joins, true count, stable ordering, page/limit/search | 110-position pagination regression and 100k-position benchmark |
| Low-stock preview limit understated full count | Window count independent of 50-item preview | 110-low-stock fixture returns count 110 and preview 50 |
| Product validation and imports issued per-line queries | Batched product checks, maps, createMany, stock upsert and movement batches | Existing commercial suite + bulk import regression |
| Each receipt loaded all prior receipt JSON | Database grouping of receipt movements with index | Partial receipt/idempotency suite |
| Cutting first-fit scanned every bin (quadratic worst case) and allocated before checking size | Max-capacity tree, leftmost fit, count validation before expansion; O(n log n), O(n) memory | 30 pattern-equivalence fixtures; 5k-piece median 5.862→0.718ms locally |
| Saves changed query keys and reloaded session/full lookups; live search fired each keystroke | Stable cache keys, targeted invalidation, 250ms debounce, bounded cache lifetime, retained table while refetching | Browser checks session is not refetched on customer save |
| Every reference cell flattened/scanned lookup arrays | One memoized ID map | O(R×C×L) lookup work becomes O(L+R×C) |
| Only first 100 related entities could be selected | Searchable server-backed selectors | Selector browser flows; independent API search |
| Large chart library loaded with all pages | Dynamically imported chart component | Production build produces separate chart chunk |
| Completed jobs polled indefinitely | Poll only while jobs are queued/running | Source and browser behavior checks |
| Blob URLs retained after unmount | Revoke preview URLs on replacement/unmount; ignore stale preview completion | React cleanup paths and drawing workflow |
| Changing organization or signing out retained selected records/cache | Clear dialogs/selections and session cache; reset organization state | Multi-workspace/profile browser flow |
| Duplicate stock/credit/transfer/job saves | Stable request IDs, synchronous submit lock, durable adjustment/fabrication request records | Replay regression tests |
| Retrying an uncertain inventory import after closing modal changed its key | Session-persisted content/request key until success | Import workflow plus API replay tests |
| AI daily job quota was check-then-insert | Organization advisory lock and transactional quota reservation | 10 concurrent submissions with one remaining slot: 1 accepted, 9 rejected |
| Mobile closed sidebar remained focusable | inert closed navigation, focus containment, Escape, aria-expanded | Mobile + reduced-motion E2E |
| Upload replacement cleared unsaved measurements before success | Apply latest successful upload atomically; preserve old work on failure | Drawing flow; stale-upload guard |
| Unused uploads lacked cleanup path | Explicit user-confirmed delete; reject linked files | Protected-file API rules; no automatic deletion of user files |

## Localization and motion

English/Simplified Chinese use one React locale context and explicit dictionaries, not DOM scanning. Stored business codes and user-entered text are not translated or altered. Login, onboarding, common forms, status labels, settings/AI, navigation, operations, errors and accessible labels have translated UI paths. `scripts/check-i18n.ts` rejects untranslated static JSX and missing literal translation keys; browser tests cover Chinese operation and persistence. Provider-generated prose and arbitrary user notes are content, not UI strings.

FHR Scout's actual helper was inspected: immediate state update followed by a 4px/220ms transform, with reduced-motion bypass. MetalFlow uses that pattern for page entry, short Radix dialog entry/exit and subtle controls. No global page snapshot is awaited, no stagger across large tables, and reduced-motion disables animation.

## Remaining / not claimed fixed

- Deep page-number offsets still have O(offset) database cost. Stable tie-breakers now prevent equal-timestamp ordering ambiguity; cursor API migration remains future work.
- Full customer contact/address collections and price lists, stock locations/lots/offcut consumption, project material reservations, supplier invoice matching, and audited historical COGS are not completed by this update.
- Schedule returns up to 1,000 tasks in a maximum 62-day range; analytics drilldowns show top/recent 50 rows. Full summaries remain separate.
- Credit notes in this release reduce unpaid invoice balances. Paid-invoice refunds and stock-return accounting are not implemented.
- No real AI provider bill, email delivery, independent offsite backup, or multi-instance load test was performed.

Actual measurements, fixture scripts and caveats: [performance/README.md](performance/README.md).
