import { it, expect } from "vitest";
import { schemas } from "./resources.js";
it("patch projection does not apply creation defaults to omitted values", () => {
  const raw = { name: "Renamed" };
  const parsed = schemas.products.partial().parse(raw);
  for (const key of Object.keys(parsed))
    if (!Object.prototype.hasOwnProperty.call(raw, key))
      delete (parsed as Record<string, unknown>)[key];
  expect(parsed).toEqual({ name: "Renamed" });
});
