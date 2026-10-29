import { z } from "zod";
import { Decimal } from "decimal.js";
import { ConflictException } from "@nestjs/common";
import { serial, audit, type Context } from "./context.js";
export async function issueCredit(c: Context, raw: unknown) {
  const x = z
    .object({
      invoiceId: z.string(),
      amount: z
        .string()
        .regex(/^\d{1,12}(\.\d{1,2})?$/)
        .refine((v) => new Decimal(v).gt(0)),
      reason: z.string().min(5).max(500),
      idempotencyKey: z.string().uuid(),
    })
    .parse(raw);
  return serial(async (tx) => {
    const prior = await tx.creditNote.findUnique({
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
        prior.reason !== x.reason
      )
        throw new ConflictException("Idempotency key conflict");
      return prior;
    }
    const invoice = await tx.document.findFirst({
      where: {
        id: x.invoiceId,
        organizationId: c.organizationId,
        kind: "INVOICE",
        status: { in: ["ISSUED", "PARTIALLY_PAID"] },
      },
    });
    if (
      !invoice ||
      invoice.total.minus(invoice.paid).minus(invoice.credited).lt(x.amount)
    )
      throw new ConflictException("Credit exceeds unpaid invoice balance");
    const out = await tx.creditNote.create({
      data: { ...x, organizationId: c.organizationId, createdBy: c.userId },
    });
    const credited = invoice.credited.plus(x.amount);
    await tx.document.update({
      where: { id: invoice.id },
      data: {
        credited,
        status: invoice.paid.plus(credited).eq(invoice.total)
          ? "CREDITED"
          : invoice.status,
      },
    });
    await audit(tx, c, "invoice.credit", invoice.id, {
      creditId: out.id,
      amount: x.amount,
    });
    return out;
  });
}
