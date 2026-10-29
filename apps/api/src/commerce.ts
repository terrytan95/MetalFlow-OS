import { snapshotCost } from "./costs.js";
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { Decimal } from "decimal.js";
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import {
  documentSchema,
  totals,
  type Line,
} from "../../../packages/shared/src/domain.js";
import { audit, json, owned, serial, type Context } from "./context.js";
export async function createDocument(c: Context, raw: unknown) {
  const x = documentSchema.parse(raw);
  return serial(async (tx) => {
    if (x.kind === "PURCHASE") {
      if (!x.supplierId) throw new BadRequestException("Supplier required");
      await owned(tx, "supplier", c, x.supplierId);
    } else {
      if (!x.customerId) throw new BadRequestException("Customer required");
      await owned(tx, "customer", c, x.customerId);
    }
    if (x.inquiryId) {
      const inquiry = await tx.inquiry.findFirst({
        where: {
          id: x.inquiryId,
          organizationId: c.organizationId,
          customerId: x.customerId,
        },
      });
      if (!inquiry) throw new BadRequestException("Inquiry customer mismatch");
      if (inquiry.extraction && !inquiry.reviewed)
        throw new BadRequestException("Review AI extraction first");
    }
    for (const line of x.lines)
      if (line.productId) {
        const p = await tx.product.findFirst({
          where: { id: line.productId, organizationId: c.organizationId },
        });
        if (!p || p.unit !== line.unit)
          throw new BadRequestException("Product or unit mismatch");
      }
    const org = await tx.organization.findUniqueOrThrow({
      where: { id: c.organizationId },
    });
    const prefix = {
      QUOTATION: "QT",
      ORDER: "SO",
      PURCHASE: "PO",
      INVOICE: "INV",
    }[x.kind];
    const doc = await tx.document.create({
      data: {
        organizationId: c.organizationId,
        createdBy: c.userId,
        ...x,
        lines: json(x.lines),
        ...totals(x.lines, x.discount, x.taxRate),
        currency: org.currency,
        number: `${prefix}-${new Date().getUTCFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`,
      },
    });
    if (x.kind !== "PURCHASE")
      await snapshotCost(tx, c.organizationId, doc.id, x.lines);
    await tx.documentVersion.create({
      data: {
        organizationId: c.organizationId,
        documentId: doc.id,
        version: 1,
        snapshot: json(doc),
        createdBy: c.userId,
      },
    });
    await audit(tx, c, `${x.kind.toLowerCase()}.create`, doc.id);
    return doc;
  });
}
const transitions: Record<string, Record<string, string[]>> = {
  QUOTATION: {
    DRAFT: ["PENDING_APPROVAL"],
    PENDING_APPROVAL: ["APPROVED", "REJECTED"],
    APPROVED: ["SENT"],
    SENT: ["ACCEPTED", "REJECTED"],
    ACCEPTED: [],
    REJECTED: [],
  },
  ORDER: {
    DRAFT: ["CONFIRMED", "CANCELLED"],
    CONFIRMED: ["CANCELLED"],
    RESERVED: ["PROCESSING", "CANCELLED"],
    PROCESSING: ["CANCELLED"],
    PARTIALLY_FULFILLED: [],
  },
  PURCHASE: {
    DRAFT: ["PENDING_APPROVAL", "CANCELLED"],
    PENDING_APPROVAL: ["APPROVED", "REJECTED"],
    APPROVED: ["SENT", "CANCELLED"],
    SENT: ["CANCELLED"],
  },
  INVOICE: { DRAFT: ["ISSUED"], ISSUED: [] },
};
export async function transition(c: Context, id: string, status: string) {
  return serial(async (tx) => {
    const d = await tx.document.findFirst({
      where: { id, organizationId: c.organizationId },
    });
    if (!d) throw new NotFoundException();
    if (!transitions[d.kind]?.[d.status]?.includes(status))
      throw new ConflictException(`Cannot change ${d.status} to ${status}`);
    if (status === "CANCELLED" && d.kind === "ORDER") {
      if (
        await tx.document.findFirst({
          where: {
            organizationId: c.organizationId,
            sourceId: id,
            kind: "INVOICE",
          },
        })
      )
        throw new ConflictException(
          "Cannot cancel an invoiced order; reconcile its invoice first",
        );
      const r = await tx.reservation.findMany({
        where: { organizationId: c.organizationId, orderId: id },
      });
      for (const v of r) {
        await tx.inventoryBalance.update({
          where: {
            organizationId_productId_warehouseId: {
              organizationId: c.organizationId,
              productId: v.productId,
              warehouseId: v.warehouseId,
            },
          },
          data: { reserved: { decrement: v.quantity.minus(v.fulfilled) } },
        });
      }
      await tx.reservation.deleteMany({
        where: { organizationId: c.organizationId, orderId: id },
      });
    }
    const out = await tx.document.update({ where: { id }, data: { status } });
    await audit(tx, c, `${d.kind.toLowerCase()}.${status.toLowerCase()}`, id);
    return out;
  });
}
export async function convertDocument(
  c: Context,
  id: string,
  kind: "ORDER" | "INVOICE",
) {
  return serial(async (tx) => {
    const d = await tx.document.findFirst({
      where: { id, organizationId: c.organizationId },
    });
    if (!d) throw new NotFoundException();
    const existing = await tx.document.findFirst({
      where: { organizationId: c.organizationId, kind, sourceId: id },
    });
    if (existing) return existing;
    if (
      kind === "ORDER" &&
      (d.kind !== "QUOTATION" ||
        d.status !== "ACCEPTED" ||
        (d.validUntil && d.validUntil < new Date()))
    )
      throw new ConflictException(
        "An accepted, unexpired quotation is required",
      );
    if (
      kind === "INVOICE" &&
      (d.kind !== "ORDER" ||
        ![
          "CONFIRMED",
          "RESERVED",
          "PROCESSING",
          "PARTIALLY_FULFILLED",
          "FULFILLED",
        ].includes(d.status))
    )
      throw new ConflictException("Confirm the order first");
    const out = await tx.document.create({
      data: {
        organizationId: c.organizationId,
        kind,
        sourceId: id,
        customerId: d.customerId,
        number: `${kind === "ORDER" ? "SO" : "INV"}-${randomUUID().slice(0, 8).toUpperCase()}`,
        currency: d.currency,
        notes: d.notes,
        subtotal: d.subtotal,
        discount: d.discount,
        taxRate: d.taxRate,
        tax: d.tax,
        total: d.total,
        lines: json(d.lines),
        createdBy: c.userId,
      },
    });
    const cost = await tx.commercialCost.findFirst({
      where: { organizationId: c.organizationId, documentId: id },
    });
    if (cost)
      await tx.commercialCost.create({
        data: {
          organizationId: c.organizationId,
          documentId: out.id,
          totalCost: cost.totalCost,
          complete: cost.complete,
        },
      });
    if (kind === "ORDER") {
      await tx.document.update({
        where: { id },
        data: { status: "CONVERTED" },
      });
      if (d.inquiryId)
        await tx.inquiry.updateMany({
          where: { id: d.inquiryId, organizationId: c.organizationId },
          data: { status: "CONVERTED" },
        });
    }
    await audit(tx, c, `document.convert.${kind.toLowerCase()}`, id, {
      target: out.id,
    });
    return out;
  });
}
export async function reserve(c: Context, id: string, warehouseId: string) {
  return serial(async (tx) => {
    await owned(tx, "warehouse", c, warehouseId);
    const order = await tx.document.findFirst({
      where: { id, organizationId: c.organizationId, kind: "ORDER" },
    });
    if (!order || order.status !== "CONFIRMED")
      throw new ConflictException(
        "Order must be confirmed and not yet reserved",
      );
    const grouped = new Map<string, Decimal>();
    for (const l of order.lines as Line[])
      if (l.productId)
        grouped.set(
          l.productId,
          (grouped.get(l.productId) || new Decimal(0)).plus(l.quantity),
        );
    if (!grouped.size)
      throw new BadRequestException("No stocked products in order");
    for (const [productId, quantity] of grouped) {
      const b = await tx.inventoryBalance.findUnique({
        where: {
          organizationId_productId_warehouseId: {
            organizationId: c.organizationId,
            productId,
            warehouseId,
          },
        },
      });
      if (!b || b.onHand.minus(b.reserved).lt(quantity.toString()))
        throw new ConflictException("Insufficient available stock");
      await tx.inventoryBalance.update({
        where: { id: b.id },
        data: { reserved: { increment: quantity.toString() } },
      });
      await tx.reservation.create({
        data: {
          organizationId: c.organizationId,
          orderId: id,
          productId,
          warehouseId,
          quantity: quantity.toString(),
        },
      });
    }
    await audit(tx, c, "inventory.reserve", id);
    return tx.document.update({ where: { id }, data: { status: "RESERVED" } });
  });
}
export const fulfillmentSchema = z.object({
  lines: z
    .array(
      z.object({
        productId: z.string(),
        quantity: z
          .string()
          .regex(/^\d+(\.\d{1,4})?$/)
          .refine((v) => new Decimal(v).gt(0)),
      }),
    )
    .min(1),
  warehouseId: z.string(),
});
export async function fulfill(c: Context, id: string, raw: unknown) {
  const x = fulfillmentSchema
    .extend({ idempotencyKey: z.string().uuid() })
    .parse(raw);
  return serial(async (tx) => {
    const prior = await tx.fulfillment.findUnique({
      where: {
        organizationId_idempotencyKey: {
          organizationId: c.organizationId,
          idempotencyKey: x.idempotencyKey,
        },
      },
    });
    if (prior) {
      if (
        prior.orderId !== id ||
        prior.warehouseId !== x.warehouseId ||
        !isDeepStrictEqual(prior.lines, x.lines)
      )
        throw new ConflictException("Idempotency key conflict");
      return prior;
    }

    const d = await tx.document.findFirst({
      where: { id, organizationId: c.organizationId, kind: "ORDER" },
    });
    if (
      !d ||
      !["RESERVED", "PROCESSING", "PARTIALLY_FULFILLED"].includes(d.status)
    )
      throw new ConflictException("Reserve stock before fulfillment");
    for (const l of x.lines) {
      const r = await tx.reservation.findUnique({
        where: {
          organizationId_orderId_productId_warehouseId: {
            organizationId: c.organizationId,
            orderId: id,
            productId: l.productId,
            warehouseId: x.warehouseId,
          },
        },
      });
      if (!r || r.quantity.minus(r.fulfilled).lt(l.quantity))
        throw new ConflictException("Quantity exceeds reservation");
      await tx.reservation.update({
        where: { id: r.id },
        data: { fulfilled: { increment: l.quantity } },
      });
      await tx.inventoryBalance.update({
        where: {
          organizationId_productId_warehouseId: {
            organizationId: c.organizationId,
            productId: l.productId,
            warehouseId: x.warehouseId,
          },
        },
        data: {
          onHand: { decrement: l.quantity },
          reserved: { decrement: l.quantity },
        },
      });
      await tx.inventoryMovement.create({
        data: {
          organizationId: c.organizationId,
          productId: l.productId,
          warehouseId: x.warehouseId,
          quantity: new Decimal(l.quantity).negated().toString(),
          kind: "FULFILLMENT",
          reference: id,
          createdBy: c.userId,
        },
      });
    }
    const all = await tx.reservation.findMany({
      where: { organizationId: c.organizationId, orderId: id },
    });
    const status = all.every((r) => r.fulfilled.eq(r.quantity))
      ? "FULFILLED"
      : "PARTIALLY_FULFILLED";
    await audit(tx, c, "order.fulfill", id);
    await tx.document.update({ where: { id }, data: { status } });
    return tx.fulfillment.create({
      data: {
        organizationId: c.organizationId,
        orderId: id,
        warehouseId: x.warehouseId,
        lines: json(x.lines),
        idempotencyKey: x.idempotencyKey,
        status,
        createdBy: c.userId,
      },
    });
  });
}
export async function recordPayment(c: Context, raw: unknown) {
  const x = z
    .object({
      invoiceId: z.string(),
      amount: z
        .string()
        .regex(/^\d{1,12}(\.\d{1,2})?$/)
        .refine((v) => new Decimal(v).gt(0)),
      reference: z.string().min(1).max(200),
      method: z.enum(["BANK", "CASH", "CARD", "OTHER"]),
      idempotencyKey: z.string().uuid(),
    })
    .parse(raw);
  return serial(async (tx) => {
    const prior = await tx.payment.findUnique({
      where: {
        organizationId_idempotencyKey: {
          organizationId: c.organizationId,
          idempotencyKey: x.idempotencyKey,
        },
      },
    });
    if (prior) {
      if (
        prior.invoiceId !== x.invoiceId ||
        !prior.amount.eq(x.amount) ||
        prior.reference !== x.reference ||
        prior.method !== x.method
      )
        throw new ConflictException(
          "Idempotency key already used with different payment",
        );
      return prior;
    }
    const d = await tx.document.findFirst({
      where: {
        id: x.invoiceId,
        organizationId: c.organizationId,
        kind: "INVOICE",
        status: { in: ["ISSUED", "PARTIALLY_PAID"] },
      },
    });
    if (!d || d.total.minus(d.paid).lt(x.amount))
      throw new ConflictException(
        "Payment exceeds outstanding issued invoice balance",
      );
    const p = await tx.payment.create({
      data: { ...x, organizationId: c.organizationId, createdBy: c.userId },
    });
    const paid = d.paid.plus(x.amount);
    await tx.document.update({
      where: { id: d.id },
      data: { paid, status: paid.eq(d.total) ? "PAID" : "PARTIALLY_PAID" },
    });
    await audit(tx, c, "payment.record", p.id);
    return p;
  });
}
export async function receive(c: Context, id: string, raw: unknown) {
  const x = fulfillmentSchema
    .extend({ idempotencyKey: z.string().uuid() })
    .parse(raw);
  return serial(async (tx) => {
    const prior = await tx.goodsReceipt.findUnique({
      where: {
        organizationId_idempotencyKey: {
          organizationId: c.organizationId,
          idempotencyKey: x.idempotencyKey,
        },
      },
    });
    if (prior) {
      if (
        prior.purchaseId !== id ||
        prior.warehouseId !== x.warehouseId ||
        !isDeepStrictEqual(prior.lines, x.lines)
      )
        throw new ConflictException("Idempotency key conflict");
      return prior;
    }
    await owned(tx, "warehouse", c, x.warehouseId);
    const po = await tx.document.findFirst({
      where: {
        id,
        organizationId: c.organizationId,
        kind: "PURCHASE",
        status: { in: ["APPROVED", "SENT", "PARTIALLY_RECEIVED"] },
      },
    });
    if (!po) throw new ConflictException("Purchase must be approved");
    const receipts = await tx.goodsReceipt.findMany({
      where: { organizationId: c.organizationId, purchaseId: id },
    });
    const ordered = new Map<string, Decimal>(),
      received = new Map<string, Decimal>();
    for (const l of po.lines as Line[]) {
      if (!l.productId)
        throw new BadRequestException("Receiving requires catalog products");
      ordered.set(
        l.productId,
        (ordered.get(l.productId) || new Decimal(0)).plus(l.quantity),
      );
    }
    for (const receipt of receipts)
      for (const l of receipt.lines as {
        productId: string;
        quantity: string;
      }[])
        received.set(
          l.productId,
          (received.get(l.productId) || new Decimal(0)).plus(l.quantity),
        );
    for (const l of x.lines) {
      const total = (received.get(l.productId) || new Decimal(0)).plus(
        l.quantity,
      );
      if (!ordered.has(l.productId) || total.gt(ordered.get(l.productId)!))
        throw new ConflictException("Receipt exceeds ordered quantity");
      received.set(l.productId, total);
      await tx.inventoryBalance.upsert({
        where: {
          organizationId_productId_warehouseId: {
            organizationId: c.organizationId,
            productId: l.productId,
            warehouseId: x.warehouseId,
          },
        },
        create: {
          organizationId: c.organizationId,
          productId: l.productId,
          warehouseId: x.warehouseId,
          onHand: l.quantity,
        },
        update: { onHand: { increment: l.quantity } },
      });
      await tx.inventoryMovement.create({
        data: {
          organizationId: c.organizationId,
          productId: l.productId,
          warehouseId: x.warehouseId,
          quantity: l.quantity,
          kind: "RECEIPT",
          reference: id,
          createdBy: c.userId,
        },
      });
    }
    const out = await tx.goodsReceipt.create({
      data: {
        organizationId: c.organizationId,
        purchaseId: id,
        warehouseId: x.warehouseId,
        lines: json(x.lines),
        idempotencyKey: x.idempotencyKey,
        createdBy: c.userId,
      },
    });
    await tx.document.update({
      where: { id },
      data: {
        status: [...ordered].every(([p, q]) => received.get(p)?.eq(q))
          ? "RECEIVED"
          : "PARTIALLY_RECEIVED",
      },
    });
    await audit(tx, c, "purchase.receive", id);
    return out;
  });
}

