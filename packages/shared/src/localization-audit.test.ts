import { describe, it, expect } from "vitest";
import {
  translate,
  fieldLabel,
  enumLabel,
  actionLabel,
  resourceLabel,
  formatDate,
  apiError,
  fieldNames,
} from "../../../apps/web/lib/localization.js";
import { config, groups } from "../../../apps/web/components/data.js";
import { zh } from "../../../apps/web/lib/zh.js";
describe("complete Chinese presentation contract", () => {
  it("translates every configured label, description, header and option with context", () => {
    for (const [id, c] of Object.entries(config)) {
      expect(resourceLabel(id, "zh")).toMatch(/[\u3400-\u9fff]/);
      for (const text of [
        c.title,
        c.description,
        ...c.fields.map((f) => f.label),
      ])
        expect(zh[text] || text === "SKU", text).toBeTruthy();
      for (const column of c.columns)
        expect(fieldLabel(column, "zh"), column).toMatch(/[\u3400-\u9fff]|SKU/);
      for (const f of c.fields)
        for (const option of f.options || [])
          expect(enumLabel(f.key, option, "zh"), f.key + ":" + option).toMatch(
            /[\u3400-\u9fff]|WhatsApp|CSV/,
          );
    }
    for (const g of groups) expect(zh[g.label]).toBeTruthy();
  });
  it("does not mix units and shapes or boolean display", () => {
    expect(enumLabel("profile", "sheet", "zh")).toBe("薄板");
    expect(enumLabel("unit", "sheet", "zh")).toBe("张");
    expect(enumLabel("active", true, "zh")).toBe("是");
    expect(enumLabel("material", "Stainless steel", "zh")).toBe("不锈钢");
    expect(fieldLabel("invoiceId", "zh")).toBe("发票");
    expect(fieldLabel("profile", "zh")).toBe("型材类型");
  });
  it("formats all application activity families without raw codes", () => {
    for (const action of [
      "customers.create",
      "products.update",
      "quotation.pending_approval",
      "quotation.approved",
      "document.convert.order",
      "document.convert.invoice",
      "inventory.reserve",
      "order.fulfill",
      "payment.record",
      "purchase.receive",
      "purchase.shortage",
      "project.change.approve",
      "ai.provider.create",
      "ai.key.delete",
      "membership.role",
      "import.products",
      "organization.update",
      "tax-rates.create",
      "file.delete",
      "invoice.credit",
    ])
      expect(actionLabel(action, "zh"), action).not.toMatch(/[a-z]{3}/);
  });
  it("translates placeholders once while preserving inserted user data", () => {
    expect(
      translate("Delete key {name}", "zh", { name: "Production <key> A" }),
    ).toBe("删除密钥 Production <key> A");
    expect(translate("New {resource}", "zh", { resource: "报价" })).toBe(
      "新建报价",
    );
    expect(translate("Original English customer", "zh")).toBe(
      "Original English customer",
    );
    expect(translate("New {resource}", "en", { resource: "invoice" })).toBe(
      "New invoice",
    );
  });
  it("shows actionable Chinese validation messages without parsing backend prose", () => {
    expect(
      apiError(
        {
          error: {
            issues: [
              {
                path: ["lines", 0, "quantity"],
                code: "too_small",
                origin: "number",
                minimum: 1,
              },
              { path: ["email"], code: "invalid_format", format: "email" },
            ],
          },
        },
        "zh",
        400,
      ),
    ).toBe("单据明细 · 1 · 数量：不得小于 1；邮箱：邮箱格式无效");
    expect(apiError({ message: "Invalid email or password" }, "zh", 401)).toBe(
      "邮箱或密码错误",
    );
    expect(translate("Row 2 has 3 fields; expected 4", "zh")).toBe(
      "第 2 行有 3 个字段，应有 4 个",
    );
  });
  it("provides Chinese schema field labels and explicit locale date formats", () => {
    for (const [key, label] of Object.entries(fieldNames))
      expect(zh[label] || label === "SKU", key + ":" + label).toBeTruthy();
    expect(formatDate("2026-10-29T14:00:00Z", "zh", "datetime")).not.toMatch(
      /AM|PM|Oct/,
    );
    expect(formatDate("bad-date", "zh")).toBe("—");
  });
});

import { auditSource } from "../../../scripts/i18n-audit.js";
it("audit catches prior blind spots in templates, attributes, fallback strings and dates", () => {
  const findings = auditSource(
    "fixture.tsx",
    'const x=<div><button aria-label={`Delete key ${name}`}>{value || "Not used"}</button><span>{new Date().toLocaleString()}</span><pre>{JSON.stringify(result)}</pre></div>',
  );
  expect(findings).toHaveLength(4);
  expect(
    auditSource(
      "fixture.tsx",
      'const x=<button aria-label={t("Delete key {name}",{name})}>{t("Save record")}</button>',
    ),
  ).toEqual([]);
});
import { validationMessage } from "../../../apps/web/lib/validation.js";
it("localizes native constraints while leaving English to the browser", () => {
  const validity = { valueMissing: true } as ValidityState;
  const constraints = { minLength: 12, maxLength: 100, min: "0", max: "100" };
  expect(validationMessage(validity, "zh", constraints)).toBe("请填写此字段。");
  expect(validationMessage(validity, "en", constraints)).toBe("");
  expect(
    validationMessage(
      { rangeUnderflow: true } as ValidityState,
      "zh",
      constraints,
    ),
  ).toBe("数值不得小于 0。");
});
