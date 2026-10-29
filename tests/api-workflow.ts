import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3410/metalflow";
const origin = process.env.TEST_ORIGIN || "https://terrytan.dev";
const suffix = Date.now();
let clientCounter = 1;
class Client {
  ip = `192.0.2.${clientCounter++}`;
  cookie = "";
  org = "";
  async call(
    route: string,
    body?: unknown,
    method = body ? "POST" : "GET",
    expected = 200,
  ) {
    const res = await fetch(`${base}/api/v1/${route}`, {
      method,
      headers: {
        Origin: origin,
        "x-real-ip": this.ip,
        "Content-Type": "application/json",
        Cookie: this.cookie,
        "X-Organization-ID": this.org,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const cookies = res.headers.getSetCookie();
    if (cookies.length)
      this.cookie = cookies.map((c) => c.split(";")[0]).join("; ");
    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    assert.equal(
      res.status >= 200 && res.status < 300,
      expected < 400,
      `${route}: ${res.status} ${text}`,
    );
    return data;
  }
}
const a = new Client(),
  b = new Client(),
  viewer = new Client();
await a.call("auth/sign-up/email", {
  name: "Workflow Test A",
  email: `workflow-a-${suffix}@example.invalid`,
  password: `Test-only-${randomUUID()}!`,
});
const oa = await a.call("organizations", {
  name: `QA Organization A ${suffix}`,
  currency: "USD",
  country: "US",
  businessType: "MIXED",
});
a.org = oa.id;
await b.call("auth/sign-up/email", {
  name: "Workflow Test B",
  email: `workflow-b-${suffix}@example.invalid`,
  password: `Test-only-${randomUUID()}!`,
});
b.org = (
  await b.call("organizations", {
    name: `QA Organization B ${suffix}`,
    currency: "USD",
    country: "US",
    businessType: "MIXED",
  })
).id;
const c = await a.call("customers", {
  name: "Fictional Harbor QA",
  email: "fictional@example.invalid",
});
await b.call(
  `customers/${c.id}`,
  { name: "Cross-tenant corruption" },
  "PATCH",
  404,
);
const product = await a.call("products", {
  sku: `QA-${suffix}`,
  name: "SS304 tube test",
  material: "Stainless steel",
  grade: "304",
  profile: "square-tube",
  unit: "piece",
  price: "48.00",
  cost: "30.00",
});
const warehouse = (await a.call("warehouses")).items[0];
await a.call("inventory/adjust", {
  productId: product.id,
  warehouseId: warehouse.id,
  quantity: "10",
  reason: "QA initial stock",
});
const inquiry = await a.call("inquiries", {
  customerId: c.id,
  subject: "QA tube inquiry",
  text: "Need 4 pieces SS304 tube 40x40x2mm, 6m.",
});
const quote = await a.call("documents", {
  kind: "QUOTATION",
  customerId: c.id,
  inquiryId: inquiry.id,
  lines: [
    {
      productId: product.id,
      description: product.name,
      quantity: "4",
      unit: "piece",
      unitPrice: "48.00",
    },
  ],
  taxRate: "10",
  discount: "2",
});
assert.equal(quote.total, "209");
await a.call(`documents/${quote.id}/convert`, { kind: "ORDER" }, "POST", 409);
for (const status of ["PENDING_APPROVAL", "APPROVED", "SENT", "ACCEPTED"])
  await a.call(`documents/${quote.id}/status`, { status });
const order = await a.call(`documents/${quote.id}/convert`, { kind: "ORDER" });
assert.equal(
  (await a.call(`documents/${quote.id}/convert`, { kind: "ORDER" })).id,
  order.id,
);
await a.call(`documents/${order.id}/status`, { status: "CONFIRMED" });
await a.call(`orders/${order.id}/reserve`, { warehouseId: warehouse.id });
let balance = (await a.call("inventory")).items.find(
  (r: any) => r.productId === product.id,
);
assert.equal(balance.reserved, "4");
assert.equal(balance.available, "6");
const fulfillment = {
  idempotencyKey: randomUUID(),
  warehouseId: warehouse.id,
  lines: [{ productId: product.id, quantity: "2" }],
};
const firstFulfillment = await a.call(
  `orders/${order.id}/fulfill`,
  fulfillment,
);
assert.equal(
  (await a.call(`orders/${order.id}/fulfill`, fulfillment)).id,
  firstFulfillment.id,
);
balance = (await a.call("inventory")).items.find(
  (r: any) => r.productId === product.id,
);
assert.equal(balance.onHand, "8");
assert.equal(balance.reserved, "2");
await a.call(`orders/${order.id}/fulfill`, {
  idempotencyKey: randomUUID(),
  warehouseId: warehouse.id,
  lines: [{ productId: product.id, quantity: "2" }],
});
const invoice = await a.call(`documents/${order.id}/convert`, {
  kind: "INVOICE",
});
await a.call(`documents/${invoice.id}/status`, { status: "ISSUED" });
const key = randomUUID(),
  payment = {
    invoiceId: invoice.id,
    amount: "100.00",
    reference: "QA bank reference",
    method: "BANK",
    idempotencyKey: key,
  };
const paid = await a.call("payments", payment);
assert.equal((await a.call("payments", payment)).id, paid.id);
await a.call("payments", { ...payment, amount: "101" }, "POST", 409);
await a.call("payments", {
  ...payment,
  amount: "109",
  idempotencyKey: randomUUID(),
});
const metrics = await a.call("analytics");
assert.equal(metrics.revenue, "190.00");
assert.equal(metrics.receivables, "0.00");
const supplier = await a.call("suppliers", { name: "Fictional Alloy QA" }),
  po = await a.call("documents", {
    kind: "PURCHASE",
    supplierId: supplier.id,
    lines: [
      {
        productId: product.id,
        description: "Tube",
        quantity: "5",
        unit: "piece",
        unitPrice: "30",
      },
    ],
  });
for (const status of ["PENDING_APPROVAL", "APPROVED"])
  await a.call(`documents/${po.id}/status`, { status });
const receipt = {
  warehouseId: warehouse.id,
  lines: [{ productId: product.id, quantity: "2" }],
  idempotencyKey: randomUUID(),
};
const r = await a.call(`purchases/${po.id}/receive`, receipt);
assert.equal((await a.call(`purchases/${po.id}/receive`, receipt)).id, r.id);
await a.call(
  `purchases/${po.id}/receive`,
  {
    ...receipt,
    idempotencyKey: randomUUID(),
    lines: [{ productId: product.id, quantity: "4" }],
  },
  "POST",
  409,
);
await a.call(`purchases/${po.id}/receive`, {
  ...receipt,
  idempotencyKey: randomUUID(),
  lines: [{ productId: product.id, quantity: "3" }],
});
const orders: any[] = [];
for (let n = 0; n < 2; n++) {
  const d = await a.call("documents", {
    kind: "ORDER",
    customerId: c.id,
    lines: [
      {
        productId: product.id,
        description: "Tube",
        quantity: "8",
        unit: "piece",
        unitPrice: "48",
      },
    ],
  });
  await a.call(`documents/${d.id}/status`, { status: "CONFIRMED" });
  orders.push(d);
}
const concurrent = await Promise.all(
  orders.map((d) =>
    fetch(`${base}/api/v1/orders/${d.id}/reserve`, {
      method: "POST",
      headers: {
        Origin: origin,
        Cookie: a.cookie,
        "X-Organization-ID": a.org,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ warehouseId: warehouse.id }),
    }),
  ),
);
assert.equal(concurrent.filter((r) => r.ok).length, 1);
assert.equal(concurrent.filter((r) => r.status === 409).length, 1);
const email = `viewer-${suffix}@example.invalid`;
await viewer.call("auth/sign-up/email", {
  name: "QA Viewer",
  email,
  password: `Test-only-${randomUUID()}!`,
});
const invite = await a.call("invitations", { email, role: "VIEWER" });
await viewer.call("invitations/accept", {
  token: new URL(invite.url).searchParams.get("invitation"),
});
viewer.org = a.org;
await viewer.call("customers", { name: "Forbidden" }, "POST", 403);
assert.equal("cost" in (await viewer.call("products")).items[0], false);
const own = a.org;
a.org = b.org;
await a.call("customers", undefined, "GET", 403);
a.org = own;
const project = await a.call("projects", {
  name: "QA Project",
  customerId: c.id,
  budget: "5000",
});
await a.call("tasks", { name: "Measure site", projectId: project.id });
await a.call("expenses", {
  name: "Site visit",
  category: "Labor",
  amount: "25",
  date: new Date().toISOString(),
  projectId: project.id,
});

const secondWarehouse = await a.call("warehouses", { name: "QA Annex" });
const transfer = {
  productId: product.id,
  fromWarehouseId: warehouse.id,
  toWarehouseId: secondWarehouse.id,
  quantity: "1",
  reason: "QA warehouse transfer",
  idempotencyKey: randomUUID(),
};
const moved = await a.call("inventory/transfer", transfer);
assert.equal((await a.call("inventory/transfer", transfer)).id, moved.id);
const imported = await a.call("imports/customers", {
  rows: [{ name: "Imported QA customer" }],
  idempotencyKey: randomUUID(),
});
assert.equal(imported.count, 1);
await a.call(
  "imports/customers",
  { rows: [{ name: "Imported QA customer" }], idempotencyKey: randomUUID() },
  "POST",
  409,
);
const change = await a.call("change-orders", {
  projectId: project.id,
  name: "Extra scope",
  reason: "Additional test scope",
  amount: "500",
});
await a.call(`change-orders/${change.id}/approve`, {});
await a.call(`change-orders/${change.id}/approve`, {});
assert.equal(
  (await a.call("projects")).items.find((p: any) => p.id === project.id).budget,
  "5500",
);
const adminInvite = await a.call("invitations", {
  email: `warehouse-${suffix}@example.invalid`,
  role: "WAREHOUSE_MANAGER",
});
const warehouseUser = new Client();
await warehouseUser.call("auth/sign-up/email", {
  name: "Warehouse QA",
  email: `warehouse-${suffix}@example.invalid`,
  password: `Test-only-${randomUUID()}!`,
});
await warehouseUser.call("invitations/accept", {
  token: new URL(adminInvite.url).searchParams.get("invitation"),
});
warehouseUser.org = a.org;
assert.equal(
  "cost" in
    (await warehouseUser.call(
      `products/${product.id}`,
      { name: "Updated tube" },
      "PATCH",
    )),
  false,
);
await warehouseUser.call(`products/${product.id}`, { cost: "1" }, "PATCH", 403);
await a.call(
  "documents",
  {
    kind: "PURCHASE",
    supplierId: supplier.id,
    customerId: c.id,
    lines: [{ description: "x", quantity: "1", unit: "piece", unitPrice: "1" }],
  },
  "POST",
  400,
);
const reservedOrder = orders[concurrent.findIndex((r) => r.ok)];
await a.call(`documents/${reservedOrder.id}/convert`, { kind: "INVOICE" });
await a.call(
  `documents/${reservedOrder.id}/status`,
  { status: "CANCELLED" },
  "POST",
  409,
);

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=",
  "base64",
);
const form = new FormData();
form.set("file", new Blob([png], { type: "image/png" }), "drawing.png");
const uploaded = await fetch(`${base}/api/v1/files`, {
  method: "POST",
  headers: { Origin: origin, Cookie: a.cookie, "X-Organization-ID": a.org },
  body: form,
});
assert.equal(uploaded.status, 201);
const file = await uploaded.json();
const forbiddenFile = await fetch(`${base}/api/v1/files/${file.id}`, {
  headers: { Cookie: b.cookie, "X-Organization-ID": b.org },
});
assert.equal(forbiddenFile.status, 404);
const unauthUpload = await fetch(`${base}/api/v1/files`, {
  method: "POST",
  headers: { Origin: origin },
  body: form,
});
assert.equal(unauthUpload.status, 401);
const csrf = await fetch(`${base}/api/v1/customers`, {
  method: "POST",
  headers: {
    Origin: "https://attacker.invalid",
    Cookie: a.cookie,
    "X-Organization-ID": a.org,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ name: "CSRF" }),
});
assert.equal(csrf.status, 403);
const pdf = await fetch(`${base}/api/v1/documents/${quote.id}/pdf`, {
  headers: { Cookie: a.cookie, "X-Organization-ID": a.org },
});
assert.equal(pdf.status, 200);
assert.ok(
  Buffer.from(await pdf.arrayBuffer())
    .subarray(0, 5)
    .equals(Buffer.from("%PDF-")),
);
console.log(
  JSON.stringify(
    {
      result: "PASS",
      checks: [
        "auth",
        "organization onboarding",
        "cross-tenant deny",
        "customer/product/inquiry persistence",
        "quote lifecycle",
        "idempotent conversion",
        "reservation",
        "partial fulfillment",
        "invoice",
        "payment replay and reconciliation",
        "purchase partial receiving",
        "concurrent stock contention",
        "viewer RBAC",
        "cost redaction",
        "projects/tasks/expenses",
      ],
      organizations: [a.org, b.org],
    },
    null,
    2,
  ),
);
