import { test, expect } from "@playwright/test";
test("business onboarding, customer inquiry, quote, order, stock and payment", async ({
  page,
}) => {
  const stamp = Date.now(),
    email = `e2e-${stamp}@example.invalid`;
  const errors: string[] = [];
  page.on("pageerror", (e) => {
    errors.push(e.message);
    console.log("PAGE ERROR:", e.message);
  });
  await page.goto("");
  await page
    .getByRole("button", { name: "Create an account", exact: true })
    .click();
  await page.getByLabel("Full name").fill("E2E Operator");
  await page.getByLabel("Email address").fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill(`E2E-${stamp}-strong-password`);
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = page.waitForResponse(
      (r) =>
        r.url().endsWith("/auth/sign-up/email") &&
        r.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Create account", exact: true })
      .click();
    const result = await response;
    if (result.status() !== 429) break;
    const seconds = Math.min(
      60,
      Math.max(1, Number(result.headers()["retry-after"]) || 11),
    );
    await page.waitForTimeout(seconds * 1000);
  }
  await expect(
    page.getByRole("heading", { name: "Make it your workspace." }),
  ).toBeVisible();
  await page.getByLabel("Company name").fill(`Fictional E2E Metals ${stamp}`);
  await page
    .getByRole("button", { name: "Create workspace", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Operations overview" }),
  ).toBeVisible();
  const navigate = async (name: string) =>
    page
      .getByRole("navigation")
      .getByRole("button", { name, exact: true })
      .click();
  await navigate("Customers");
  await page.getByRole("button", { name: "Create new" }).click();
  await page.getByLabel("Customer name").fill("Fictional Harbor Interiors");
  await page
    .getByLabel("Email", { exact: true })
    .fill("fictional@example.invalid");
  await page.getByRole("button", { name: "Save record" }).click();
  await expect(
    page.getByRole("cell", { name: "Fictional Harbor Interiors" }),
  ).toBeVisible();
  await navigate("Product catalog");
  await page.getByRole("button", { name: "Create new" }).click();
  await page.getByLabel("SKU").fill(`SS304-${stamp}`);
  await page.getByLabel("Product name").fill("SS304 square tube 40×40×2");
  await page.getByLabel("Selling price").fill("48");
  await page.getByLabel("Unit cost").fill("30");
  await page.getByRole("button", { name: "Save record" }).click();
  await expect(
    page.getByRole("cell", { name: "SS304 square tube 40×40×2" }),
  ).toBeVisible();
  await navigate("Inventory");
  await page.getByRole("button", { name: "Adjust stock" }).click();
  await page.getByLabel("Quantity change").fill("100");
  await page.getByLabel("Reason").fill("Opening QA inventory");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "100", exact: true }).first(),
  ).toBeVisible();
  await navigate("Inquiry inbox");
  await page.getByRole("button", { name: "Create new" }).click();
  await page.getByLabel("Subject").fill("Lobby handrail requirement");
  await page
    .getByLabel(/^Customer/)
    .selectOption({ label: "Fictional Harbor Interiors" });
  await page
    .getByLabel("Original inquiry")
    .fill("Need 10 pieces SS304 square tube 40x40x2mm, 6m length.");
  await page.getByRole("button", { name: "Save record" }).click();
  await page.getByRole("button", { name: "Open →" }).first().click();
  await page.getByRole("button", { name: "Create quotation" }).click();
  await page
    .getByLabel("Catalog product")
    .selectOption({ label: `SS304-${stamp} · SS304 square tube 40×40×2` });
  await page.getByLabel("Quantity", { exact: true }).fill("10");
  await page.getByRole("button", { name: "Save draft" }).click();
  for (const action of ["Pending approval", "Approved", "Sent", "Accepted"]) {
    await page.getByRole("button", { name: "Open →" }).first().click();
    await page.getByRole("button", { name: action, exact: true }).click();
  }
  await page.getByRole("button", { name: "Open →" }).first().click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).click();
  const pdf = await downloadPromise;
  expect(pdf.suggestedFilename()).toMatch(/\.pdf$/);
  await page.getByRole("button", { name: "Convert to sales order" }).click();
  await navigate("Sales orders");
  await page.getByRole("button", { name: "Open →" }).first().click();
  await page.getByRole("button", { name: "Confirm order" }).click();
  await page.getByRole("button", { name: "Open →" }).first().click();
  await page.getByRole("button", { name: "Confirm stock operation" }).click();
  await page.getByRole("button", { name: "Open →" }).first().click();
  await page.getByRole("button", { name: "Create invoice" }).click();
  await navigate("Invoices");
  await page.getByRole("button", { name: "Open →" }).first().click();
  await page.getByRole("button", { name: "Issue invoice" }).click();
  await page.getByRole("button", { name: "Open →" }).first().click();
  await page.getByLabel("Amount", { exact: true }).fill("480");
  await page.getByLabel("Bank reference").fill("E2E payment");
  await page.getByRole("button", { name: "Confirm payment" }).click();
  await expect(page.getByText("paid", { exact: true })).toBeVisible();
  await navigate("Overview");
  await expect(
    page.getByText("$480.00", { exact: true }).first(),
  ).toBeVisible();
  await page.screenshot({
    path: "tests/e2e/evidence/dashboard-light.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Toggle theme" }).click();
  await page.screenshot({
    path: "tests/e2e/evidence/dashboard-dark.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Change language" }).click();
  await expect(page.getByRole("heading", { name: "经营概览" })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.getByRole("navigation")).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "客户", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "客户", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".mobile-backdrop")).toHaveCount(0);
  await expect(
    page.getByRole("cell", { name: "Fictional Harbor Interiors" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator(".sidebar")
        .evaluate((el) => el.getBoundingClientRect().right),
    )
    .toBeLessThanOrEqual(1);
  await page.screenshot({
    path: "tests/e2e/evidence/mobile-customers.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
