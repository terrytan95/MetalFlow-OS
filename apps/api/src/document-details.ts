import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Decimal } from "decimal.js";
import { db } from "../../../packages/database/index.js";
import {
  availableTransitions,
  can,
  stockLines,
  transitionPermission,
  type Line,
} from "../../../packages/shared/src/domain.js";
import type { Context } from "./context.js";

export function checkDocumentRead(c: Context, kind: string) {
  if (
    (kind === "PURCHASE" && !can(c.role, "cost:read")) ||
    (kind === "INVOICE" &&
      !can(c.role, "finance:read") &&
      !can(c.role, "sales:write"))
  )
    throw new ForbiddenException();
}

export async function documentDetails(c: Context, id: string) {
  const d = await db.document.findFirst({
    where: { id, organizationId: c.organizationId },
  });
  if (!d) throw new NotFoundException();
  checkDocumentRead(c, d.kind);
  const [reservations, receipts, invoice] = await Promise.all([
    d.kind === "ORDER"
      ? db.reservation.findMany({
          where: { organizationId: c.organizationId, orderId: id },
        })
      : [],
    d.kind === "PURCHASE"
      ? db.inventoryMovement.groupBy({
          by: ["productId"],
          where: {
            organizationId: c.organizationId,
            kind: "RECEIPT",
            reference: id,
          },
          _sum: { quantity: true },
        })
      : [],
    d.kind === "ORDER"
      ? db.document.findFirst({
          where: {
            organizationId: c.organizationId,
            kind: "INVOICE",
            sourceId: id,
          },
          select: { id: true },
        })
      : null,
  ]);
  const stock = stockLines(d.lines as Line[]);
  const received = new Map(
    receipts.map((r) => [r.productId, r._sum.quantity?.toString() || "0"]),
  );
  const stockProgress =
    d.kind === "ORDER" && reservations.length
      ? reservations.map((r) => ({
          ...stock.find((l) => l.productId === r.productId),
          productId: r.productId,
          warehouseId: r.warehouseId,
          ordered: r.quantity.toString(),
          completed: r.fulfilled.toString(),
          remaining: r.quantity.minus(r.fulfilled).toString(),
        }))
      : stock.map((l) => ({
          ...l,
          warehouseId: null,
          ordered: l.quantity,
          completed: received.get(l.productId) || "0",
          remaining: new Decimal(l.quantity)
            .minus(received.get(l.productId) || "0")
            .toString(),
        }));
  const warehouses = await db.warehouse.findMany({
    where: {
      organizationId: c.organizationId,
      ...(d.kind === "ORDER" && d.status !== "CONFIRMED"
        ? { id: { in: reservations.map((r) => r.warehouseId) } }
        : {}),
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return {
    ...d,
    stockProgress,
    warehouses,
    allowedTransitions: availableTransitions(
      { ...d, lines: d.lines as Line[] },
      !!invoice,
    ).filter((status) => can(c.role, transitionPermission(d.kind, status))),
  };
}
