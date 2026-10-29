import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { db } from "../packages/database/index.js";
const base = "http://api:3401/metalflow/api/v1",
  origin = "http://127.0.0.1:3411";
let cookie = "",
  org = "";
async function call(
  route: string,
  body?: unknown,
  method = body ? "POST" : "GET",
  expected = 200,
) {
  const r = await fetch(base + "/" + route, {
    method,
    headers: {
      Origin: origin,
      "x-real-ip": "192.0.2.170",
      Cookie: cookie,
      "x-organization-id": org,
      "content-type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (r.headers.getSetCookie().length)
    cookie = r.headers
      .getSetCookie()
      .map((v) => v.split(";")[0])
      .join("; ");
  const text = await r.text();
  assert.equal(r.ok, expected < 400, route + ": " + text);
  return JSON.parse(text);
}
await call("auth/sign-up/email", {
  name: "Extended QA",
  email: `extended-${Date.now()}@example.invalid`,
  password: randomBytes(24).toString("hex"),
});
org = (
  await call("organizations", {
    name: "Extended fictional QA",
    currency: "USD",
    country: "US",
    businessType: "MIXED",
  })
).id;
const customer = await call("customers", {
  name: "Credit QA customer",
  tags: ["contractor"],
  creditLimit: "1000",
});
const invoice = await call("documents", {
  kind: "INVOICE",
  customerId: customer.id,
  lines: [
    { description: "Service", quantity: "1", unit: "custom", unitPrice: "100" },
  ],
  taxRate: "10",
});
await call(`documents/${invoice.id}/status`, { status: "ISSUED" });
const credit = {
  invoiceId: invoice.id,
  amount: "22",
  reason: "Agreed service discount",
  idempotencyKey: randomUUID(),
};
const a = await call("credit-notes", credit);
assert.equal((await call("credit-notes", credit)).id, a.id);
await call(
  "payments",
  {
    invoiceId: invoice.id,
    amount: "89",
    method: "BANK",
    reference: "Overpay",
    idempotencyKey: randomUUID(),
  },
  "POST",
  409,
);
await call("payments", {
  invoiceId: invoice.id,
  amount: "88",
  method: "BANK",
  reference: "Balance",
  idempotencyKey: randomUUID(),
});
const metrics = await call("analytics");
assert.equal(metrics.receivables, "0.00");
assert.equal(metrics.revenue, "80.00");
await call("profile", { name: "Renamed QA" }, "PATCH");
assert.equal((await call("me")).user.name, "Renamed QA");
await call("tax-rates", { name: "Configurable tax", rate: "6" });
assert.equal((await call("tax-rates")).items[0].rate, "6");
const warehouse = (await call("warehouses")).items[0];
const rows = Array.from({ length: 110 }, (_, i) => ({
  sku: `EXT-${i}`,
  name: `Searchable product ${i}`,
  material: "Steel",
  profile: "sheet",
  unit: "piece",
  price: "10",
  cost: "5",
  reorderPoint: "20",
}));
await call("imports/products", { rows, idempotencyKey: randomUUID() });
await call("imports/inventory", {
  warehouseId: warehouse.id,
  rows: rows.map((r) => ({ sku: r.sku, quantity: "5" })),
  idempotencyKey: randomUUID(),
});
const page1 = await call("inventory?limit=25&page=1"),
  page2 = await call("inventory?limit=25&page=2");
assert.equal(page1.total, 110);
assert.equal(page1.items.length, 25);
assert.equal(
  new Set([...page1.items, ...page2.items].map((r) => r.id)).size,
  50,
);
assert.equal((await call("inventory?search=EXT-109")).items.length, 1);
const summary = await call("analytics");
assert.equal(summary.lowStockCount, 110);
assert.equal(summary.lowStock.length, 50);
const project = await call("projects", {
  customerId: customer.id,
  name: "Calendar QA",
  budget: "1000",
});
await call("tasks", {
  projectId: project.id,
  name: "Scheduled QA",
  dueDate: new Date().toISOString(),
});
const now = new Date();
const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
  end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59),
  );
assert.equal(
  (await call(`schedule?from=${start.toISOString()}&to=${end.toISOString()}`))
    .items.length,
  1,
);

const product = (await call("products?search=EXT-0")).items.find(
  (p: any) => p.sku === "EXT-0",
);
const adjust = {
  productId: product.id,
  warehouseId: warehouse.id,
  quantity: "1",
  reason: "Idempotent adjustment",
  idempotencyKey: randomUUID(),
};
const adjusted = await call("inventory/adjust", adjust);
assert.equal((await call("inventory/adjust", adjust)).id, adjusted.id);
const fab = { name: "Idempotent job", idempotencyKey: randomUUID() };
const saved = await call("fabrication", fab);
assert.equal((await call("fabrication", fab)).id, saved.id);
const supplier = await call("suppliers", { name: "Shortage supplier" });
const order = await call("documents", {
  kind: "ORDER",
  customerId: customer.id,
  lines: [
    {
      productId: product.id,
      description: "Shortage product",
      quantity: "10",
      unit: "piece",
      unitPrice: "10",
    },
  ],
});
const purchase = await call(`orders/${order.id}/purchase-shortage`, {
  supplierId: supplier.id,
  warehouseId: warehouse.id,
});
assert.equal(purchase.lines[0].quantity, "4");
assert.equal(
  (
    await call(`orders/${order.id}/purchase-shortage`, {
      supplierId: supplier.id,
      warehouseId: warehouse.id,
    })
  ).id,
  purchase.id,
);
const owner = (await call("me")).user;
const provider = await call("ai/providers", {
  name: "Quota race test",
  type: "COMPATIBLE",
  protocol: "CHAT",
  baseUrl: "http://ai-mock:8080/v1",
  textModel: "mock-text",
});
await call(`ai/providers/${provider.id}/keys`, {
  label: "Mock only",
  apiKey: "test-good-quota-race-only-synthetic",
});
await db.aIJob.createMany({
  data: Array.from({ length: 29 }, () => ({
    organizationId: org,
    kind: "ASSISTANT",
    status: "FAILED",
    input: { text: "Quota fixture only" },
    createdBy: owner.id,
  })),
});
const raced = await Promise.all(
  Array.from({ length: 10 }, () =>
    fetch(base + "/ai/jobs", {
      method: "POST",
      headers: {
        Origin: origin,
        Cookie: cookie,
        "x-organization-id": org,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        kind: "ASSISTANT",
        providerId: provider.id,
        text: "OK",
      }),
    }),
  ),
);
assert.equal(raced.filter((r) => r.status === 201).length, 1);
assert.equal(raced.filter((r) => r.status === 409).length, 9);

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=",
  "base64",
);
async function upload() {
  const form = new FormData();
  form.set("file", new Blob([png], { type: "image/png" }), "unused.png");
  const response = await fetch(base + "/files", {
    method: "POST",
    headers: { Origin: origin, Cookie: cookie, "x-organization-id": org },
    body: form,
  });
  assert.equal(response.status, 201);
  return response.json();
}
const unused = await upload();
await call(`files/${unused.id}`, undefined, "DELETE");
const linked = await upload();
await call("takeoffs", {
  name: "Protected takeoff",
  fileId: linked.id,
  measurements: [
    { label: "Rail", quantity: "2", unit: "m", source: "USER", verified: true },
  ],
});
await call(`files/${linked.id}`, undefined, "DELETE", 409);
console.log(
  JSON.stringify({
    result: "PASS",
    checks: [
      "idempotent credit note",
      "credit-adjusted payment balance",
      "credit-adjusted revenue",
      "profile",
      "tax settings",
      "bulk import",
      "real inventory pagination",
      "inventory search",
      "low-stock full count",
      "project schedule",
    ],
  }),
);
await db.$disconnect();
