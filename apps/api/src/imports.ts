import { BadRequestException, ConflictException } from "@nestjs/common";
import { Decimal } from "decimal.js";
import { Prisma } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { schemas } from "./resources.js";
import { serial, owned, audit, type Context } from "./context.js";
import { positive } from "../../../packages/shared/src/domain.js";
export async function importRecords(
  c: Context,
  resource: string,
  raw: unknown,
) {
  const x = z
    .object({
      rows: z.array(z.record(z.string(), z.unknown())).min(1).max(500),
      warehouseId: z.string().optional(),
      idempotencyKey: z.string().uuid(),
    })
    .parse(raw);
  const hash = createHash("sha256")
    .update(
      JSON.stringify({ resource, rows: x.rows, warehouseId: x.warehouseId }),
    )
    .digest("hex");
  return serial(async (tx) => {
    const prior = await tx.importBatch.findUnique({
      where: {
        organizationId_idempotencyKey: {
          organizationId: c.organizationId,
          idempotencyKey: x.idempotencyKey,
        },
      },
    });
    if (prior) {
      if (prior.requestHash !== hash)
        throw new ConflictException("Import key conflicts with previous input");
      return prior;
    }
    if (resource === "inventory") {
      if (!x.warehouseId) throw new BadRequestException("Warehouse required");
      await owned(tx, "warehouse", c, x.warehouseId);
    }
    const rows = x.rows.map((row) =>
      Object.fromEntries(Object.entries(row).filter(([, v]) => v !== "")),
    );
    if (resource === "customers") {
      const parsed = rows.map((row) => schemas.customers.parse(row));
      const names = parsed.map((r) => r.name.toLowerCase());
      if (new Set(names).size !== names.length)
        throw new ConflictException("Duplicate customer names in import");
      const existing = await tx.$queryRaw<{ name: string }[]>(
        Prisma.sql`SELECT name FROM "Customer" WHERE "organizationId"=${c.organizationId} AND lower(name) IN (${Prisma.join(names)}) LIMIT 1`,
      );
      if (existing.length)
        throw new ConflictException(
          `Customer ${existing[0].name} already exists; no records merged`,
        );
      await tx.customer.createMany({
        data: parsed.map((row) => ({
          ...row,
          organizationId: c.organizationId,
          createdBy: c.userId,
        })),
      });
    } else if (resource === "products") {
      const parsed = rows.map((row) => schemas.products.parse(row));
      await tx.product.createMany({
        data: parsed.map((row) => ({
          ...row,
          organizationId: c.organizationId,
          createdBy: c.userId,
        })),
      });
    } else if (resource === "inventory") {
      const parsed = rows.map((row) =>
        z.object({ sku: z.string(), quantity: positive }).parse(row),
      );
      const products = await tx.product.findMany({
        where: {
          organizationId: c.organizationId,
          sku: { in: parsed.map((r) => r.sku) },
        },
        select: { id: true, sku: true },
      });
      const bySku = new Map(products.map((p) => [p.sku, p.id]));
      const quantities = new Map<string, Decimal>();
      for (const row of parsed) {
        const id = bySku.get(row.sku);
        if (!id) throw new BadRequestException(`Unknown SKU: ${row.sku}`);
        quantities.set(
          id,
          (quantities.get(id) || new Decimal(0)).plus(row.quantity),
        );
      }
      const values = [...quantities].map(
        ([productId, quantity]) =>
          Prisma.sql`(${randomUUID()},${c.organizationId},${productId},${x.warehouseId},${quantity.toString()}::numeric,0,CURRENT_TIMESTAMP)`,
      );
      await tx.$executeRaw(
        Prisma.sql`INSERT INTO "InventoryBalance"(id,"organizationId","productId","warehouseId","onHand",reserved,"updatedAt") VALUES ${Prisma.join(values)} ON CONFLICT("organizationId","productId","warehouseId") DO UPDATE SET "onHand"="InventoryBalance"."onHand"+EXCLUDED."onHand","updatedAt"=CURRENT_TIMESTAMP`,
      );
      await tx.inventoryMovement.createMany({
        data: [...quantities].map(([productId, quantity]) => ({
          organizationId: c.organizationId,
          productId,
          warehouseId: x.warehouseId!,
          quantity: quantity.toString(),
          kind: "IMPORT",
          reference: x.idempotencyKey,
          createdBy: c.userId,
        })),
      });
    } else throw new BadRequestException("Unsupported import resource");
    const out = await tx.importBatch.create({
      data: {
        organizationId: c.organizationId,
        resource,
        requestHash: hash,
        idempotencyKey: x.idempotencyKey,
        count: x.rows.length,
        createdBy: c.userId,
      },
    });
    await audit(tx, c, "import." + resource, out.id, { count: x.rows.length });
    return out;
  });
}
