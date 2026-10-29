"use client";
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { translate, type Locale, type Values } from "./localization";
import { validationMessage } from "./validation";
export { translate };
export type { Locale };
const Context = createContext({
  locale: "en" as Locale,
  setLocale: (_value: Locale) => {},
  t: (text: string, _values?: Values) => text,
});
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setState] = useState<Locale>("en");
  useEffect(() => {
    try {
      setState(localStorage.getItem("metalflow.locale") === "zh" ? "zh" : "en");
    } catch {}
  }, []);
  useEffect(() => {
    const input = (event: Event) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLSelectElement ||
        target instanceof HTMLTextAreaElement
      )
        target.setCustomValidity("");
    };
    const invalid = (event: Event) => {
      const target = event.target;
      if (!(
        target instanceof HTMLInputElement ||
        target instanceof HTMLSelectElement ||
        target instanceof HTMLTextAreaElement
      ))
        return;
      target.setCustomValidity("");
      if (locale === "zh") {
        const control = target as HTMLInputElement;
        target.setCustomValidity(
          validationMessage(target.validity, locale, {
            minLength: control.minLength,
            maxLength: control.maxLength,
            min: control.min,
            max: control.max,
          }),
        );
      }
    };
    document.addEventListener("invalid", invalid, true);
    document.addEventListener("input", input, true);
    document.addEventListener("change", input, true);
    return () => {
      document.removeEventListener("invalid", invalid, true);
      document.removeEventListener("input", input, true);
      document.removeEventListener("change", input, true);
    };
  }, [locale]);
  const setLocale = useCallback((value: Locale) => {
    setState(value);
    try {
      localStorage.setItem("metalflow.locale", value);
    } catch {}
    document.documentElement.lang = value === "zh" ? "zh-CN" : "en";
  }, []);
  const t = useCallback(
    (text: string, values?: Values) => translate(text, locale, values),
    [locale],
  );
  return (
    <Context.Provider value={{ locale, setLocale, t }}>
      {children}
    </Context.Provider>
  );
}
export function useI18n() {
  return useContext(Context);
}
