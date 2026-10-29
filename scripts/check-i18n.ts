import { readFileSync, readdirSync } from "node:fs";
import { auditSource } from "./i18n-audit.js";
import { config, groups } from "../apps/web/components/data.js";
import {
  fieldNames,
  fieldLabel,
  enumLabel,
} from "../apps/web/lib/localization.js";
import { zh } from "../apps/web/lib/zh.js";
const findings: string[] = [];
for (const file of readdirSync("apps/web/components").filter((f) =>
  f.endsWith(".tsx"),
))
  findings.push(
    ...auditSource(file, readFileSync("apps/web/components/" + file, "utf8")),
  );
for (const [resource, c] of Object.entries(config)) {
  for (const label of [c.title, c.description, ...c.fields.map((f) => f.label)])
    if (!zh[label] && label !== "SKU")
      findings.push(`${resource}: missing configured label ${label}`);
  for (const column of c.columns)
    if (!/[\u3400-\u9fff]|SKU/.test(fieldLabel(column, "zh")))
      findings.push(`${resource}: missing column ${column}`);
  for (const f of c.fields)
    for (const option of f.options || [])
      if (!/[\u3400-\u9fff]|WhatsApp|CSV/.test(enumLabel(f.key, option, "zh")))
        findings.push(`${resource}.${f.key}: missing option ${option}`);
}
for (const group of groups)
  if (!zh[group.label]) findings.push(`Missing nav group: ${group.label}`);
for (const [field, label] of Object.entries(fieldNames))
  if (!zh[label] && label !== "SKU")
    findings.push(`Missing field: ${field} (${label})`);
console.log(
  JSON.stringify(
    {
      findings,
      files: readdirSync("apps/web/components").filter((f) =>
        f.endsWith(".tsx"),
      ).length,
    },
    null,
    2,
  ),
);
if (findings.length) process.exitCode = 1;
