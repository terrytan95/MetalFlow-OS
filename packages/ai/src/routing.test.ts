import { describe, it, expect } from "vitest";
import {
  eligible,
  rankKeys,
  classifyFailure,
  responseCooldown,
  resetDelay,
  tokenUsage,
  type KeyState,
} from "./routing.js";
const now = new Date("2026-10-29T12:00:00Z");
const key = (id: string, patch: Partial<KeyState> = {}): KeyState => ({
  id,
  enabled: true,
  status: "READY",
  usageDay: "2026-10-29",
  dailyRequests: 0,
  dailyTokens: 0,
  dailyRequestLimit: 100,
  dailyTokenLimit: 10000,
  cooldownUntil: null,
  leaseUntil: null,
  lastUsedAt: null,
  ...patch,
});
describe("key routing", () => {
  it("selects lowest observed quota ratio then least recently used", () => {
    const keys = [
      key("a", { dailyTokens: 9000 }),
      key("b", {
        dailyTokens: 2000,
        lastUsedAt: new Date("2026-10-29T11:00:00Z"),
      }),
      key("c", { dailyRequests: 20 }),
    ];
    expect(rankKeys(keys, now).map((k) => k.id)).toEqual(["c", "b", "a"]);
  });
  it("excludes disabled, exhausted, cooling, leased and capped keys", () => {
    for (const patch of [
      { enabled: false },
      { status: "INVALID" },
      { status: "QUOTA_EXHAUSTED" },
      { dailyRequests: 100 },
      { dailyTokens: 10000 },
      { cooldownUntil: new Date("2026-10-29T12:01:00Z") },
      { leaseUntil: new Date("2026-10-29T12:01:00Z") },
    ])
      expect(eligible(key("x", patch), now)).toBe(false);
    expect(
      eligible(key("x", { dailyRequests: 100, usageDay: "2026-10-28" }), now),
    ).toBe(true);
  });
  it("distinguishes rate limits, quota errors, invalid keys and terminal requests", () => {
    expect(
      classifyFailure({ status: 429, code: "insufficient_quota" }, +now)
        .keyStatus,
    ).toBe("QUOTA_EXHAUSTED");
    expect(classifyFailure({ status: 401 }, +now).switchKey).toBe(true);
    expect(classifyFailure({ status: 402 }, +now).keyStatus).toBe(
      "QUOTA_EXHAUSTED",
    );
    expect(classifyFailure({ status: 400 }, +now).switchKey).toBe(false);
    expect(classifyFailure({ status: 503 }, +now).switchKey).toBe(false);
    expect(
      classifyFailure({ name: "APIConnectionTimeoutError" }, +now).switchKey,
    ).toBe(false);
    const failure = classifyFailure(
      { status: 429, headers: new Headers({ "retry-after": "120" }) },
      +now,
    );
    expect(failure.cooldownUntil?.getTime()).toBe(+now + 120000);
  });
  it("honors successful rate-limit headers and reset durations", () => {
    expect(resetDelay("1m30s")).toBe(90000);
    expect(resetDelay("2h")).toBe(7200000);
    expect(
      responseCooldown(
        new Headers({
          "x-ratelimit-remaining-tokens": "0",
          "x-ratelimit-reset-tokens": "1m30s",
        }),
        +now,
      )?.getTime(),
    ).toBe(+now + 90000);
  });
  it("normalizes Responses and Chat usage without fabricated costs", () => {
    expect(
      tokenUsage({ prompt_tokens: 5, completion_tokens: 8, total_tokens: 13 }),
    ).toEqual({ inputTokens: 5, outputTokens: 8, totalTokens: 13 });
    expect(tokenUsage(undefined).totalTokens).toBe(0);
  });
});
