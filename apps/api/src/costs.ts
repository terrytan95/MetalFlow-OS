import { Decimal } from "decimal.js";
import type { Prisma } from "@prisma/client";
import type { Line } from "../../../packages/shared/src/domain.js";
export async function snapshotCost(
  tx: Prisma.TransactionClient,
  organizationId: string,
  documentId: string,
  lines: Line[],
) {
  const products = await tx.product.findMany({
    where: {
      organizationId,
      id: { in: lines.flatMap((l) => (l.productId ? [l.productId] : [])) },
    },
    select: { id: true, cost: true, unit: true },
  });
  let total = new Decimal(0),
    complete = true;
  for (const l of lines) {
    const p = products.find((p) => p.id === l.productId);
    if (!p || p.unit !== l.unit) {
      complete = false;
      continue;
    }
    total = total.plus(new Decimal(p.cost.toString()).mul(l.quantity));
  }
  return tx.commercialCost.upsert({
    where: { documentId },
    create: {
      organizationId,
      documentId,
      totalCost: total.toFixed(2),
      complete,
    },
    update: { totalCost: total.toFixed(2), complete },
  });
}
