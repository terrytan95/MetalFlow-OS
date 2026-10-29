import { submitRegistration } from "./helpers.js";
import { test, expect } from "@playwright/test";
test("organization admin configures providers and rotates multiple masked keys", async ({
  page,
}) => {
  const stamp = Date.now();
  await page.goto("");
  await page
    .getByRole("button", { name: "Create an account", exact: true })
    .click();
  await page.getByLabel("Full name").fill("AI Settings QA");
  await page.getByLabel("Email address").fill(`ai-ui-${stamp}@example.invalid`);
  await page
    .getByLabel("Password", { exact: true })
    .fill(`AI-settings-${stamp}-password`);
  await submitRegistration(page);
  await page.getByLabel("Company name").fill(`Fictional AI Settings ${stamp}`);
  await page
    .getByRole("button", { name: "Create workspace", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Operations overview" }),
  ).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Settings & integrations", exact: true })
    .click();
  await page.getByRole("button", { name: "Add provider", exact: true }).click();
  await page
    .getByLabel("Provider name", { exact: true })
    .fill("OpenAI production");
  await page
    .getByLabel("Text model ID", { exact: true })
    .fill("operator-configured-model");
  await page
    .getByRole("button", { name: "Save provider", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: /^OpenAI production/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add provider", exact: true }).click();
  await page
    .getByLabel("Provider name", { exact: true })
    .fill("Synthetic compatible provider");
  await page
    .getByRole("combobox", { name: "Provider type", exact: true })
    .selectOption("COMPATIBLE");
  await page
    .getByLabel("Base URL", { exact: true })
    .fill("http://ai-mock:8080/v1");
  await page.getByLabel("Text model ID", { exact: true }).fill("mock-chat");
  await page
    .getByRole("button", { name: "Save provider", exact: true })
    .click();
  const card = page.locator(".provider-card").filter({
    has: page.getByRole("heading", { name: /Synthetic compatible provider/ }),
  });
  for (const [label, key] of [
    ["Limited key", `test-rate-${stamp}-synthetic-only`],
    ["Working key", `test-good-${stamp}-synthetic-only`],
  ]) {
    await card
      .getByRole("button", { name: "Add API key", exact: true })
      .click();
    await page.getByLabel("Key label", { exact: true }).fill(label);
    await page.getByLabel("API key", { exact: true }).fill(key);
    await page.getByLabel("Daily request limit (optional)").fill("20");
    await page
      .getByRole("button", { name: "Save API key", exact: true })
      .click();
    await expect(card.getByText(label, { exact: true })).toBeVisible();
    expect(await page.locator("body").innerText()).not.toContain(key);
  }
  const good = card.getByRole("row").filter({ hasText: "Working key" });
  await good.getByRole("button", { name: "Edit limits", exact: true }).click();
  await page.getByLabel("Daily request limit", { exact: true }).fill("25");
  await page.getByRole("button", { name: "Save limits", exact: true }).click();
  await expect(good.getByText("25 requests", { exact: false })).toBeVisible();
  await card
    .getByRole("button", { name: "Run test request", exact: true })
    .click();
  await expect(
    card.getByRole("cell").filter({ hasText: /RATE_LIMITED/ }),
  ).toBeVisible({
    timeout: 25000,
  });
  await expect(
    good.getByRole("cell").filter({ hasText: /Success/ }),
  ).toBeVisible({
    timeout: 25000,
  });
  await good.getByRole("button", { name: "Disable", exact: true }).click();
  await expect(good.getByText("disabled", { exact: true })).toBeVisible();
  await good.getByRole("button", { name: "Enable", exact: true }).click();
  await expect(good.getByText("ready", { exact: true })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "tests/e2e/evidence/ai-provider-settings.png",
    fullPage: true,
  });
  await page.reload();
  await expect(page.getByText("Working key", { exact: true })).toBeVisible();
  await card.getByRole("button", { name: "Delete key Limited key" }).click();
  await page
    .getByRole("button", { name: "Delete stored key", exact: true })
    .click();
  await expect(card.getByText("Limited key", { exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
