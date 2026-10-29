import ts from "typescript";
import { zh } from "../apps/web/lib/zh.js";
const technical =
  /^(MetalFlow(?: OS)?|OS|SKU|OpenAI|CSV|API|English|Esc|⌘ K|M|mm|m|KB|US|https:\/\/[^ ]+|[^ ]+@[^ ]+)$/;
const textAttributes = new Set([
  "title",
  "placeholder",
  "aria-label",
  "alt",
  "label",
  "description",
]);
export function auditSource(file: string, text: string) {
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const findings: string[] = [];
  const report = (n: ts.Node, message: string) =>
    findings.push(
      `${file}:${source.getLineAndCharacterOfPosition(n.getStart(source)).line + 1}: ${message}`,
    );
  const raw = (n: ts.Node) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
      if (/[A-Za-z]{2}/.test(n.text) && !technical.test(n.text))
        report(n, "Untranslated UI literal: " + n.text);
    } else if (ts.isTemplateExpression(n)) {
      const fragments = [
        n.head.text,
        ...n.templateSpans.map((s) => s.literal.text),
      ].join("");
      if (/[A-Za-z]{2}/.test(fragments))
        report(n, "Untranslated UI template: " + n.getText(source));
    } else if (ts.isConditionalExpression(n)) {
      raw(n.whenTrue);
      raw(n.whenFalse);
    } else if (
      ts.isBinaryExpression(n) &&
      [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(
        n.operatorToken.kind,
      )
    ) {
      raw(n.right);
    }
  };
  function visit(n: ts.Node) {
    if (ts.isJsxText(n)) {
      const value = n.text.replace(/\s+/g, " ").trim();
      if (/[A-Za-z]{2}/.test(value) && !technical.test(value))
        report(n, "Untranslated JSX text: " + value);
    }
    if (
      ts.isJsxAttribute(n) &&
      textAttributes.has(n.name.getText(source)) &&
      n.initializer
    ) {
      if (ts.isJsxExpression(n.initializer) && n.initializer.expression)
        raw(n.initializer.expression);
      else raw(n.initializer);
    }
    if (ts.isJsxExpression(n) && n.expression && !ts.isJsxAttribute(n.parent)) {
      raw(n.expression);
      if (
        ts.isCallExpression(n.expression) &&
        n.expression.expression.getText(source) === "JSON.stringify"
      )
        report(
          n,
          "Raw JSON used as UI; label structured data or mark import syntax explicitly",
        );
    }
    if (ts.isCallExpression(n)) {
      const call = n.expression.getText(source);
      if (
        call === "t" &&
        n.arguments[0] &&
        (ts.isStringLiteral(n.arguments[0]) ||
          ts.isNoSubstitutionTemplateLiteral(n.arguments[0]))
      ) {
        const value = n.arguments[0].text;
        if (/[A-Za-z]/.test(value) && !zh[value] && !technical.test(value))
          report(n, "Missing Chinese translation: " + value);
      }
      if (
        ts.isPropertyAccessExpression(n.expression) &&
        /^toLocale(?:DateString|TimeString|String)$/.test(
          n.expression.name.text,
        ) &&
        !n.arguments.length
      )
        report(
          n,
          "Formatting depends on browser language instead of selected locale",
        );
    }
    ts.forEachChild(n, visit);
  }
  visit(source);
  return findings;
}
