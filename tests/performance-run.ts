import { performance } from "node:perf_hooks";
import { randomBytes } from "node:crypto";
import { db } from "../packages/database/index.js";
const org = process.env.BENCH_ORG;
if (!org) throw Error("BENCH_ORG required");
const base = "http://api:3401/metalflow/api/v1";
const signup = await fetch(base + "/auth/sign-up/email", {
  method: "POST",
  headers: {
    Origin: "http://127.0.0.1:3411",
    "content-type": "application/json",
    "x-real-ip": "192.0.2.151",
  },
  body: JSON.stringify({
    name: "Performance QA",
    email: `perf-${Date.now()}@example.invalid`,
    password: randomBytes(24).toString("hex"),
  }),
});
if (!signup.ok) throw Error("Benchmark auth failed");
const user = (await signup.json()).user;
const cookie = signup.headers
  .getSetCookie()
  .map((s) => s.split(";")[0])
  .join("; ");
await db.membership.create({
  data: { organizationId: org, userId: user.id, role: "OWNER" },
});
const results: Record<string, unknown> = {};
for (const path of [
  "analytics",
  "inventory?page=1&limit=25",
  "inventory?page=2&limit=25",
]) {
  const runs: number[] = [];
  let bytes = 0,
    rows = 0;
  for (let i = 0; i < 3; i++) {
    const start = performance.now();
    const response = await fetch(base + "/" + path, {
      headers: { Cookie: cookie, "x-organization-id": org },
    });
    const text = await response.text();
    if (!response.ok) throw Error(text);
    runs.push(performance.now() - start);
    bytes = Buffer.byteLength(text);
    rows = JSON.parse(text).items?.length || 0;
  }
  results[path] = {
    milliseconds: runs.map((n) => Math.round(n * 10) / 10),
    medianMs: [...runs].sort((a, b) => a - b)[1],
    bytes,
    rows,
  };
}
console.log(JSON.stringify({ organizationId: org, results }, null, 2));
await db.$disconnect();
