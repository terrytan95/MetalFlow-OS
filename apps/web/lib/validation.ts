import type { Locale } from "./localization.ts";
export function validationMessage(
  validity: ValidityState,
  locale: Locale,
  constraints: {
    minLength: number;
    maxLength: number;
    min: string;
    max: string;
  },
): string {
  if (locale !== "zh") return "";
  if (validity.valueMissing) return "请填写此字段。";
  if (validity.typeMismatch) return "请输入有效的格式。";
  if (validity.tooShort) return `至少需要 ${constraints.minLength} 个字符。`;
  if (validity.tooLong) return `最多允许 ${constraints.maxLength} 个字符。`;
  if (validity.rangeUnderflow) return `数值不得小于 ${constraints.min}。`;
  if (validity.rangeOverflow) return `数值不得大于 ${constraints.max}。`;
  if (validity.badInput) return "请输入有效的数值。";
  if (validity.stepMismatch) return "请输入符合指定步长的数值。";
  if (validity.patternMismatch) return "输入格式无效。";
  return "";
}
