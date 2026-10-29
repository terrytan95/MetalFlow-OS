import { db } from "../packages/database/index.js";
import { randomUUID } from "node:crypto";
const id = process.env.BENCH_ORG || randomUUID();
if (!process.env.BENCH_ORG) {
  await db.organization.create({
    data: {
      id,
      name: "Synthetic performance fixture",
      currency: "USD",
      settings: { benchmark: true },
    },
  });
  const products = Array.from({ length: 10000 }, (_, i) => ({
    id: randomUUID(),
    organizationId: id,
    sku: `PERF-${String(i).padStart(5, "0")}`,
    name: `Synthetic product ${i}`,
    material: "Steel",
    profile: "sheet",
    price: "20",
    cost: "10",
    reorderPoint: "20",
    createdBy: "benchmark",
  }));
  await db.product.createMany({ data: products });
  const warehouses = Array.from({ length: 10 }, (_, i) => ({
    id: randomUUID(),
    organizationId: id,
    name: `Bench warehouse ${i}`,
    createdBy: "benchmark",
  }));
  await db.warehouse.createMany({ data: warehouses });
  for (const w of warehouses)
    await db.inventoryBalance.createMany({
      data: products.map((p) => ({
        organizationId: id,
        productId: p.id,
        warehouseId: w.id,
        onHand: "10",
      })),
    });
  const customers = Array.from({ length: 1000 }, (_, i) => ({
    id: randomUUID(),
    organizationId: id,
    name: `Bench customer ${i}`,
    createdBy: "benchmark",
  }));
  await db.customer.createMany({ data: customers });
  for (let offset = 0; offset < 50000; offset += 1000) {
    await db.document.createMany({
      data: Array.from({ length: 1000 }, (_, i) => ({
        organizationId: id,
        kind: (offset + i) % 2 ? "QUOTATION" : "INVOICE",
        number: `PERF-${offset + i}`,
        status: (offset + i) % 2 ? "DRAFT" : "ISSUED",
        customerId: customers[(offset + i) % 1000].id,
        currency: "USD",
        subtotal: "100",
        total: "100",
        lines: [
          {
            productId: products[(offset + i) % 10000].id,
            description: "Synthetic line",
            quantity: "5",
            unit: "sheet",
            unitPrice: "20",
          },
        ],
        createdBy: "benchmark",
      })),
    });
  }
}
console.log(JSON.stringify({ organizationId: id }));
await db.$disconnect();
