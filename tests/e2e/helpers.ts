import type { Page } from "@playwright/test";
export async function submitRegistration(page: Page, label = "Create account") {
  for (let attempt = 0; attempt < 3; attempt++) {
    const pending = page.waitForResponse(
      (r) =>
        r.url().endsWith("/auth/sign-up/email") &&
        r.request().method() === "POST",
    );
    await page.getByRole("button", { name: label, exact: true }).click();
    const response = await pending;
    if (response.status() !== 429) return;
    await page.waitForTimeout(
      Math.min(
        60,
        Math.max(1, Number(response.headers()["retry-after"]) || 11),
      ) * 1000,
    );
  }
  throw Error(
    "Registration still rate limited after bounded Retry-After waits",
  );
}
