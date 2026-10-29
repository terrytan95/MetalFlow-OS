import { it, expect } from "vitest";
import { zh } from "../../../apps/web/lib/zh.js";
it("covers core operational labels, financial states and provider errors", () => {
  for (const key of [
    "Customer name",
    "Save draft",
    "Issue credit note",
    "Tax rates",
    "PARTIALLY_PAID",
    "RATE_LIMITED",
    "NO_AVAILABLE_KEY",
    "Stock length",
    "Drawing workspace",
    "Change language",
  ])
    expect(zh[key]).toMatch(/[\u3400-\u9fff]/);
});
