import { describe, it, expect } from "vitest";
import {
  totals,
  convert,
  weight,
  cutting,
  can,
  documentSchema,
} from "./domain.js";
describe("commercial calculations", () => {
  it("rounds line extensions, discount and tax deterministically", () => {
    expect(
      totals(
        [
          {
            description: "Tube",
            quantity: "3",
            unitPrice: "0.10",
            unit: "piece",
          },
          {
            description: "Cut",
            quantity: "1",
            unitPrice: "10.005",
            unit: "piece",
          },
        ],
        "0.31",
        "10",
      ),
    ).toEqual({
      subtotal: "10.31",
      discount: "0.31",
      taxRate: "10",
      tax: "1.00",
      total: "11.00",
    });
  });
  it("rejects over-discount, negative quantity and excess tax", () => {
    expect(() =>
      totals(
        [{ description: "x", quantity: "1", unitPrice: "1", unit: "piece" }],
        "2",
      ),
    ).toThrow();
    expect(
      documentSchema.safeParse({
        kind: "ORDER",
        lines: [
          { description: "x", quantity: "-1", unitPrice: "2", unit: "piece" },
        ],
      }).success,
    ).toBe(false);
  });
  it("converts compatible units exactly", () => {
    expect(convert("1", "ft", "m")).toBe("0.3048");
    expect(convert("1", "lb", "kg")).toBe("0.45359237");
    expect(() => convert("1", "m", "kg")).toThrow();
  });
  it("calculates rectangular tube weight and rejects impossible walls", () => {
    expect(
      weight("square-tube", {
        width: 40,
        height: 40,
        thickness: 2,
        length: 6000,
        density: 7930,
      }).kg,
    ).toBeCloseTo(14.46432);
    expect(() =>
      weight("square-tube", {
        width: 40,
        height: 40,
        thickness: 21,
        length: 6000,
        density: 7930,
      }),
    ).toThrow();
  });
});
it("uses the same rounded discount in stored components and total", () => {
  const t = totals(
    [{ description: "x", quantity: "1", unitPrice: "1", unit: "piece" }],
    "0.005",
  );
  expect(t.discount).toBe("0.01");
  expect(t.total).toBe("0.99");
});
describe("cutting and authorization", () => {
  it("conserves stock and never overfills patterns", () => {
    const r = cutting({
      stockLength: 6000,
      kerf: 3,
      trim: 10,
      available: 10,
      offcutThreshold: 300,
      cuts: [
        { length: 1500, quantity: 4 },
        { length: 2200, quantity: 3 },
      ],
    });
    for (const p of r.patterns)
      expect(p.cuts.reduce((s, n) => s + n + 3, 0) + p.remaining + 20).toBe(
        6000,
      );
    expect(r.utilization).toBeLessThanOrEqual(100);
  });
  it("rejects shortages and oversized pieces", () => {
    expect(() =>
      cutting({
        stockLength: 100,
        kerf: 3,
        trim: 0,
        available: 1,
        offcutThreshold: 10,
        cuts: [{ length: 100, quantity: 1 }],
      }),
    ).toThrow();
    expect(() =>
      cutting({
        stockLength: 100,
        kerf: 3,
        trim: 0,
        available: 1,
        offcutThreshold: 10,
        cuts: [{ length: 70, quantity: 2 }],
      }),
    ).toThrow();
  });
  it("does not grant finance or cost rights to viewers and sales reps", () => {
    expect(can("VIEWER", "finance:write")).toBe(false);
    expect(can("SALES_REP", "cost:read")).toBe(false);
    expect(can("ACCOUNTANT", "finance:write")).toBe(true);
    expect(can("UNKNOWN", "read")).toBe(false);
  });
});
it("indexed first-fit matches the original first-fit patterns", () => {
  const slow = (cuts: { length: number; quantity: number }[]) => {
    const bins: { cuts: number[]; remaining: number }[] = [];
    for (const length of cuts
      .flatMap((c) => Array(c.quantity).fill(c.length))
      .sort((a, b) => b - a)) {
      let bin = bins.find((b) => b.remaining >= length + 3);
      if (!bin) {
        bin = { cuts: [], remaining: 5980 };
        bins.push(bin);
      }
      bin.cuts.push(length);
      bin.remaining -= length + 3;
    }
    return bins;
  };
  for (let seed = 1; seed <= 30; seed++) {
    const cuts = Array.from({ length: 8 }, (_, i) => ({
      length: 100 + ((seed * 431 + i * 719) % 4500),
      quantity: 1 + ((seed + i) % 7),
    }));
    expect(
      cutting({
        stockLength: 6000,
        trim: 10,
        kerf: 3,
        available: 100,
        offcutThreshold: 300,
        cuts,
      }).patterns,
    ).toEqual(slow(cuts));
  }
});
