export type KeyState = {
  id: string;
  enabled: boolean;
  status: string;
  usageDay: string;
  dailyRequests: number;
  dailyTokens: number;
  dailyRequestLimit: number | null;
  dailyTokenLimit: number | null;
  cooldownUntil: Date | null;
  leaseUntil: Date | null;
  lastUsedAt: Date | null;
  createdAt?: Date;
};
export const utcDay = (now = new Date()) => now.toISOString().slice(0, 10);
export function eligible(key: KeyState, now = new Date()) {
  const today = key.usageDay === utcDay(now);
  return (
    key.enabled &&
    !["INVALID", "QUOTA_EXHAUSTED"].includes(key.status) &&
    (!key.cooldownUntil || key.cooldownUntil <= now) &&
    (!key.leaseUntil || key.leaseUntil <= now) &&
    (!key.dailyRequestLimit ||
      !today ||
      key.dailyRequests < key.dailyRequestLimit) &&
    (!key.dailyTokenLimit || !today || key.dailyTokens < key.dailyTokenLimit)
  );
}
export function rankKeys<T extends KeyState>(keys: T[], now = new Date()) {
  const load = (k: T) =>
    k.usageDay !== utcDay(now)
      ? 0
      : Math.max(
          k.dailyRequestLimit ? k.dailyRequests / k.dailyRequestLimit : 0,
          k.dailyTokenLimit ? k.dailyTokens / k.dailyTokenLimit : 0,
        );
  return keys
    .filter((k) => eligible(k, now))
    .sort(
      (a, b) =>
        load(a) - load(b) ||
        (a.lastUsedAt?.getTime() || 0) - (b.lastUsedAt?.getTime() || 0) ||
        (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0) ||
        a.id.localeCompare(b.id),
    );
}
export function resetDelay(value: string | null | undefined, now = Date.now()) {
  if (!value) return 60000;
  const numeric = Number(value);
  let ms;
  if (Number.isFinite(numeric)) ms = numeric * 1000;
  else if (/^([\d.]+(?:ms|s|m|h|d))+$/.test(value)) {
    ms = [...value.matchAll(/([\d.]+)(ms|s|m|h|d)/g)].reduce(
      (sum, m) =>
        sum +
        Number(m[1]) *
          ({ ms: 1, s: 1000, m: 60000, h: 3600000, d: 86400000 }[m[2]] || 0),
      0,
    );
  } else ms = Date.parse(value) - now;
  return Number.isFinite(ms)
    ? Math.min(7 * 86400000, Math.max(1000, ms))
    : 60000;
}
export function classifyFailure(error: unknown, now = Date.now()) {
  const e = error as {
    status?: number;
    code?: string;
    error?: { code?: string };
    headers?: Headers;
    name?: string;
  };
  const status = Number(e?.status) || null;
  const code = String(e?.code || e?.error?.code || "");
  const retry = e?.headers?.get?.("retry-after");
  if (status === 401)
    return {
      code: "INVALID_KEY",
      status,
      switchKey: true,
      keyStatus: "INVALID",
      cooldownUntil: null,
    };
  if (
    status === 402 ||
    (status === 429 &&
      [
        "insufficient_quota",
        "billing_hard_limit_reached",
        "quota_exceeded",
      ].includes(code))
  )
    return {
      code: "QUOTA_EXHAUSTED",
      status,
      switchKey: true,
      keyStatus: "QUOTA_EXHAUSTED",
      cooldownUntil: null,
    };
  if (status === 429)
    return {
      code: "RATE_LIMITED",
      status,
      switchKey: true,
      keyStatus: "COOLDOWN",
      cooldownUntil: new Date(now + Math.max(60000, resetDelay(retry, now))),
    };
  if (status === 403)
    return {
      code: "ACCESS_DENIED",
      status,
      switchKey: true,
      keyStatus: "COOLDOWN",
      cooldownUntil: new Date(now + 600000),
    };
  if (status && status >= 500)
    return {
      code: "PROVIDER_UNAVAILABLE",
      status,
      switchKey: false,
      keyStatus: "COOLDOWN",
      cooldownUntil: new Date(now + 60000),
    };
  if (!status)
    return {
      code: "NETWORK_OR_TIMEOUT",
      status,
      switchKey: false,
      keyStatus: "COOLDOWN",
      cooldownUntil: new Date(now + 60000),
    };
  return {
    code: "REQUEST_REJECTED",
    status,
    switchKey: false,
    keyStatus: "READY",
    cooldownUntil: null,
  };
}
export function responseCooldown(headers: Headers, now = Date.now()) {
  const waits: number[] = [];
  for (const kind of ["requests", "tokens"])
    if (headers.get(`x-ratelimit-remaining-${kind}`) === "0")
      waits.push(resetDelay(headers.get(`x-ratelimit-reset-${kind}`), now));
  return waits.length ? new Date(now + Math.max(...waits)) : null;
}
export function tokenUsage(raw: unknown) {
  const u = (raw || {}) as Record<string, unknown>;
  const n = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v)
      ? Math.min(1000000000, Math.max(0, Math.floor(v)))
      : 0;
  const inputTokens = n(u.input_tokens ?? u.prompt_tokens),
    outputTokens = n(u.output_tokens ?? u.completion_tokens);
  return {
    inputTokens,
    outputTokens,
    totalTokens: n(u.total_tokens) || inputTokens + outputTokens,
  };
}
export class AIExecutionError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

export class CompletedOutputError extends Error {
  readonly status = 422;
  constructor(
    public usage: unknown,
    public headers: Headers,
  ) {
    super("INVALID_PROVIDER_OUTPUT");
  }
}
