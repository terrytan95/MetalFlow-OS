export function authEmailCopy(
  kind: "reset" | "verify",
  url: string,
  language?: string | null,
) {
  const chinese = language?.toLowerCase().startsWith("zh");
  const subject = chinese
    ? kind === "reset"
      ? "重置 MetalFlow 密码"
      : "验证 MetalFlow 邮箱"
    : kind === "reset"
      ? "Reset your MetalFlow password"
      : "Verify your MetalFlow email";
  return {
    subject,
    text: `${subject}\n${url}\n${chinese ? "如非本人操作，请忽略此邮件。" : "If you did not request this, ignore this email."}`,
  };
}
