# Chinese localization audit — 2026-10-29

The earlier checker covered literal JSX and `t("literal")` calls but missed runtime values, fallback expressions, template attributes and browser-default formatting. Empty-screen verification did not exercise those paths.

## Repaired scope

- Separate resource, field, enum and activity labels. Audit logs and notifications no longer expose `payment.record`, `inventory.adjust`, `ai.key.create`, or raw resource IDs as headings.
- Table booleans, materials, movement kinds, dates, invoice references and all configured form labels/options. Profile `sheet` means 薄板 while unit `sheet` means 张. User names, identifiers, SKU/model IDs, free text and arbitrary user data remain unchanged.
- Named placeholders translate dynamic modal/action labels without changing inserted customer/provider names.
- Structured AI inquiry results and read-only records use labeled fields rather than raw JSON. Unknown source prose remains in its original language.
- Request-language date/time and number formatting; Chinese theme accessibility labels and captions; Chinese file-picker captions; calendar weekday labels; mobile wrapping for longer Chinese labels.
- Chinese CSV output headers, known domain values and file names, including UTF-8 BOM for BOM exports. Import templates keep stable machine column names and explain this in Chinese.
- Structured validation issues are returned without raw submitted values. The UI localizes the field path and actionable constraint. CSV parser, authentication, AI error and financial/stock errors have Chinese display labels.
- Missing PDF states and request-language verification/reset-email templates. Real SMTP delivery remains unconfigured and was not tested.

## Regression gates

`scripts/check-i18n.ts` now checks JSX text, user-facing attributes/templates, expression fallbacks, raw JSON presentation, date/number calls without locale, configured field/column/option catalogs and literal translation keys. `scripts/i18n-audit.ts` has a fixture test proving it catches the earlier blind spots. This is a targeted checker, not a proof that arbitrary third-party text is translatable.

`tests/e2e/chinese-coverage.spec.ts` creates an isolated synthetic organization with customers/products, stock, invoices/payments, tax settings, projects, tasks, a takeoff, audit history and a mock-provider extraction. It traverses every navigation page and configured creation form in Chinese, checks visible English against an explicit technical/content allowlist, validates dynamic extraction fields, Chinese CSV content, backend validation, language persistence and mobile layout. English identifiers and deliberately marked user content must remain unchanged.

Verification results and deployed revision are recorded in PROGRESS.md. Tests use the isolated Compose database and fake provider credentials; no production business records are seeded.

Final evidence: 33 unit tests; whole Playwright suite 7/7 passed. After final month-picker/name-preservation corrections, the populated Chinese audit and completion flow passed again in 29.9s on Chromium 156.0.8078.4. All 28 nav routes and configured creation forms were visited. Native validation, structured API validation, CSV and BOM exports, English user-name preservation and 390px layout passed. Backend commercial API regression passed. Real SMTP delivery and real-provider generated prose were not exercised.
