import { it, expect } from "vitest";
import { authEmailCopy } from "./auth-copy.js";
it("uses request language for account messages without altering the secure link", () => {
  const url = "https://example.invalid/reset?token=unchanged";
  expect(authEmailCopy("reset", url, "zh-CN")).toEqual({
    subject: "重置 MetalFlow 密码",
    text: `重置 MetalFlow 密码\n${url}\n如非本人操作，请忽略此邮件。`,
  });
  expect(authEmailCopy("verify", url, "en-US").subject).toBe(
    "Verify your MetalFlow email",
  );
});
