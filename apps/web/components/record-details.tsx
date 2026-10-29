"use client";
import { useI18n } from "../lib/i18n";
import {
  fieldLabel,
  enumLabel,
  actionLabel,
  formatDate,
  formatNumber,
} from "../lib/localization";
const coded = new Set([
  "status",
  "type",
  "role",
  "source",
  "unit",
  "profile",
  "material",
  "kind",
  "category",
  "method",
  "error",
  "lastErrorCode",
  "algorithm",
  "disclaimer",
]);
export function displayValue(
  field: string,
  value: unknown,
  locale: "en" | "zh",
): string {
  if (value === null || value === undefined)
    return locale === "zh" ? "未提供" : "Not provided";
  if (typeof value === "boolean") return enumLabel(field, value, locale);
  if (field === "action") return actionLabel(String(value), locale);
  if (coded.has(field)) return enumLabel(field, value, locale);
  if (typeof value === "number") return formatNumber(value, locale);
  if (
    /(?:At|Date|Until)$/.test(field) &&
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}/.test(value)
  )
    return formatDate(
      value,
      locale,
      field.endsWith("At") ? "datetime" : "date",
    );
  return String(value);
}
export function RecordDetails({ data }: { data: Record<string, unknown> }) {
  const { locale } = useI18n();
  return (
    <dl className="record-details">
      {Object.entries(data).map(([field, value]) => (
        <div key={field} className="record-detail">
          <dt>{fieldLabel(field, locale)}</dt>
          <dd>
            {Array.isArray(value) ? (
              value.length ? (
                <ul>
                  {value.map((v, i) => (
                    <li key={i}>
                      {v !== null && typeof v === "object" ? (
                        <RecordDetails data={v as Record<string, unknown>} />
                      ) : (
                        displayValue(field, v, locale)
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <span>—</span>
              )
            ) : value !== null && typeof value === "object" ? (
              <RecordDetails data={value as Record<string, unknown>} />
            ) : (
              displayValue(field, value, locale)
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
