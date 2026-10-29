import { test, expect } from "@playwright/test";
test("imports, project change approval, cutting and drawing takeoff", async ({
  page,
}) => {
  const stamp = Date.now();
  await page.goto("");
  await page
    .getByRole("button", { name: "Create an account", exact: true })
    .click();
  await page.getByLabel("Full name").fill("Module QA");
  await page
    .getByLabel("Email address")
    .fill(`module-${stamp}@example.invalid`);
  await page
    .getByLabel("Password", { exact: true })
    .fill(`Module-${stamp}-password`);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.getByLabel("Company name").fill(`Fictional Module QA ${stamp}`);
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
  await nav("Customers");
  await page.getByRole("button", { name: "Import CSV" }).click();
  await page.getByLabel("CSV file").setInputFiles({
    name: "customers.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("name,email\nFictional CSV Client,csv@example.invalid"),
  });
  await page.getByRole("button", { name: "Confirm import (1)" }).click();
  await expect(
    page.getByRole("cell", { name: "Fictional CSV Client" }),
  ).toBeVisible();
  await nav("Projects");
  await page.getByRole("button", { name: "Create new" }).click();
  await page.getByLabel("Project name").fill("Fictional Office Fit-out");
  await page
    .getByLabel(/^Customer/)
    .selectOption({ label: "Fictional CSV Client" });
  await page.getByLabel("Budget").fill("5000");
  await page.getByRole("button", { name: "Save record" }).click();
  await page.getByRole("button", { name: "Board view" }).click();
  await expect(
    page.getByRole("button", { name: /Fictional Office Fit-out/ }),
  ).toBeVisible();
  await nav("Change orders");
  await page.getByRole("button", { name: "Create new" }).click();
  await page.getByLabel("Change title").fill("Extra shelving");
  await page
    .getByLabel(/^Project/)
    .selectOption({ label: "Fictional Office Fit-out" });
  await page.getByLabel("Budget change amount").fill("750");
  await page.getByLabel("Reason").fill("Additional agreed shelving");
  await page.getByRole("button", { name: "Save record" }).click();
  await page.getByRole("button", { name: "Open →" }).click();
  await page.getByRole("button", { name: "Approve budget change" }).click();
  await expect(page.getByText("approved", { exact: true })).toBeVisible();
  await nav("Cutting optimization");
  await page.getByRole("button", { name: "Calculate cut plan" }).click();
  await expect(
    page.getByRole("heading", { name: "Cutting instructions" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save as fabrication job" }).click();
  await expect(
    page.getByRole("button", { name: "Saved to fabrication" }),
  ).toBeDisabled();
  await nav("Drawing takeoff");
  await page.getByLabel("Takeoff name").fill("Office steel schedule");
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=",
    "base64",
  );
  await page
    .getByLabel("Drawing", { exact: true })
    .setInputFiles({ name: "drawing.png", mimeType: "image/png", buffer: png });
  await expect(
    page.getByRole("img", { name: "Drawing; select two endpoints to measure" }),
  ).toBeVisible();
  await page.getByLabel("Manual item").fill("Handrail tube");
  await page.getByLabel("Quantity", { exact: true }).fill("12");
  await page.getByRole("button", { name: "Add measurement" }).click();
  await page.getByRole("button", { name: "Save takeoff" }).click();
  await expect(
    page.getByText("Office steel schedule", { exact: true }),
  ).toBeVisible();
  await nav("AI design studio");
  await expect(
    page.getByRole("button", { name: "Create AI job" }),
  ).toBeDisabled();
  await expect(
    page.getByText("Configuration required", { exact: true }),
  ).toBeVisible();
});
