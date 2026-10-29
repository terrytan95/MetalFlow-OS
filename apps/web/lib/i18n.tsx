"use client";
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { zh } from "./zh";
export type Locale = "en" | "zh";
export function translate(text: string, locale: Locale): string {
  if (locale === "en") return text;
  const exact = zh[text];
  if (exact) return exact;
  const trimmed = text.trim();
  if (zh[trimmed]) return text.replace(trimmed, zh[trimmed]);
  if (text.includes("; "))
    return text
      .split("; ")
      .map((part) => translate(part, locale))
      .join("；");
  if (text.includes(": ")) {
    const [field, ...rest] = text.split(": ");
    const tail = rest.join(": "),
      translated = translate(tail, locale);
    if (translated !== tail)
      return `${translate(field, locale)}：${translated}`;
  }
  const status =
    zh[text.toUpperCase()] || zh[text.toUpperCase().replaceAll(" ", "_")];
  if (status) return status;
  for (const [pattern, format] of patterns) {
    const match = text.match(pattern);
    if (match) return format(match);
  }
  return text;
}
const patterns: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^(\d+) inquiries to review$/, (m) => `${m[1]} 条询价待核对`],
  [/^(\d+) orders in progress$/, (m) => `${m[1]} 份订单处理中`],
  [/^(\d+) active projects$/, (m) => `${m[1]} 个进行中项目`],
  [
    /^New (.+)$/i,
    (m) =>
      `新建${translate(
        m[1].replace(/^./, (s) => s.toUpperCase()),
        "zh",
      )}`,
  ],
  [
    /^Import (.+)$/i,
    (m) =>
      `导入${translate(
        m[1].replace(/^./, (s) => s.toUpperCase()),
        "zh",
      )}`,
  ],
  [/^Confirm import \((\d+)\)$/, (m) => `确认导入（${m[1]} 行）`],
  [/^Add API key · (.+)$/, (m) => `添加 API 密钥 · ${m[1]}`],
  [/^Delete key (.+)$/, (m) => `删除密钥 ${m[1]}`],
  [/^Role for (.+)$/, (m) => `${m[1]} 的角色`],
  [/^Verify (.+)$/, (m) => `核对 ${m[1]}`],
  [
    /^(.+): Invalid input: expected (.+), received (.+)$/,
    (m) => `${translate(m[1], "zh")}：输入类型无效（需要 ${m[2]}）`,
  ],
  [
    /^(.+): Too small: expected (.+) to have >=(\d+) characters$/,
    (m) => `${translate(m[1], "zh")}：至少需要 ${m[3]} 个字符`,
  ],
  [
    /^(.+): Invalid string: must match pattern .+$/,
    (m) => `${translate(m[1], "zh")}：格式无效`,
  ],
  [/^Request failed \((\d+)\)$/, (m) => `请求失败（${m[1]}）`],
  [/^Invitation link: (.+)$/, (m) => `邀请链接：${m[1]}`],
];

const Context = createContext({
  locale: "en" as Locale,
  setLocale: (_value: Locale) => {},
  t: (text: string) => text,
});
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setState] = useState<Locale>("en");
  useEffect(() => {
    try {
      setState(localStorage.getItem("metalflow.locale") === "zh" ? "zh" : "en");
    } catch {}
  }, []);
  const setLocale = useCallback((value: Locale) => {
    setState(value);
    try {
      localStorage.setItem("metalflow.locale", value);
    } catch {}
    document.documentElement.lang = value === "zh" ? "zh-CN" : "en";
  }, []);
  const t = useCallback((text: string) => translate(text, locale), [locale]);
  return (
    <Context.Provider value={{ locale, setLocale, t }}>
      {children}
    </Context.Provider>
  );
}
export function useI18n() {
  return useContext(Context);
}
