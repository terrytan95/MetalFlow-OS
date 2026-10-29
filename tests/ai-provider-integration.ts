import assert from "node:assert/strict";
import { executeAIJob } from "../apps/worker/src/job.js";
import { randomUUID, randomBytes } from "node:crypto";
import { db } from "../packages/database/index.js";
import { claimKey } from "../packages/ai/src/pool.js";
const base = process.env.TEST_BASE_URL || "http://api:3401/metalflow",
  origin = "http://127.0.0.1:3411";
const suffix = randomUUID().slice(0, 8);
let cookie = "",
  organizationId = "";
async function call(
  route: string,
  body?: unknown,
  method = body ? "POST" : "GET",
  expected = 200,
) {
  const res = await fetch(`${base}/api/v1/${route}`, {
    method,
    headers: {
      Origin: origin,
      "content-type": "application/json",
      "x-real-ip": "192.0.2.77",
      Cookie: cookie,
      "x-organization-id": organizationId,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const cookies = res.headers.getSetCookie();
  if (cookies.length) cookie = cookies.map((c) => c.split(";")[0]).join("; ");
  const text = await res.text();
  assert.equal(
    res.ok,
    expected < 400,
    `${route}: ${res.status} ${text.slice(0, 500)}`,
  );
  return JSON.parse(text);
}
await call("auth/sign-up/email", {
  email: `ai-pool-${suffix}@example.invalid`,
  name: "AI Pool QA",
  password: randomBytes(24).toString("hex"),
});
const org = await call("organizations", {
  name: `AI Pool QA ${suffix}`,
  currency: "USD",
  country: "US",
  businessType: "MIXED",
});
organizationId = org.id;
const provider = await call("ai/providers", {
  name: "Synthetic test provider",
  type: "COMPATIBLE",
  protocol: "RESPONSES",
  baseUrl: "http://ai-mock:8080/v1",
  textModel: "mock-text",
  priority: 0,
});
const secret1 = `test-rate-${suffix}-not-real-secret`,
  secret2 = `test-good-${suffix}-not-real-secret`;
const first = await call(`ai/providers/${provider.id}/keys`, {
  label: "Rate limited",
  apiKey: secret1,
  dailyRequestLimit: 10,
});
const second = await call(`ai/providers/${provider.id}/keys`, {
  label: "Working",
  apiKey: secret2,
  dailyRequestLimit: 10,
});
const stored = await db.aIProviderKey.findUniqueOrThrow({
  where: { id: first.id },
});
assert.notEqual(stored.encryptedKey, secret1);
assert.ok(!stored.encryptedKey.includes(secret1));
const listing = JSON.stringify(await call("ai/providers"));
assert.ok(
  !listing.includes(secret1) &&
    !listing.includes(secret2) &&
    !listing.includes("encryptedKey") &&
    !listing.includes("fingerprint"),
);
await call(
  `ai/providers/${provider.id}/keys`,
  { label: "Duplicate", apiKey: secret2 },
  "POST",
  409,
);
async function run(providerId: string, kind = "ASSISTANT") {
  const job = await call("ai/jobs", {
    kind,
    providerId,
    text:
      kind === "INQUIRY"
        ? "Need 100 pcs SS304 square tube 40x40x2 mm 6m"
        : "Reply OK",
  });
  for (let n = 0; n < 80; n++) {
    const row = await db.aIJob.findUniqueOrThrow({ where: { id: job.id } });
    if (["SUCCEEDED", "FAILED"].includes(row.status)) return row;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw Error("Job did not finish");
}
const result = await run(provider.id);
assert.equal(result.status, "SUCCEEDED", result.error || "");
const attempts = await db.aIKeyAttempt.findMany({
  where: { jobId: result.id },
  orderBy: { createdAt: "asc" },
});
assert.equal(attempts.length, 2);
assert.equal(attempts[0].keyId, first.id);
assert.equal(attempts[0].errorCode, "RATE_LIMITED");
assert.equal(attempts[1].keyId, second.id);
assert.equal(attempts[1].totalTokens, 18);
const keys = (await call("ai/providers")).providers[0].keys;
assert.equal(keys.find((k: any) => k.id === first.id).state, "COOLDOWN");
assert.equal(keys.find((k: any) => k.id === second.id).dailyTokens, 18);
assert.ok(!JSON.stringify(await call("ai/jobs")).includes(secret1));
await call(
  `ai/providers/${provider.id}/keys/${second.id}`,
  { dailyTokenLimit: 18 },
  "PATCH",
);
const limited = await run(provider.id);
assert.equal(limited.status, "FAILED");
assert.equal(limited.error, "NO_AVAILABLE_KEY");
await call(
  `ai/providers/${provider.id}/keys/${second.id}`,
  { dailyTokenLimit: null },
  "PATCH",
);
await call(
  `ai/providers/${provider.id}/keys/${first.id}`,
  { enabled: false },
  "PATCH",
);
const inquiry = await run(provider.id, "INQUIRY");
assert.equal(inquiry.status, "SUCCEEDED");
assert.equal((inquiry.result as any).grade, "304");
const chat = await call("ai/providers", {
  name: "Chat mock",
  type: "COMPATIBLE",
  protocol: "CHAT",
  baseUrl: "http://ai-mock:8080/v1",
  textModel: "mock-chat",
  priority: 10,
});
await call(`ai/providers/${chat.id}/keys`, {
  label: "Chat key",
  apiKey: `test-chat-${suffix}-not-real-secret`,
});
assert.equal((await run(chat.id)).status, "SUCCEEDED");
const invalid = await call("ai/providers", {
  name: "Failure fallback",
  type: "COMPATIBLE",
  protocol: "CHAT",
  baseUrl: "http://ai-mock:8080/v1",
  textModel: "mock-chat",
  priority: 20,
});
await call(`ai/providers/${invalid.id}/keys`, {
  label: "Invalid key",
  apiKey: `test-invalid-${suffix}-not-real-secret`,
});
await call(`ai/providers/${invalid.id}/keys`, {
  label: "Quota key",
  apiKey: `test-quota-${suffix}-not-real-secret`,
});
await call(`ai/providers/${invalid.id}/keys`, {
  label: "Ready key",
  apiKey: `test-fallback-${suffix}-not-real-secret`,
});
const failedOver = await run(invalid.id);
assert.equal(failedOver.status, "SUCCEEDED");
assert.equal(
  await db.aIKeyAttempt.count({ where: { jobId: failedOver.id } }),
  3,
);
const leaseResults = await Promise.all([
  claimKey(organizationId, provider.id, [], randomUUID(), "mock-text"),
  claimKey(organizationId, provider.id, [], randomUUID(), "mock-text"),
]);
assert.equal(leaseResults.filter(Boolean).length, 1);
const lease = leaseResults.find(Boolean)!;
await db.aIProviderKey.update({
  where: { id: lease.key.id },
  data: { leaseUntil: null, leaseId: null },
});

const malformed = await call("ai/providers", {
  name: "Malformed output",
  type: "COMPATIBLE",
  protocol: "CHAT",
  baseUrl: "http://ai-mock:8080/v1",
  textModel: "mock-chat",
  priority: 30,
});
const malformedKey = await call(`ai/providers/${malformed.id}/keys`, {
  label: "Malformed output key",
  apiKey: `test-malformed-${suffix}-not-real-secret`,
});
const badOutput = await run(malformed.id, "INQUIRY");
assert.equal(badOutput.status, "FAILED");
assert.equal(badOutput.error, "INVALID_PROVIDER_OUTPUT");
assert.equal(
  (await db.aIProviderKey.findUniqueOrThrow({ where: { id: malformedKey.id } }))
    .dailyTokens,
  18,
);
const six = await call("ai/providers", {
  name: "Six key fallback",
  type: "COMPATIBLE",
  protocol: "CHAT",
  baseUrl: "http://ai-mock:8080/v1",
  textModel: "mock-chat",
  priority: 40,
});
for (let i = 0; i < 6; i++)
  await call(`ai/providers/${six.id}/keys`, {
    label: `Key ${i + 1}`,
    apiKey: `test-${i < 5 ? "invalid" : "good"}-six-${i}-${suffix}-synthetic`,
  });
const sixth = await run(six.id);
assert.equal(sixth.status, "SUCCEEDED");
assert.equal(await db.aIKeyAttempt.count({ where: { jobId: sixth.id } }), 6);
const server = await call("ai/providers", {
  name: "Ambiguous server failure",
  type: "COMPATIBLE",
  protocol: "CHAT",
  baseUrl: "http://ai-mock:8080/v1",
  textModel: "mock-chat",
  priority: 50,
});
await call(`ai/providers/${server.id}/keys`, {
  label: "Server error",
  apiKey: `test-server-${suffix}-not-real-secret`,
});
await call(`ai/providers/${server.id}/keys`, {
  label: "Do not replay",
  apiKey: `test-noreplay-${suffix}-not-real-secret`,
});
const uncertain = await run(server.id);
assert.equal(uncertain.status, "FAILED");
assert.equal(uncertain.error, "PROVIDER_UNAVAILABLE");
assert.equal(
  await db.aIKeyAttempt.count({ where: { jobId: uncertain.id } }),
  1,
);
const stale = await db.aIJob.create({
  data: {
    organizationId,
    kind: "ASSISTANT",
    status: "RUNNING",
    input: { text: "Never replay this" },
    model: "mock-text",
    createdBy: stored.createdBy,
  },
});
await executeAIJob(stale.id);
assert.equal(
  (await db.aIJob.findUniqueOrThrow({ where: { id: stale.id } })).error,
  "INTERRUPTED_PROVIDER_STATUS_UNKNOWN",
);
assert.equal(await db.aIKeyAttempt.count({ where: { jobId: stale.id } }), 0);
const other = await call("organizations", {
  name: `Other AI QA ${suffix}`,
  currency: "USD",
  country: "US",
  businessType: "MIXED",
});
organizationId = other.id;
assert.equal((await call("ai/providers")).providers.length, 0);
await call(`ai/providers/${provider.id}`, { enabled: false }, "PATCH", 404);
await call(
  `ai/providers/${provider.id}/keys`,
  { label: "Wrong tenant", apiKey: `test-foreign-${suffix}-not-real-secret` },
  "POST",
  404,
);
await call(
  "ai/jobs",
  { kind: "ASSISTANT", providerId: provider.id, text: "Unauthorized tenant" },
  "POST",
  400,
);
organizationId = org.id;
await call(
  `ai/providers/${provider.id}`,
  { baseUrl: "https://attacker.example/v1" },
  "PATCH",
  400,
);
await call(
  "ai/providers",
  {
    name: "Private",
    type: "COMPATIBLE",
    baseUrl: "https://127.0.0.1/v1",
    textModel: "mock",
  },
  "POST",
  400,
);
const all = await call("ai/providers");
assert.ok(!JSON.stringify(all).includes("not-real-secret"));
await call(`ai/providers/${provider.id}/keys/${first.id}`, undefined, "DELETE");
assert.equal(await db.aIProviderKey.count({ where: { id: first.id } }), 0);

const adminCookie = cookie;
const viewerEmail = `ai-viewer-${suffix}@example.invalid`;
const invitation = await call("invitations", {
  email: viewerEmail,
  role: "VIEWER",
});
await call("auth/sign-up/email", {
  email: viewerEmail,
  name: "AI Viewer QA",
  password: randomBytes(24).toString("hex"),
});
await call("invitations/accept", {
  token: new URL(invitation.url).searchParams.get("invitation"),
});
await call("ai/providers", undefined, "GET", 403);
await call(
  "ai/providers",
  { name: "Forbidden", type: "OPENAI", textModel: "fake" },
  "POST",
  403,
);
await call(
  `ai/providers/${provider.id}/keys/${second.id}`,
  { enabled: false },
  "PATCH",
  403,
);
cookie = adminCookie;
console.log(
  JSON.stringify(
    {
      result: "PASS",
      checks: [
        "encrypted at rest",
        "no key disclosure",
        "duplicate rejection",
        "429 failover",
        "usage accounting",
        "daily cap skip",
        "structured Responses extraction",
        "Chat compatibility",
        "401 and quota failover",
        "concurrent key lease",
        "tenant isolation",
        "immutable endpoint",
        "private endpoint rejection",
        "key deletion",
        "invalid output usage accounting",
        "sixth-key fallback",
        "no replay on 5xx",
        "interrupted job reconciliation",
      ],
      organizationId,
    },
    null,
    2,
  ),
);
await db.$disconnect();
