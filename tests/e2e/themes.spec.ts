import { submitRegistration } from "./helpers.js";
import { test, expect } from "@playwright/test";
import { palettes } from "../../apps/web/components/themes.js";
test("all Morandi palettes support both modes, readable contrast and persistence", async ({
  page,
}) => {
  const stamp = Date.now();
  await page.goto("");
  await page
    .getByRole("button", { name: "Create an account", exact: true })
    .click();
  await page.getByLabel("Full name").fill("Theme QA");
  await page.getByLabel("Email address").fill(`theme-${stamp}@example.invalid`);
  await page
    .getByLabel("Password", { exact: true })
    .fill(`Theme-${stamp}-password`);
  await submitRegistration(page);
  await page.getByLabel("Company name").fill(`Fictional Theme QA ${stamp}`);
  await page
    .getByRole("button", { name: "Create workspace", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Operations overview" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Color themes" }).click();
  for (const mode of ["Light", "Dark"]) {
    await page.getByRole("button", { name: mode, exact: true }).click();
    for (const palette of palettes) {
      await page.getByRole("radio", { name: palette.en, exact: true }).check();
      await expect(page.locator("html")).toHaveAttribute(
        "data-palette",
        palette.id,
      );
      await expect(page.locator("html")).toHaveAttribute(
        "data-theme",
        mode.toLowerCase(),
      );
      const contrast = await page.evaluate(() => {
        const css = getComputedStyle(document.documentElement);
        const lum = (hex: string) => {
          const values = hex.trim().replace("#", "");
          const h =
            values.length === 3
              ? values
                  .split("")
                  .map((c) => c + c)
                  .join("")
              : values;
          const rgb = [0, 2, 4]
            .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
            .map((v) =>
              v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
            );
          return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
        };
        const ratio = (a: string, b: string) => {
          const x = lum(css.getPropertyValue(a)),
            y = lum(css.getPropertyValue(b));
          return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
        };
        return {
          body: ratio("--text", "--surface"),
          muted: ratio("--muted", "--surface"),
          button: ratio("--on-accent", "--accent"),
        };
      });
      expect(
        contrast.body,
        `${palette.id}/${mode} text`,
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrast.muted,
        `${palette.id}/${mode} muted`,
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrast.button,
        `${palette.id}/${mode} button`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  }
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-palette", "mono");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({
    path: "tests/e2e/evidence/monochrome-dark.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Color themes" }).click();
  await page.getByRole("button", { name: "Light", exact: true }).click();
  await page.getByRole("radio", { name: "Dusty rose", exact: true }).check();
  await page.screenshot({
    path: "tests/e2e/evidence/morandi-palette-picker.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
