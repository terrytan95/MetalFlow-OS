import { submitRegistration } from "./helpers.js";
import { test, expect } from "@playwright/test";
test("profile, tax rates, calendar and credit notes complete operational flows", async ({
  page,
}) => {
  const stamp = Date.now();
  await page.goto("");
  await page
    .getByRole("button", { name: "Create an account", exact: true })
    .click();
  await page.getByLabel("Full name").fill("Completion QA");
  await page
    .getByLabel("Email address")
    .fill(`complete-${stamp}@example.invalid`);
  await page
    .getByLabel("Password", { exact: true })
    .fill(`Complete-${stamp}-password`);
  await submitRegistration(page);
  await page.getByLabel("Company name").fill(`Completion Company ${stamp}`);
  await page
    .getByRole("button", { name: "Create workspace", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Operations overview" }),
  ).toBeVisible();
  const nav = async (name: string) =>
    page
      .getByRole("navigation")
      .getByRole("button", { name, exact: true })
      .click();
  await page
    .getByRole("button", { name: "Completion QA", exact: true })
    .click();
  await page.getByLabel("Display name").fill("Updated Operator");
  await page.getByRole("button", { name: "Update profile" }).click();
  await expect(
    page.getByRole("button", { name: "Updated Operator" }),
  ).toBeVisible();
  await nav("Customers");
  await page.getByRole("button", { name: "Create new" }).click();
  await page.getByLabel("Customer name").fill("Flow customer");
  await page.getByRole("button", { name: "Save record" }).click();
  await expect(page.getByRole("cell", { name: "Flow customer" })).toBeVisible();
  await nav("Tax rates");
  await page.getByRole("button", { name: "Create new" }).click();
  await page.getByLabel("Tax name").fill("VAT QA");
  await page.getByLabel("Rate (%)").fill("10");
  await page.getByRole("button", { name: "Save record" }).click();
  await expect(page.getByRole("cell", { name: "VAT QA" })).toBeVisible();
  await nav("Invoices");
  await page.getByRole("button", { name: "Create new" }).click();
  await page
    .getByRole("combobox", { name: "Customer", exact: true })
    .selectOption({ label: "Flow customer" });
  await page.getByLabel("Description", { exact: true }).fill("Service");
  await page.getByLabel("Unit price").fill("100");
  await page
    .getByRole("combobox", { name: "Tax rates", exact: true })
    .selectOption({ label: "VAT QA · 10%" });
  await page.getByRole("button", { name: "Save draft" }).click();
  await page.getByRole("button", { name: "Open →" }).click();
  await page
    .getByRole("button", { name: "Issue invoice", exact: true })
    .click();
  await page.getByRole("button", { name: "Open →" }).click();
  await page
    .getByRole("button", { name: "Issue credit note", exact: true })
    .click();
  await page.getByLabel("Credit amount").fill("22");
  await page.getByLabel("Credit reason").fill("Agreed discount");
  await page
    .getByRole("button", { name: "Issue credit note", exact: true })
    .click();
  await nav("Credit notes");
  await expect(
    page.getByRole("cell", { name: "Agreed discount" }),
  ).toBeVisible();
  await nav("Tasks & approvals");
  await page.getByRole("button", { name: "Create new" }).click();
  await page.getByLabel("Task name").fill("Measure site");
  await page.getByLabel("Due date").fill(new Date().toISOString().slice(0, 10));
  await page.getByRole("button", { name: "Save record" }).click();
  await page.getByRole("button", { name: "Calendar view" }).click();
  await expect(
    page.getByRole("button", { name: /Measure site/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Timeline view" }).click();
  await expect(
    page.getByRole("button", { name: /Measure site/ }),
  ).toBeVisible();
  await page.getByLabel("Select workspace").selectOption("new");
  await page.getByLabel("Company name").fill("Second workspace");
  await page.getByRole("button", { name: "Create workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Make it your workspace." }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Select workspace")).toContainText(
    "Second workspace",
  );
});
