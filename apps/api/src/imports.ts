import { BadRequestException, ConflictException } from "@nestjs/common";
import { createHash } from "node:crypto";
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
    for (const rawRow of x.rows) {
      const data = Object.fromEntries(
        Object.entries(rawRow).filter(([, v]) => v !== ""),
      );
      if (resource === "customers") {
        const v = schemas.customers.parse(data);
        if (
          await tx.customer.findFirst({
            where: {
              organizationId: c.organizationId,
              name: { equals: v.name, mode: "insensitive" },
            },
          })
        )
          throw new ConflictException(
            `Customer ${v.name} already exists; no records merged`,
          );
        await tx.customer.create({
          data: { ...v, organizationId: c.organizationId, createdBy: c.userId },
        });
      } else if (resource === "products") {
        const v = schemas.products.parse(data);
        await tx.product.create({
          data: { ...v, organizationId: c.organizationId, createdBy: c.userId },
        });
      } else if (resource === "inventory") {
        const v = z.object({ sku: z.string(), quantity: positive }).parse(data);
        const product = await tx.product.findUnique({
          where: {
            organizationId_sku: {
              organizationId: c.organizationId,
              sku: v.sku,
            },
          },
        });
        if (!product) throw new BadRequestException(`Unknown SKU: ${v.sku}`);
        const key = {
          organizationId: c.organizationId,
          productId: product.id,
          warehouseId: x.warehouseId!,
        };
        await tx.inventoryBalance.upsert({
          where: { organizationId_productId_warehouseId: key },
          create: { ...key, onHand: v.quantity },
          update: { onHand: { increment: v.quantity } },
        });
        await tx.inventoryMovement.create({
          data: {
            ...key,
            quantity: v.quantity,
            kind: "IMPORT",
            reference: x.idempotencyKey,
            createdBy: c.userId,
          },
        });
      } else throw new BadRequestException("Unsupported import resource");
    }
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
