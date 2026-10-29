import { test, expect, type Page } from "@playwright/test";
import {
  availableTransitions,
  can,
  transitionPermission,
} from "../../packages/shared/src/domain.js";

// These UI regressions use disposable API fixtures, never a production tenant.
async function workspace(page: Page, role = "OWNER") {
  const org = {
    id: "audit-org",
    name: "Audit workspace",
    currency: "USD",
    modules: [
      "sales",
      "inventory",
      "procurement",
      "fabrication",
      "finance",
      "projects",
      "takeoff",
      "ai",
    ],
  };
  const metal = {
    productId: "metal",
    description: "Audit steel",
    quantity: "10",
    unit: "piece",
    unitPrice: "5",
  };
  const records: Record<string, any[]> = {
    customers: [
      {
        id: "customer",
        name: "Fictional Customer",
        type: "BUSINESS",
        notes: "Old notes",
        tags: [],
        creditLimit: "0",
      },
    ],
    products: [
      {
        id: "metal",
        name: "Audit steel",
        sku: "AUDIT",
        unit: "piece",
        price: "5",
        cost: "3",
      },
    ],
    suppliers: [{ id: "supplier", name: "Fictional Supplier" }],
    warehouses: [
      { id: "wrong-warehouse", name: "Other warehouse" },
      { id: "reserved-warehouse", name: "Reserved warehouse" },
    ],
    projects: [
      {
        id: "project",
        name: "Audit project",
        customerId: "customer",
        status: "ACTIVE",
        budget: "500",
        dueDate: "2026-10-10T12:00:00Z",
        notes: "Old project notes",
      },
    ],
    tasks: [
      {
        id: "task",
        name: "Audit task",
        projectId: "project",
        dueDate: "2026-10-10T12:00:00Z",
        status: "TODO",
      },
    ],
    inquiries: [],
  };
  const docs: any[] = [
    {
      id: "order",
      number: "SO-AUDIT",
      kind: "ORDER",
      status: "RESERVED",
      lines: [metal],
    },
    {
      id: "short-order",
      number: "SO-SHORT",
      kind: "ORDER",
      status: "CONFIRMED",
      lines: [metal],
    },
    {
      id: "service-order",
      number: "SO-SERVICE",
      kind: "ORDER",
      status: "CONFIRMED",
      lines: [
        {
          description: "Labor",
          quantity: "1",
          unit: "custom",
          unitPrice: "20",
        },
      ],
    },
    {
      id: "purchase",
      number: "PO-AUDIT",
      kind: "PURCHASE",
      status: "APPROVED",
      supplierId: "supplier",
      lines: [
        metal,
        {
          description: "Freight",
          quantity: "1",
          unit: "custom",
          unitPrice: "12",
        },
      ],
    },
    {
      id: "invoice",
      number: "INV-AUDIT",
      kind: "INVOICE",
      status: "DRAFT",
      sourceId: "invoice-source-order",
      dueDate: null,
      lines: [metal],
    },
  ].map((d) => ({
    customerId: "customer",
    currency: "USD",
    total: "50.00",
    paid: "0",
    credited: "0",
    version: 1,
    notes: "",
    discount: "0",
    taxRate: "0",
    completed: 0,
    ...d,
  }));
  const calls: { path: string; method: string; body: any }[] = [];
  await page.addInitScript(() => {
    localStorage.setItem("metalflow.org", "audit-org");
    localStorage.setItem("metalflow.locale", "en");
  });
  await page.route("**/metalflow/api/v1/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname.split("/api/v1/")[1];
    const body = request.postDataJSON();
    calls.push({ path, method: request.method(), body });
    const send = (data: unknown, status = 200) =>
      route.fulfill({ status, json: data });
    if (path === "me")
      return send({
        user: {
          id: "user",
          name: "Audit User",
          email: "audit@example.invalid",
        },
        memberships: [{ organizationId: org.id, organization: org, role }],
        capabilities: { ai: false },
      });
    if (path === "analytics")
      return send({
        openQuotations: 0,
        pendingOrders: 3,
        conversionRate: 0,
        stockLines: 1,
        activeProjects: 1,
        newInquiries: 0,
        revenue: "0",
        receivables: "0",
        lowStock: [],
        activity: [],
        trend: [],
        aging: [],
      });
    if (path === "documents") {
      const items = docs.filter((d) => d.kind === url.searchParams.get("kind"));
      return send({ items, total: items.length });
    }
    if (path.endsWith("/purchase-shortage")) {
      const purchase = {
        ...docs[3],
        id: "short-purchase",
        number: "PO-SHORT",
        status: "DRAFT",
        sourceId: "short-order",
        lines: [metal],
      };
      docs.push(purchase);
      return send(purchase);
    }
    const doc = docs.find((d) => d.id === path.split("/")[1]);
    if (doc && path.startsWith("documents/")) {
      if (request.method() === "PATCH") Object.assign(doc, body);
      if (path.endsWith("/status")) doc.status = body.status;
      const stock = doc.lines
        .filter((l: any) => l.productId)
        .map((l: any) => ({
          ...l,
          ordered: "10",
          completed: String(doc.completed),
          remaining: String(10 - doc.completed),
          warehouseId: doc.kind === "ORDER" ? "reserved-warehouse" : null,
        }));
      return send({
        ...doc,
        stockProgress: stock,
        warehouses:
          doc.kind === "ORDER" && doc.status !== "CONFIRMED"
            ? [records.warehouses[1]]
            : records.warehouses,
        allowedTransitions: availableTransitions(doc).filter((s) =>
          can(role, transitionPermission(doc.kind, s)),
        ),
      });
    }
    if (doc && /\/(fulfill|receive|reserve)$/.test(path)) {
      if (path.endsWith("/reserve")) doc.status = "RESERVED";
      else {
        doc.completed += Number(body.lines[0].quantity);
        doc.status =
          doc.completed === 10
            ? doc.kind === "ORDER"
              ? "FULFILLED"
              : "RECEIVED"
            : doc.kind === "ORDER"
              ? "PARTIALLY_FULFILLED"
              : "PARTIALLY_RECEIVED";
      }
      return send(doc);
    }
    const [resource, id] = path.split("/");
    if (records[resource]) {
      if (request.method() === "PATCH") {
        const record = records[resource].find((r) => r.id === id);
        Object.assign(record, body);
        return send(record);
      }
      const query = (url.searchParams.get("search") || "").toLowerCase();
      const items = records[resource].filter((r) =>
        JSON.stringify(r).toLowerCase().includes(query),
      );
      return send({ items, total: items.length });
    }
    return send({ items: [], total: 0 });
  });
  return { docs, records, calls };
}

