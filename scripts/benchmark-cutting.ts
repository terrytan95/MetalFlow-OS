import { performance } from "node:perf_hooks";
import assert from "node:assert/strict";
import { cutting } from "../packages/shared/src/domain.js";
function before(count: number) {
  const bins: number[] = [];
  for (let i = 0; i < count; i++) {
    const found = bins.findIndex((left) => left >= 3503);
    if (found < 0) bins.push(2497);
    else bins[found] -= 3503;
  }
  return bins;
}
for (const size of [1000, 5000]) {
  const input = {
    stockLength: 6000,
    kerf: 3,
    trim: 0,
    available: 5000,
    offcutThreshold: 300,
    cuts: Array.from({ length: size / 1000 }, () => ({
      length: 3500,
      quantity: 1000,
    })),
  };
  const run = (fn: () => unknown) => {
    const times = [];
    for (let i = 0; i < 7; i++) {
      const start = performance.now();
      fn();
      times.push(performance.now() - start);
    }
    return times.sort((a, b) => a - b)[3];
  };
  const old = run(() => before(size)),
    current = run(() => cutting(input));
  assert.equal(cutting(input).stockPieces, size);
  console.log(
    JSON.stringify({
      pieces: size,
      beforeMedianMs: old,
      afterMedianMs: current,
      ratio: old / current,
    }),
  );
}
