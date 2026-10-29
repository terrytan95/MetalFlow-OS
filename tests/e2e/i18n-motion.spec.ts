import { submitRegistration } from "./helpers.js";
import { test, expect } from "@playwright/test";
test("Chinese forms, errors, locale persistence, motion and bounded query refresh", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("");
  await page.getByRole("button", { name: "Change language" }).click();
  await expect(page.getByRole("heading", { name: "欢迎回来" })).toBeVisible();
  await page.getByRole("button", { name: "注册账户", exact: true }).click();
  await page.getByLabel("姓名", { exact: true }).fill("中文测试用户");
  await page.getByLabel("邮箱地址").fill(`zh-${Date.now()}@example.invalid`);
  await page
    .getByLabel("密码", { exact: true })
    .fill("Chinese-QA-strong-password");
  await submitRegistration(page, "创建账户");
  await page.getByLabel("公司名称").fill("虚构中文经营公司");
  await page.getByRole("button", { name: "创建工作区", exact: true }).click();
  await expect(page.getByRole("heading", { name: "经营概览" })).toBeVisible();
  const nav = async (name: string) =>
    page
      .getByRole("navigation")
      .getByRole("button", { name, exact: true })
      .click();
  await nav("客户");
  await page.getByRole("button", { name: "新建", exact: true }).click();
  await page.getByLabel("客户名称").fill("中文客户");
  await page.getByRole("button", { name: "保存记录" }).click();
  await expect(page.getByRole("cell", { name: "中文客户" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "客户", exact: true }),
  ).toBeVisible();
  await nav("税率");
  await page.getByRole("button", { name: "新建", exact: true }).click();
  await page.getByLabel("税目名称").fill("服务税");
  await page.getByLabel("税率（%）").fill("6");
  await page.getByRole("button", { name: "保存记录" }).click();
  await expect(page.getByRole("cell", { name: "服务税" })).toBeVisible();
  await nav("AI 助手");
  await expect(
    page.getByRole("heading", { name: "咨询业务助手" }),
  ).toBeVisible();
  await expect(page.getByText("需要配置", { exact: true })).toBeVisible();
  await nav("设置与集成");
  await expect(
    page.getByRole("heading", { name: "AI 服务与密钥" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "添加服务商", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "添加 AI 服务商" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", /zh/);
  await expect(page.getByRole("heading", { name: "组织设置" })).toBeVisible();
  await page.screenshot({
    path: "tests/e2e/evidence/chinese-settings.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "切换语言" }).click();
  await expect(
    page.getByRole("heading", { name: "Organization settings" }),
  ).toBeVisible();
  let meRequests = 0;
  page.on("request", (r) => {
    if (r.url().endsWith("/api/v1/me")) meRequests++;
  });
  await nav("Customers");
  await page.getByRole("button", { name: "Create new", exact: true }).click();
  await page.getByLabel("Customer name").fill("Second QA customer");
  await page.getByRole("button", { name: "Save record" }).click();
  await expect(
    page.getByRole("cell", { name: "Second QA customer" }),
  ).toBeVisible();
  expect(meRequests).toBe(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await nav("Projects");
  expect(
    await page.locator("main").evaluate((el) => el.getAnimations().length),
  ).toBe(0);
  await page.getByRole("button", { name: "Create new" }).click();
  expect(
    await page
      .getByRole("dialog")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.screenshot({
    path: "tests/e2e/evidence/bilingual-workspace.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