export async function transferStock(c: Context, raw: unknown) {
  const x = z
    .object({
      productId: z.string(),
      fromWarehouseId: z.string(),
      toWarehouseId: z.string(),
      quantity: z
        .string()
        .regex(/^\d{1,12}(\.\d{1,4})?$/)
        .refine((v) => new Decimal(v).gt(0)),
      reason: z.string().min(5).max(300),
      idempotencyKey: z.string().uuid(),
    })
    .parse(raw);
  if (x.fromWarehouseId === x.toWarehouseId)
    throw new BadRequestException("Choose different warehouses");
  return serial(async (tx) => {
    const prior = await tx.stockTransfer.findUnique({
      where: {
        organizationId_idempotencyKey: {
          organizationId: c.organizationId,
          idempotencyKey: x.idempotencyKey,
        },
      },
    });
    if (prior) {
      if (
        prior.productId !== x.productId ||
        prior.fromWarehouseId !== x.fromWarehouseId ||
        prior.toWarehouseId !== x.toWarehouseId ||
        !prior.quantity.eq(x.quantity)
      )
        throw new ConflictException("Idempotency key conflict");
      return prior;
    }
    await owned(tx, "product", c, x.productId);
    await owned(tx, "warehouse", c, x.fromWarehouseId);
    await owned(tx, "warehouse", c, x.toWarehouseId);
    const from = await tx.inventoryBalance.findUnique({
      where: {
        organizationId_productId_warehouseId: {
          organizationId: c.organizationId,
          productId: x.productId,
          warehouseId: x.fromWarehouseId,
        },
      },
    });
    if (!from || from.onHand.minus(from.reserved).lt(x.quantity))
      throw new ConflictException("Insufficient available stock");
    await tx.inventoryBalance.update({
      where: { id: from.id },
      data: { onHand: { decrement: x.quantity } },
    });
    await tx.inventoryBalance.upsert({
      where: {
        organizationId_productId_warehouseId: {
          organizationId: c.organizationId,
          productId: x.productId,
          warehouseId: x.toWarehouseId,
        },
      },
      create: {
        organizationId: c.organizationId,
        productId: x.productId,
        warehouseId: x.toWarehouseId,
        onHand: x.quantity,
      },
      update: { onHand: { increment: x.quantity } },
    });
    const out = await tx.stockTransfer.create({
      data: { ...x, organizationId: c.organizationId, createdBy: c.userId },
    });
    for (const [warehouseId, quantity] of [
      [x.fromWarehouseId, new Decimal(x.quantity).negated().toString()],
      [x.toWarehouseId, x.quantity],
    ])
      await tx.inventoryMovement.create({
        data: {
          organizationId: c.organizationId,
          productId: x.productId,
          warehouseId,
          quantity,
          kind: "TRANSFER",
          reference: out.id,
          createdBy: c.userId,
        },
      });
    await audit(tx, c, "inventory.transfer", out.id);
    return out;
  });
}
