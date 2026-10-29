import { test, expect, type Page } from "@playwright/test";
import { submitRegistration } from "./helpers.js";
import { groups, config } from "../../apps/web/components/data.js";
const technical = new Set([
  "MetalFlow",
  "METALFLOW",
  "CSV",
  "PDF",
  "PNG",
  "JPEG",
  "WebP",
  "DWG",
  "DXF",
  "OpenAI",
  "Responses",
  "Chat",
  "Completions",
  "UTC",
  "USD",
  "CNY",
  "EUR",
  "GBP",
  "SGD",
  "MYR",
  "AUD",
  "CAD",
  "HKD",
  "API",
  "Key",
  "SKU",
  "JSON",
  "SMTP",
  "token",
  "tokens",
  "KEY",
  "AI_KEY_ENCRYPTION_KEY",
  "SS304",
  "EXAMPLE",
]);
async function englishLeaks(page: Page) {
  const text = await page.evaluate(() => {
    const values: string[] = [];
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      const parent = n.parentElement;
      if (
        !parent ||
        parent.closest('script,style,pre[data-format="csv"]') ||
        !parent.getClientRects().length ||
        parent.closest('[aria-hidden="true"],[inert]')
      )
        continue;
      const v = n.textContent?.trim();
      if (v) values.push(v);
    }
    return values;
  });
  return text.flatMap((line) => {
    if (
      /KEEP_|example\.invalid|^https?:|^(?:INV|QT|SO|PO)-[A-Z0-9-]+$|^[a-f\d-]{8,}$/i.test(
        line,
      )
    )
      return [];
    return (line.match(/\b[A-Za-z][A-Za-z_]{2,}\b/g) || [])
      .filter((word) => !technical.has(word))
      .map((word) => `${word}: ${line}`);
  });
}
test("all Chinese modules, populated records, modals, errors and exports", async ({
  page,
  browser,
}) => {
  console.log("Browser acceptance:", browser.version(), page.viewportSize());
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("");
  await page
    .getByRole("button", { name: "Create an account", exact: true })
    .click();
  await page.getByLabel("Full name").fill("中文核查员");
  await page
    .getByLabel("Email address")
    .fill(`zh-full-${Date.now()}@example.invalid`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Chinese-full-audit-password");
  await submitRegistration(page);
  await page.getByLabel("Company name").fill("中文完整性核查组织");
  await page
    .getByRole("button", { name: "Create workspace", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Operations overview" }),
  ).toBeVisible();
  const org = await page.evaluate(() => localStorage.getItem("metalflow.org")!);
  const origin = new URL(page.url()).origin;
  const api = async (path: string, body?: unknown) => {
    const response = await page.request.fetch(
      `${origin}/metalflow/api/v1/${path}`,
      {
        method: body ? "POST" : "GET",
        headers: { Origin: origin, "x-organization-id": org },
        ...(body ? { data: body } : {}),
      },
    );
    expect(response.ok(), `${path}: ${await response.text()}`).toBeTruthy();
    return response.json();
  };
  const customer = await api("customers", {
    name: "KEEP_Customer",
    email: "keep@example.invalid",
  });
  const supplier = await api("suppliers", { name: "KEEP_Supplier" });
  const product = await api("products", {
    sku: "KEEP_SKU",
    name: "KEEP_Product",
    material: "Stainless steel",
    profile: "sheet",
    unit: "sheet",
    price: "20",
    cost: "10",
  });
  const warehouse = (await api("warehouses")).items[0];
  await api("inventory/adjust", {
    productId: product.id,
    warehouseId: warehouse.id,
    quantity: "30",
    reason: "KEEP_Opening",
    idempotencyKey: crypto.randomUUID(),
  });
  await api("inquiries", {
    customerId: customer.id,
    subject: "KEEP_Inquiry",
    text: "KEEP_Original request",
    extraction: {
      material: "Stainless steel",
      grade: "304",
      profile: "square tube",
      widthMm: 40,
      heightMm: 40,
      thicknessMm: 2,
      lengthMm: 6000,
      quantity: 100,
      unit: "piece",
      missing: ["KEEP_Delivery date"],
      uncertainties: [],
    },
  });
  const lines = [
    {
      productId: product.id,
      description: "KEEP_Line",
      quantity: "2",
      unit: "sheet",
      unitPrice: "20",
    },
  ];
  await api("documents", { kind: "QUOTATION", customerId: customer.id, lines });
  await api("documents", { kind: "ORDER", customerId: customer.id, lines });
  await api("documents", { kind: "PURCHASE", supplierId: supplier.id, lines });
  const invoice = await api("documents", {
    kind: "INVOICE",
    customerId: customer.id,
    lines,
  });
  await api(`documents/${invoice.id}/status`, { status: "ISSUED" });
  await api("payments", {
    invoiceId: invoice.id,
    amount: "5",
    reference: "KEEP_Payment",
    method: "BANK",
    idempotencyKey: crypto.randomUUID(),
  });
  await api("credit-notes", {
    invoiceId: invoice.id,
    amount: "2",
    reason: "KEEP_Credit note",
    idempotencyKey: crypto.randomUUID(),
  });
  await api("tax-rates", { name: "KEEP_Tax", rate: "6" });
  const project = await api("projects", {
    name: "KEEP_Project",
    customerId: customer.id,
    budget: "1000",
    status: "ACTIVE",
  });
  await api("tasks", {
    name: "KEEP_Task",
    projectId: project.id,
    dueDate: new Date().toISOString(),
  });
  await api("expenses", {
    name: "KEEP_Expense",
    category: "Materials",
    amount: "10",
    date: new Date().toISOString(),
    projectId: project.id,
  });
  await api("change-orders", {
    name: "KEEP_Change",
    projectId: project.id,
    reason: "KEEP_Reason",
    amount: "10",
  });
  await api("fabrication", { name: "KEEP_Fabrication" });
  await api("takeoffs", {
    name: "KEEP_Takeoff",
    measurements: [
      {
        label: "KEEP_Rail",
        quantity: "2",
        unit: "m",
        source: "USER",
        verified: true,
      },
    ],
  });
  const provider = await api("ai/providers", {
    name: "KEEP_Provider",
    type: "COMPATIBLE",
    protocol: "RESPONSES",
    baseUrl: "http://ai-mock:8080/v1",
    textModel: "KEEP_Model",
  });
  await api(`ai/providers/${provider.id}/keys`, {
    label: "KEEP_Key",
    apiKey: "test-good-chinese-fixture-synthetic-only",
  });
  await api("ai/jobs", {
    kind: "INQUIRY",
    providerId: provider.id,
    text: "Need 100 pcs SS304 square tube 40x40x2mm, 6m.",
  });
  await expect
    .poll(async () => (await api("ai/jobs")).items[0]?.status)
    .toBe("SUCCEEDED");
  await page.getByRole("button", { name: "Change language" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  const detected: Record<string, string[]> = {};
  for (const [view, , title] of groups.flatMap((g) => g.items)) {
    await page
      .getByRole("navigation")
      .getByRole("button", { name: title, exact: true })
      .click();
    await expect(page.locator("main")).toHaveAttribute("data-view", view);
    await expect(page.locator("main .skeleton")).toHaveCount(0);
    if (view === "cutting") {
      await page.getByRole("button", { name: "计算切割方案" }).click();
      await expect(
        page.getByRole("heading", { name: "切割作业单" }),
      ).toBeVisible();
    }
    const leaks = await englishLeaks(page);
    if (leaks.length) {
      detected[view] = leaks;
      console.log("I18N LEAK", view, leaks);
    }

    if (view === "takeoffs") {
      const downloadPromise = page.waitForEvent("download");
      await page.getByRole("button", { name: "导出物料清单" }).click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toBe("算量物料清单.csv");
      const fs = await import("node:fs/promises");
      const csv = await fs.readFile((await download.path())!, "utf8");
      expect(csv).toContain("数量");
      expect(csv).toContain("手工输入");
      expect(csv).toContain("KEEP_Rail");
      expect(csv.charCodeAt(0)).toBe(0xfeff);
    }
    if (view === "tasks") {
      await page.getByRole("button", { name: "日历视图", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "项目排期" }),
      ).toBeVisible();
      const chosenMonth = await page
        .getByRole("combobox", { name: "月份" })
        .locator("option:checked")
        .innerText();
      expect(chosenMonth).toMatch(/月$/);
      expect(await englishLeaks(page)).toEqual([]);
      await page.getByRole("button", { name: "表格视图", exact: true }).click();
    }
    if (view === "assistant") {
      await expect(
        page.getByText("宽度（毫米）", { exact: true }),
      ).toBeVisible();
      await expect(page.getByText("询价提取", { exact: true })).toBeVisible();
    }
    if (config[view]) {
      await page
        .getByRole("button", {
          name: view === "inventory" ? "调整库存" : "新建",
          exact: true,
        })
        .click();
      await expect(page.getByRole("dialog")).toBeVisible();
      expect(await englishLeaks(page), view + " form").toEqual([]);
      if (view === "products") {
        const profile = page.getByLabel("型材类型");
        await expect(
          profile.getByRole("option", { name: "薄板", exact: true }),
        ).toHaveAttribute("value", "sheet");
        const unit = page.getByLabel("库存／计价单位");
        await expect(
          unit.getByRole("option", { name: "张", exact: true }),
        ).toHaveAttribute("value", "sheet");
      }
      if (view === "products") {
        const price = page.getByLabel("销售单价", { exact: false });
        await price.fill("-1");
        await price.evaluate((el: HTMLInputElement) => el.reportValidity());
        expect(
          await price.evaluate((el: HTMLInputElement) => el.validationMessage),
        ).toContain("不得小于");
        await price.fill("20");
        expect(
          await price.evaluate((el: HTMLInputElement) => el.validationMessage),
        ).toBe("");
      }
      await page.getByRole("button", { name: "关闭", exact: true }).click();
    }
  }
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "询价收件箱", exact: true })
    .click();
  await page.getByRole("button", { name: "查看 →" }).first().click();
  await expect(page.getByText("宽度（毫米）", { exact: true })).toBeVisible();
  await expect(
    page.getByText("KEEP_Original request", { exact: true }),
  ).toBeVisible();
  expect(await englishLeaks(page)).toEqual([]);
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "库存流水", exact: true })
    .click();
  await expect(
    page.getByRole("cell", { name: "库存调整", exact: true }),
  ).toBeVisible();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出当前页" }).click();
  const csv = await downloaded;
  expect(csv.suggestedFilename()).toContain("库存流水");
  const fs = await import("node:fs/promises");
  const csvText = await fs.readFile((await csv.path())!, "utf8");
  expect(csvText).toContain("数量");
  expect(csvText).toContain("库存调整");
  expect(csvText).toContain("KEEP_Opening");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "客户", exact: true })
    .click();
  await page.getByRole("button", { name: "新建", exact: true }).click();
  await page.getByLabel("客户名称").fill("KEEP_Invalid");
  await page.getByLabel("信用额度").fill("10000000000000");
  await page.getByRole("button", { name: "保存记录" }).click();
  await expect(page.getByRole("alert")).toContainText("格式无效");
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.getByRole("button", { name: "活动通知" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await englishLeaks(page)).toEqual([]);
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "审计日志", exact: true })
    .click();
  await page.screenshot({
    path: "tests/e2e/evidence/chinese-populated-audit.png",
    fullPage: true,
  });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "打开导航" }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "产品目录", exact: true })
    .click();
  await expect(page.locator(".mobile-backdrop")).toHaveCount(0);
  await expect(page.getByRole("cell", { name: "KEEP_Product" })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "tests/e2e/evidence/chinese-mobile-products.png",
    fullPage: true,
  });
  const literalCustomer = await api("customers", { name: "Total" });
  expect(literalCustomer.name).toBe("Total");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "客户", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "搜索记录", exact: true })
    .fill("Total");
  await page
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: "Total", exact: true }) })
    .getByRole("button", { name: "查看 →" })
    .click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("heading", { name: "Total", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  expect(detected).toEqual({});
  expect(errors).toEqual([]);
});
