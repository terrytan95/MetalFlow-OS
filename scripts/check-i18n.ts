import ts from "typescript";
import { readFileSync, readdirSync } from "node:fs";
import { zh } from "../apps/web/lib/zh.js";
const missing = new Set<string>();
const untranslated: string[] = [];
const allowed =
  /^(MetalFlow(?: OS)?|OS|SKU|OpenAI|OpenAI-compatible API|Responses API|Chat Completions|CSV|API|Token|Tokens|English|Esc|⌘ K|INV-2026 ·|M|mm|m|KB|US)$/;
for (const file of readdirSync("apps/web/components").filter((f) =>
  f.endsWith(".tsx"),
)) {
  const source = ts.createSourceFile(
    file,
    readFileSync("apps/web/components/" + file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  function walk(n: ts.Node) {
    if (
      ts.isCallExpression(n) &&
      n.expression.getText(source) === "t" &&
      n.arguments[0] &&
      ts.isStringLiteral(n.arguments[0])
    ) {
      const value = n.arguments[0].text;
      if (/[A-Za-z]/.test(value) && !zh[value] && !allowed.test(value))
        missing.add(value);
    }
    if (ts.isJsxText(n)) {
      const value = n.text.replace(/\s+/g, " ").trim();
      if (/[A-Za-z]{2}/.test(value) && !allowed.test(value))
        untranslated.push(`${file}: ${value}`);
    }
    ts.forEachChild(n, walk);
  }
  walk(source);
}
console.log(JSON.stringify({ missing: [...missing], untranslated }, null, 2));
if (missing.size || untranslated.length) process.exitCode = 1;
