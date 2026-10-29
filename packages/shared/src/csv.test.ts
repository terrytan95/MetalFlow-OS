import { it, expect } from "vitest";
import { parseCSV } from "./csv.js";
it("parses quoted commas, escaped quotes, BOM and multiline fields", () => {
  expect(
    parseCSV('\uFEFFname,notes\r\n"Acme, Inc","Line 1\n""quoted"""'),
  ).toEqual([{ name: "Acme, Inc", notes: 'Line 1\n"quoted"' }]);
});
it("rejects ambiguous and malformed input", () => {
  for (const v of [
    "name,name\na,b",
    "name,notes\na",
    'name\n"oops',
    "__proto__\na",
  ])
    expect(() => parseCSV(v)).toThrow();
});
