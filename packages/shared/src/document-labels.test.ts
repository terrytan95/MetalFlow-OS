import { it, expect } from "vitest";
import { documentLabel } from "./document-labels.js";
it("localizes PDF labels without altering business content", () => {
  expect(documentLabel("QUOTATION", true)).toBe("报价单");
  expect(documentLabel("Subtotal", false)).toBe("Subtotal");
  expect(documentLabel("Customer custom name", true)).toBe(
    "Customer custom name",
  );
});
