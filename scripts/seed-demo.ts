import { randomUUID } from "node:crypto";
import { db } from "../packages/database/index.js";
import { auth } from "../apps/api/src/auth.js";
import {
  createDocument,
  transition,
  convertDocument,
  recordPayment,
} from "../apps/api/src/commerce.js";
if (process.env.DEMO_MODE !== "true")
  throw Error(
    "Set DEMO_MODE=true only for an explicitly identified demo environment",
  );
const email = process.env.DEMO_EMAIL,
  password = process.env.DEMO_PASSWORD;
if (!email || !password || password.length < 12)
  throw Error("Set DEMO_EMAIL and DEMO_PASSWORD (12+ chars)");
if (await db.user.findUnique({ where: { email } }))
  throw Error("Demo user already exists; seed does not overwrite records");
const signed = await auth.api.signUpEmail({
  body: { email, password, name: "Demo Operator" },
});
const org = await db.organization.create({
  data: {
    name: "DEMO · Foundry Supply Co. (fictional)",
    currency: "USD",
    country: "US",
    businessType: "MIXED",
    settings: { demo: true },
  },
});
await db.membership.create({
  data: { userId: signed.user.id, organizationId: org.id, role: "OWNER" },
});
const c = { organizationId: org.id, userId: signed.user.id, role: "OWNER" };
const customers = await Promise.all(
  [
    "Harbor Workshop (fictional)",
    "Northline Interiors (fictional)",
    "Cedar Build (fictional)",
  ].map((name) =>
    db.customer.create({
      data: { name, organizationId: org.id, createdBy: c.userId },
    }),
  ),
);
const warehouse = await db.warehouse.create({
  data: {
    name: "Demo main warehouse",
    organizationId: org.id,
    createdBy: c.userId,
  },
});
const products = await Promise.all(
  [
    {
      sku: "DEMO-SS304-SQ40",
      name: "SS304 square tube 40×40×2 mm",
      material: "Stainless steel",
      grade: "304",
      profile: "square-tube",
      price: "48",
      cost: "30",
    },
    {
      sku: "DEMO-AL6063-PL3",
      name: "Aluminum 6063 plate 3 mm",
      material: "Aluminum",
      grade: "6063",
      profile: "plate",
      price: "120",
      cost: "80",
    },
  ].map((p) =>
    db.product.create({
      data: {
        ...p,
        organizationId: org.id,
        createdBy: c.userId,
        unit: "piece",
        reorderPoint: "20",
      },
    }),
  ),
);
for (const p of products) {
  await db.inventoryBalance.create({
    data: {
      organizationId: org.id,
      warehouseId: warehouse.id,
      productId: p.id,
      onHand: "120",
    },
  });
  await db.inventoryMovement.create({
    data: {
      organizationId: org.id,
      warehouseId: warehouse.id,
      productId: p.id,
      quantity: "120",
      kind: "DEMO_SEED",
      reference: "Fictional opening stock",
      createdBy: c.userId,
    },
  });
}
const supplier = await db.supplier.create({
  data: {
    organizationId: org.id,
    name: "Alloy Source (fictional)",
    createdBy: c.userId,
  },
});
for (let i = 0; i < 3; i++) {
  const inquiry = await db.inquiry.create({
    data: {
      organizationId: org.id,
      customerId: customers[i].id,
      subject: [
        "Lobby handrail materials",
        "Retail fit-out aluminum panels",
        "Balcony fabrication",
      ][i],
      text: "Synthetic demo inquiry. Prices are fictional, not market prices.",
      createdBy: c.userId,
    },
  });
  const quote = await createDocument(c, {
    kind: "QUOTATION",
    customerId: customers[i].id,
    inquiryId: inquiry.id,
    lines: [
      {
        productId: products[i % 2].id,
        description: products[i % 2].name,
        quantity: String(10 + i * 5),
        unit: "piece",
        unitPrice: products[i % 2].price.toString(),
      },
    ],
    taxRate: "5",
  });
  if (i === 0) {
    for (const status of ["PENDING_APPROVAL", "APPROVED", "SENT", "ACCEPTED"])
      await transition(c, quote.id, status);
    const order = await convertDocument(c, quote.id, "ORDER");
    await transition(c, order.id, "CONFIRMED");
    const invoice = await convertDocument(c, order.id, "INVOICE");
    await transition(c, invoice.id, "ISSUED");
    await recordPayment(c, {
      invoiceId: invoice.id,
      amount: "200",
      reference: "Fictional demo payment",
      method: "BANK",
      idempotencyKey: randomUUID(),
    });
  }
  await db.project.create({
    data: {
      organizationId: org.id,
      customerId: customers[i].id,
      name: ["Harbor office fit-out", "Northline showroom", "Cedar residence"][
        i
      ],
      status: "ACTIVE",
      budget: String(5000 + i * 1000),
      createdBy: c.userId,
    },
  });
}
await createDocument(c, {
  kind: "PURCHASE",
  supplierId: supplier.id,
  lines: [
    {
      productId: products[0].id,
      description: products[0].name,
      quantity: "50",
      unit: "piece",
      unitPrice: "30",
    },
  ],
});
console.log("Created explicitly fictional demo organization:", org.id);
await db.$disconnect();