async function openRow(page: Page, number: string) {
  await page
    .getByRole("row")
    .filter({ hasText: number })
    .getByRole("button", { name: "Open →" })
    .click();
}

test("navigation retains create/search intent and dirty dialogs retain work until discard", async ({
  page,
}) => {
  await workspace(page);
  await page.goto("#dashboard");
  await page.getByRole("button", { name: "Quick create" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("textbox", { name: /^Subject/ }).fill("Keep my draft");
  for (const close of [
    () => page.getByRole("button", { name: "Close", exact: true }).click(),
    () => page.keyboard.press("Escape"),
    () => page.mouse.click(5, 5),
  ]) {
    page.once("dialog", (dialog) => dialog.dismiss());
    await close();
    await expect(page.getByRole("textbox", { name: /^Subject/ })).toHaveValue(
      "Keep my draft",
    );
  }
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.keyboard.press("Meta+k");
  await expect(page.getByRole("textbox", { name: /^Subject/ })).toHaveValue(
    "Keep my draft",
  );
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.keyboard.press("Meta+k");
  await page
    .getByPlaceholder("Search pages, customers, products, inquiries…")
    .fill("Fictional");
  await page
    .getByRole("button")
    .filter({ hasText: "Fictional Customer" })
    .click();
  await expect(page.getByRole("dialog")).toHaveAccessibleName(
    "Fictional Customer",
  );
  await expect(
    page.getByRole("textbox", { name: /^Customer name/ }),
  ).toHaveValue("Fictional Customer");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.goBack();
  await expect(page.locator("main")).toHaveAttribute("data-view", "inquiries");
});

test("converted invoice terms and shortage purchase prices can be revised", async ({
  page,
}) => {
  const { docs, calls } = await workspace(page);
  await page.goto("#invoices");
  await openRow(page, "INV-AUDIT");
  await page.getByRole("button", { name: "Edit payment terms" }).click();
  await page.getByLabel("Due date").fill("2026-01-01");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await openRow(page, "INV-AUDIT");
  await expect(page.getByText("Undated", { exact: true })).not.toBeVisible();
  expect(docs.find((d) => d.id === "invoice").dueDate).toBe(
    "2026-01-01T23:59:59.000Z",
  );
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Sales orders", exact: true }).click();
  await openRow(page, "SO-SHORT");
  await page.getByRole("button", { name: "Purchase shortage" }).click();
  await page.getByRole("button", { name: "Create purchase draft" }).click();
  await expect(page.getByRole("dialog")).toHaveAccessibleName("PO-SHORT");
  await expect(page.locator("main")).toHaveAttribute("data-view", "purchases");
  await page.getByRole("button", { name: "Edit draft" }).click();
  await page.getByLabel("Unit price", { exact: true }).fill("4.25");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const patch = calls.find(
    (call) =>
      call.path === "documents/short-purchase" && call.method === "PATCH",
  );
  expect(patch?.body.lines[0].unitPrice).toBe("4.25");
  expect(patch?.body).not.toHaveProperty("sourceId");
  expect(docs.find((d) => d.id === "short-purchase").sourceId).toBe(
    "short-order",
  );
});

test("partial stock operations reopen at six remaining and constrain reservation warehouses", async ({
  page,
}) => {
  const { docs, calls } = await workspace(page);
  for (const [view, number, kind] of [
    ["orders", "SO-AUDIT", "ORDER"],
    ["purchases", "PO-AUDIT", "PURCHASE"],
  ]) {
    await page.goto(`#${view}`);
    await openRow(page, number);
    if (kind === "ORDER") {
      await expect(page.getByLabel("Warehouse")).toHaveValue(
        "reserved-warehouse",
      );
      await expect(page.getByLabel("Warehouse").locator("option")).toHaveCount(
        1,
      );
    }
    await page.getByRole("spinbutton", { name: "Audit steel" }).fill("4");
    await page.getByRole("button", { name: "Confirm stock operation" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await openRow(page, number);
    const quantity = page.getByRole("spinbutton", { name: "Audit steel" });
    await expect(quantity).toHaveValue("6");
    await expect(quantity).toHaveAttribute("max", "6");
    await page.getByRole("button", { name: "Confirm stock operation" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    expect(docs.find((d) => d.number === number).status).toBe(
      kind === "ORDER" ? "FULFILLED" : "RECEIVED",
    );
  }
  expect(
    calls
      .filter((call) => /\/(receive|fulfill)$/.test(call.path))
      .map((call) => call.body.lines[0].quantity),
  ).toEqual(["4", "6", "4", "6"]);
});

test("cancellation explains reservation release and service orders complete without stock", async ({
  page,
}) => {
  const { docs, calls } = await workspace(page);
  await page.goto("#orders");
  await openRow(page, "SO-AUDIT");
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("reservations will be released");
    await dialog.accept();
  });
  await page.getByRole("button", { name: "Cancel document" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(docs[0].status).toBe("CANCELLED");
  await openRow(page, "SO-SERVICE");
  await expect(
    page.getByRole("button", { name: "Confirm stock operation" }),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "Complete services" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(docs.find((d) => d.id === "service-order").status).toBe("FULFILLED");
  expect(
    calls.some((call) => /\/(reserve|fulfill|receive)$/.test(call.path)),
  ).toBe(false);
});

test("cleared dates, associations and notes remain clear after reopening", async ({
  page,
}) => {
  const { records, calls } = await workspace(page);
  await page.goto("#tasks");
  await openRow(page, "Audit task");
  await page.getByLabel("Due date").fill("");
  await page
    .getByRole("combobox", { name: "Project", exact: true })
    .selectOption("");
  await page.getByRole("button", { name: "Save record" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.reload();
  await openRow(page, "Audit task");
  await expect(page.getByLabel("Due date")).toHaveValue("");
  await expect(
    page.getByRole("combobox", { name: "Project", exact: true }),
  ).toHaveValue("");
  expect(records.tasks[0]).toMatchObject({ projectId: null, dueDate: null });
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Customers", exact: true }).click();
  await openRow(page, "Fictional Customer");
  await page.getByLabel("Notes", { exact: true }).fill("");
  await page.getByRole("button", { name: "Save record" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.reload();
  await openRow(page, "Fictional Customer");
  await expect(page.getByLabel("Notes", { exact: true })).toHaveValue("");
  expect(
    calls.find((call) => call.path === "customers/customer")?.body.notes,
  ).toBe("");
});

test("search misses, empty lists, permission failures and load errors have distinct outcomes", async ({
  page,
}) => {
  await workspace(page, "VIEWER");
  await page.goto("#customers");
  await page
    .getByRole("textbox", { name: "Search records", exact: true })
    .fill("NoSuchRecord");
  await expect(
    page.getByText("No matching records", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('No records match "NoSuchRecord".'),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create record" }),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "Fictional Customer" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Inquiry inbox", exact: true })
    .click();
  await expect(page.getByText("No records yet", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create record" }),
  ).not.toBeVisible();
  await page.route("**/api/v1/customers?**", (route) =>
    route.fulfill({
      status: 403,
      json: { error: { message: "Permission denied" } },
    }),
  );
  await page.getByRole("button", { name: "Customers", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Search records", exact: true })
    .fill("blocked");
  await expect(
    page.getByRole("alert").filter({ hasText: "Permission denied" }),
  ).toBeVisible();
  await page.route("**/api/v1/customers?**", (route) =>
    route.fulfill({
      status: 500,
      json: { error: { message: "Unexpected server error" } },
    }),
  );
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Unexpected server error" }),
  ).toBeVisible();
});

test("password recovery has a neutral success state, direct return and mobile touch targets", async ({
  page,
  browser,
}) => {
  test.info().annotations.push({
    type: "browser",
    description: `${browser.browserType().name()} ${browser.version()}`,
  });
  await page.route("**/metalflow/api/v1/**", (route) =>
    route.fulfill({
      status: route.request().url().endsWith("/me") ? 401 : 200,
      json: {},
    }),
  );
  await page.goto("/metalflow");
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(
      page.getByRole("button", { name: "Sign in", exact: true }),
    ).toBeVisible();
    const sizes = await page
      .locator(".auth-form input, .auth-form button")
      .evaluateAll((elements) =>
        elements.map((element) => ({
          font: getComputedStyle(element).fontSize,
          height: element.getBoundingClientRect().height,
          input: element.tagName === "INPUT",
        })),
      );
    expect(
      sizes.every((s) =>
        s.input ? Number.parseFloat(s.font) >= 16 : s.height >= 44,
      ),
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await expect(
    page.getByText(
      "Enter your email address to request a password reset link.",
    ),
  ).toBeVisible();
  await page.getByLabel("Email address").fill("audit@example.invalid");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("status")).toContainText(
    "If email delivery is configured",
  );
  await expect(page.locator(".auth-form").getByRole("alert")).not.toBeVisible();
  await page.getByRole("button", { name: "Back to sign in" }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Change language" }).click();
  await page.getByRole("button", { name: "忘记密码？" }).click();
  await expect(page.getByRole("button", { name: "返回登录" })).toBeVisible();
});

test("mobile workspace keeps usable controls within the viewport", async ({
  page,
}) => {
  await workspace(page);
  await page.goto("#customers");
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(page.locator("main")).toHaveAttribute(
      "data-view",
      "customers",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const buttons = await page
      .locator(".header-tools button")
      .evaluateAll((elements) =>
        elements
          .filter((element) => element.getClientRects().length)
          .map((element) => element.getBoundingClientRect().height),
      );
    expect(buttons.every((height) => height >= 44)).toBe(true);
  }
  await page.getByRole("button", { name: "Create new" }).click();
  const fonts = await page
    .locator(
      '[role="dialog"] input, [role="dialog"] select, [role="dialog"] textarea',
    )
    .evaluateAll((elements) =>
      elements.map((element) =>
        Number.parseFloat(getComputedStyle(element).fontSize),
      ),
    );
  expect(fonts.every((font) => font >= 16)).toBe(true);
  await page.screenshot({
    path: test.info().outputPath("mobile-customer-form.png"),
  });
});
