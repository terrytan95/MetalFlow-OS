import {
  capabilities,
  resolveProvider,
} from "../../../packages/ai/src/pool.js";
import { snapshotCost } from "./costs.js";
import { importRecords } from "./imports.js";
import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Req,
  Res,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Request, Response } from "express";
import { z } from "zod";
import { Decimal } from "decimal.js";
import { randomBytes, createHash } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import PDFDocument from "pdfkit";
import { fileTypeFromBuffer } from "file-type";
import { Queue } from "bullmq";
import { db } from "../../../packages/database/index.js";
import {
  can,
  cutting,
  roles,
  totals,
  documentSchema,
  type Line,
} from "../../../packages/shared/src/domain.js";
import { context, session, owned, serial, audit, json } from "./context.js";
import { resources, schemas, inviteSchema } from "./resources.js";
import {
  createDocument,
  transferStock,
  transition,
  convertDocument,
  reserve,
  fulfill,
  recordPayment,
  receive,
} from "./commerce.js";
const queue = new Queue("metalflow-ai", {
  connection: { url: process.env.REDIS_URL || "redis://127.0.0.1:6379" },
});
function page(q: Record<string, string>) {
  const n = Math.max(1, Math.min(100000, Number(q.page) || 1)),
    take = Math.min(100, Math.max(1, Number(q.limit) || 25));
  return { skip: (n - 1) * take, take, page: n };
}
function delegate(model: string, client: unknown = db) {
  return (client as Record<string, any>)[model] as {
    findMany: (x: any) => Promise<any[]>;
    count: (x: any) => Promise<number>;
    create: (x: any) => Promise<any>;
    findFirst: (x: any) => Promise<any>;
    update: (x: any) => Promise<any>;
  };
}
@Injectable()
class UploadGuard implements CanActivate {
  async canActivate(host: ExecutionContext) {
    await context(host.switchToHttp().getRequest<Request>(), "projects:write");
    return true;
  }
}
@Controller()
export class AppController {
  @Get("health") async health() {
    await db.$queryRaw`SELECT 1`;
    await queue.getJobCounts();
    return { status: "ok", service: "metalflow-api" };
  }
  @Get("me") async me(@Req() req: Request) {
    const s = await session(req);
    return {
      user: {
        id: s.user.id,
        name: s.user.name,
        email: s.user.email,
        emailVerified: s.user.emailVerified,
      },
      memberships: await db.membership.findMany({
        where: { userId: s.user.id },
        include: { organization: true },
      }),
      capabilities: {
        ...(await (async () => {
          const requested = req.header("x-organization-id");
          const member = await db.membership.findFirst({
            where: {
              userId: s.user.id,
              ...(requested ? { organizationId: requested } : {}),
            },
          });
          return member
            ? capabilities(member.organizationId)
            : { ai: false, image: false };
        })()),
        email: Boolean(process.env.SMTP_URL),
      },
    };
  }
  @Post("organizations") async organization(
    @Req() req: Request,
    @Body() raw: unknown,
  ) {
    const s = await session(req);
    const x = z
      .object({
        name: z.string().min(2).max(160),
        currency: z.enum([
          "USD",
          "CNY",
          "EUR",
          "GBP",
          "SGD",
          "MYR",
          "AUD",
          "CAD",
          "HKD",
        ]),
        country: z.string().length(2),
        businessType: z.enum([
          "DISTRIBUTOR",
          "FABRICATOR",
          "CONTRACTOR",
          "MIXED",
        ]),
        locale: z.enum(["en", "zh"]).default("en"),
      })
      .parse(raw);
    return db.$transaction(async (tx) => {
      const org = await tx.organization.create({ data: x });
      await tx.membership.create({
        data: { organizationId: org.id, userId: s.user.id, role: "OWNER" },
      });
      await tx.warehouse.create({
        data: {
          organizationId: org.id,
          name: "Main warehouse",
          createdBy: s.user.id,
        },
      });
      return org;
    });
  }
  @Patch("settings") async settings(@Req() req: Request, @Body() raw: unknown) {
    const c = await context(req, "organization:manage");
    const x = z
      .object({
        name: z.string().min(2).max(160),
        locale: z.enum(["en", "zh"]),
        modules: z
          .array(
            z.enum([
              "sales",
              "inventory",
              "procurement",
              "projects",
              "finance",
              "fabrication",
              "ai",
              "takeoff",
            ]),
          )
          .max(8),
      })
      .parse(raw);
    return serial(async (tx) => {
      const out = await tx.organization.update({
        where: { id: c.organizationId },
        data: x,
      });
      await audit(tx, c, "organization.update", c.organizationId);
      return out;
    });
  }
  @Get("team") async team(@Req() req: Request) {
    const c = await context(req, "organization:manage");
    return db.membership.findMany({
      where: { organizationId: c.organizationId },
      select: {
        id: true,
        role: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });
  }
  @Patch("team/:id") async role(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() raw: unknown,
  ) {
    const c = await context(req, "organization:manage");
    const x = z
      .object({ role: z.enum(roles).refine((r) => r !== "OWNER") })
      .parse(raw);
    return serial(async (tx) => {
      const m = await tx.membership.findFirst({
        where: { id, organizationId: c.organizationId },
      });
      if (!m || m.role === "OWNER" || m.userId === c.userId)
        throw new ForbiddenException(
          "Owner and own role cannot be changed here",
        );
      await audit(tx, c, "membership.role", id, { role: x.role });
      return tx.membership.update({ where: { id }, data: x });
    });
  }
  @Post("invitations") async invite(@Req() req: Request, @Body() raw: unknown) {
    const c = await context(req, "organization:manage");
    const x = inviteSchema.parse(raw),
      token = randomBytes(32).toString("hex");
    await db.invitation.create({
      data: {
        ...x,
        email: x.email.toLowerCase(),
        organizationId: c.organizationId,
        tokenHash: createHash("sha256").update(token).digest("hex"),
        expiresAt: new Date(Date.now() + 7 * 86400000),
        createdBy: c.userId,
      },
    });
    return {
      url: `${process.env.PUBLIC_URL || "http://localhost:3400/metalflow"}?invitation=${token}`,
      expiresInDays: 7,
    };
  }
  @Post("invitations/accept") async accept(
    @Req() req: Request,
    @Body() raw: unknown,
  ) {
    const s = await session(req),
      { token } = z.object({ token: z.string().length(64) }).parse(raw);
    return serial(async (tx) => {
      const i = await tx.invitation.findUnique({
        where: { tokenHash: createHash("sha256").update(token).digest("hex") },
      });
      if (
        !i ||
        i.acceptedAt ||
        i.expiresAt < new Date() ||
        i.email !== s.user.email.toLowerCase()
      )
        throw new ForbiddenException(
          "Invitation is invalid, expired or for another email",
        );
      const m = await tx.membership.create({
        data: {
          organizationId: i.organizationId,
          userId: s.user.id,
          role: i.role,
        },
      });
      await tx.invitation.update({
        where: { id: i.id },
        data: { acceptedAt: new Date() },
      });
      return m;
    });
  }
  @Get("documents") async documents(
    @Req() req: Request,
    @Query() q: Record<string, string>,
  ) {
    const c = await context(req),
      p = page(q);
    const kind = z
      .enum(["QUOTATION", "ORDER", "PURCHASE", "INVOICE"])
      .parse(q.kind);
    if (kind === "PURCHASE" && !can(c.role, "cost:read"))
      throw new ForbiddenException();
    if (
      kind === "INVOICE" &&
      !can(c.role, "finance:read") &&
      !can(c.role, "sales:write")
    )
      throw new ForbiddenException();
    const where = {
      organizationId: c.organizationId,
      kind,
      ...(q.status ? { status: q.status } : {}),
      ...(q.search
        ? { number: { contains: q.search, mode: "insensitive" as const } }
        : {}),
    };
    const [items, total] = await Promise.all([
      db.document.findMany({
        where,
        skip: p.skip,
        take: p.take,
        orderBy: { createdAt: "desc" },
      }),
      db.document.count({ where }),
    ]);
    return { items, total, page: p.page };
  }
  @Post("documents") async createDoc(
    @Req() req: Request,
    @Body() raw: unknown,
  ) {
    const kind = z
      .object({ kind: z.enum(["QUOTATION", "ORDER", "PURCHASE", "INVOICE"]) })
      .parse(raw).kind;
    const c = await context(
      req,
      kind === "PURCHASE"
        ? "purchase:write"
        : kind === "INVOICE"
          ? "finance:write"
          : "sales:write",
    );
    return createDocument(c, raw);
  }
  @Patch("documents/:id") async editDoc(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() raw: unknown,
  ) {
    const x = documentSchema.parse(raw),
      c = await context(
        req,
        x.kind === "PURCHASE"
          ? "purchase:write"
          : x.kind === "INVOICE"
            ? "finance:write"
            : "sales:write",
      );
    return serial(async (tx) => {
      const d = await tx.document.findFirst({
        where: { id, organizationId: c.organizationId },
      });
      if (!d || d.status !== "DRAFT" || d.kind !== x.kind || d.sourceId)
        throw new ConflictException("Only original drafts can be edited");
      for (const l of x.lines)
        if (l.productId) {
          const product = await tx.product.findFirst({
            where: {
              id: l.productId,
              organizationId: c.organizationId,
              unit: l.unit,
            },
          });
          if (!product)
            throw new BadRequestException("Invalid product or unit");
        }
      if (d.inquiryId && x.customerId !== d.customerId)
        throw new ConflictException(
          "An inquiry-linked draft cannot change customer",
        );
      if (x.customerId) await owned(tx, "customer", c, x.customerId);
      if (x.supplierId) await owned(tx, "supplier", c, x.supplierId);
      const updated = await tx.document.update({
        where: { id },
        data: {
          customerId: x.customerId,
          supplierId: x.supplierId,
          lines: json(x.lines),
          notes: x.notes,
          ...totals(x.lines, x.discount, x.taxRate),
          version: { increment: 1 },
          validUntil: x.validUntil,
          dueDate: x.dueDate,
        },
      });
      if (x.kind !== "PURCHASE")
        await snapshotCost(tx, c.organizationId, id, x.lines);
      await tx.documentVersion.create({
        data: {
          organizationId: c.organizationId,
          documentId: id,
          version: updated.version,
          snapshot: json(updated),
          createdBy: c.userId,
        },
      });
      await audit(tx, c, "document.revise", id);
      return updated;
    });
  }
  @Post("documents/:id/status") async status(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() raw: unknown,
  ) {
    const { status } = z.object({ status: z.string().max(30) }).parse(raw);
    const c = await context(req);
    const d = await db.document.findFirst({
      where: { id, organizationId: c.organizationId },
    });
    if (!d) throw new NotFoundException();
    const permission =
      d.kind === "PURCHASE"
        ? status === "APPROVED"
          ? "purchase:approve"
          : "purchase:write"
        : d.kind === "INVOICE"
          ? "finance:write"
          : status === "APPROVED"
            ? "sales:approve"
            : "sales:write";
    if (!can(c.role, permission)) throw new ForbiddenException();
    return transition(c, id, status);
  }
  @Post("documents/:id/convert") async convert(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() raw: unknown,
  ) {
    const { kind } = z
      .object({ kind: z.enum(["ORDER", "INVOICE"]) })
      .parse(raw);
    return convertDocument(
      await context(req, kind === "INVOICE" ? "finance:write" : "sales:write"),
      id,
      kind,
    );
  }
  @Post("documents/:id/duplicate") async duplicate(
    @Req() req: Request,
    @Param("id") id: string,
  ) {
    const c = await context(req, "sales:write");
    const d = await db.document.findFirst({
      where: { id, organizationId: c.organizationId, kind: "QUOTATION" },
    });
    if (!d) throw new NotFoundException();
    return createDocument(c, {
      kind: d.kind,
      customerId: d.customerId,
      lines: d.lines,
      discount: d.discount.toString(),
      taxRate: d.taxRate.toString(),
      notes: d.notes,
    });
  }
  @Get("documents/:id/pdf") async pdf(
    @Req() req: Request,
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    const c = await context(req);
    const d = await db.document.findFirst({
      where: { id, organizationId: c.organizationId },
    });
    if (!d) throw new NotFoundException();
    if (d.kind === "PURCHASE" && !can(c.role, "cost:read"))
      throw new ForbiddenException();
    if (
      d.kind === "INVOICE" &&
      !can(c.role, "finance:read") &&
      !can(c.role, "sales:write")
    )
      throw new ForbiddenException();
    const org = await db.organization.findUniqueOrThrow({
      where: { id: c.organizationId },
    });
    const party = d.customerId
      ? await db.customer.findFirst({
          where: { id: d.customerId, organizationId: c.organizationId },
        })
      : await db.supplier.findFirst({
          where: { id: d.supplierId || "", organizationId: c.organizationId },
        });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${d.number}.pdf"`,
    );
    const pdf = new PDFDocument({ margin: 45 });
    const chunks: Buffer[] = [];
    const finished = new Promise<Buffer>((resolve, reject) => {
      pdf.on("data", (chunk) => chunks.push(chunk));
      pdf.on("end", () => resolve(Buffer.concat(chunks)));
      pdf.on("error", reject);
    });
    const font = process.env.PDF_FONT_PATH;
    if (font) pdf.font(font, process.env.PDF_FONT_FAMILY || "WenQuanYiZenHei");
    pdf
      .fontSize(23)
      .text(org.name)
      .fontSize(11)
      .text(`${d.kind} ${d.number} · ${d.status}`)
      .moveDown()
      .text(`Customer / supplier: ${party?.name || ""}`)
      .text(`Date: ${d.createdAt.toISOString().slice(0, 10)} · ${d.currency}`)
      .moveDown();
    for (const l of d.lines as Line[])
      pdf
        .text(
          `${l.description} | ${l.quantity} ${l.unit} × ${l.unitPrice} = ${new Decimal(l.quantity).mul(l.unitPrice).toFixed(2)}`,
        )
        .moveDown(0.5);
    pdf
      .moveDown()
      .text(`Subtotal: ${d.subtotal}`)
      .text(`Discount: ${d.discount}`)
      .text(`Tax (${d.taxRate}%): ${d.tax}`)
      .fontSize(16)
      .text(`Total: ${d.currency} ${d.total}`)
      .fontSize(10)
      .moveDown()
      .text(d.notes);
    pdf.end();
    res.send(await finished);
  }
  @Post("orders/:id/reserve") async reservation(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() raw: unknown,
  ) {
    const { warehouseId } = z.object({ warehouseId: z.string() }).parse(raw);
    return reserve(await context(req, "inventory:write"), id, warehouseId);
  }
  @Post("orders/:id/fulfill") async fulfillment(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() raw: unknown,
  ) {
    return fulfill(await context(req, "inventory:write"), id, raw);
  }
  @Post("purchases/:id/receive") async receiving(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() raw: unknown,
  ) {
    return receive(await context(req, "purchase:write"), id, raw);
  }
  @Post("payments") async payment(@Req() req: Request, @Body() raw: unknown) {
    return recordPayment(await context(req, "finance:write"), raw);
  }
  @Get("payments") async payments(
    @Req() req: Request,
    @Query() q: Record<string, string>,
  ) {
    const c = await context(req, "finance:read"),
      p = page(q);
    return {
      items: await db.payment.findMany({
        where: { organizationId: c.organizationId },
        take: p.take,
        skip: p.skip,
        orderBy: { createdAt: "desc" },
      }),
      total: await db.payment.count({
        where: { organizationId: c.organizationId },
      }),
    };
  }
  @Get("inventory") async inventory(@Req() req: Request) {
    const c = await context(req);
    const [balances, products, warehouses] = await Promise.all([
      db.inventoryBalance.findMany({
        where: { organizationId: c.organizationId },
        take: 500,
      }),
      db.product.findMany({
        where: { organizationId: c.organizationId },
        select: {
          id: true,
          sku: true,
          name: true,
          reorderPoint: true,
          unit: true,
        },
      }),
      db.warehouse.findMany({ where: { organizationId: c.organizationId } }),
    ]);
    return {
      items: balances.map((b) => ({
        ...b,
        available: b.onHand.minus(b.reserved).toString(),
        product: products.find((p) => p.id === b.productId),
        warehouse: warehouses.find((w) => w.id === b.warehouseId),
      })),
      total: balances.length,
    };
  }
  @Post("inventory/adjust") async adjust(
    @Req() req: Request,
    @Body() raw: unknown,
  ) {
    const c = await context(req, "inventory:write"),
      x = z
        .object({
          productId: z.string(),
          warehouseId: z.string(),
          quantity: z
            .string()
            .regex(/^-?\d{1,12}(\.\d{1,4})?$/)
            .refine((v) => !new Decimal(v).isZero()),
          reason: z.string().min(5).max(300),
        })
        .parse(raw);
    return serial(async (tx) => {
      await owned(tx, "product", c, x.productId);
      await owned(tx, "warehouse", c, x.warehouseId);
      const key = {
        organizationId: c.organizationId,
        productId: x.productId,
        warehouseId: x.warehouseId,
      };
      const b = await tx.inventoryBalance.upsert({
        where: { organizationId_productId_warehouseId: key },
        create: key,
        update: {},
      });
      if (b.onHand.plus(x.quantity).lt(b.reserved))
        throw new ConflictException(
          "Adjustment would make available stock negative",
        );
      await tx.inventoryBalance.update({
        where: { id: b.id },
        data: { onHand: { increment: x.quantity } },
      });
      await audit(tx, c, "inventory.adjust", b.id, {
        reason: x.reason,
        quantity: x.quantity,
      });
      return tx.inventoryMovement.create({
        data: {
          ...key,
          quantity: x.quantity,
          kind: "ADJUSTMENT",
          reference: x.reason,
          createdBy: c.userId,
        },
      });
    });
  }
  @Post("inventory/transfer") async stockTransfer(
    @Req() req: Request,
    @Body() raw: unknown,
  ) {
    return transferStock(await context(req, "inventory:write"), raw);
  }
  @Get("movements") async movements(
    @Req() req: Request,
    @Query() q: Record<string, string>,
  ) {
    const c = await context(req),
      p = page(q);
    return {
      items: await db.inventoryMovement.findMany({
        where: { organizationId: c.organizationId },
        skip: p.skip,
        take: p.take,
        orderBy: { createdAt: "desc" },
      }),
      total: await db.inventoryMovement.count({
        where: { organizationId: c.organizationId },
      }),
    };
  }
  @Post("cutting-plans") async cut(@Req() req: Request, @Body() raw: unknown) {
    await context(req, "fabrication:write");
    try {
      return cutting(raw as Parameters<typeof cutting>[0]);
    } catch (error) {
      if (error instanceof z.ZodError) throw error;
      throw new BadRequestException(
        error instanceof Error ? error.message : "Invalid cutting requirements",
      );
    }
  }
  @Get("analytics") async analytics(
    @Req() req: Request,
    @Query() q: Record<string, string>,
  ) {
    const c = await context(req);
    const from = q.from
        ? new Date(q.from)
        : new Date(Date.now() - 30 * 86400000),
      to = q.to ? new Date(q.to) : new Date();
    if (!Number.isFinite(+from) || !Number.isFinite(+to) || from > to)
      throw new BadRequestException("Invalid dates");
    const scope = { organizationId: c.organizationId };
    const [docs, projects, inquiries, balances, activity] = await Promise.all([
      db.document.findMany({ where: scope }),
      db.project.count({ where: { ...scope, status: "ACTIVE" } }),
      db.inquiry.count({
        where: { ...scope, status: { in: ["NEW", "REVIEWING"] } },
      }),
      db.inventoryBalance.findMany({ where: scope }),
      db.auditLog.findMany({
        where: scope,
        take: 8,
        orderBy: { createdAt: "desc" },
      }),
    ]);
    const invoices = docs.filter(
      (d) =>
        d.kind === "INVOICE" &&
        ["ISSUED", "PARTIALLY_PAID", "PAID"].includes(d.status),
    );
    const current = invoices.filter(
      (d) => d.createdAt >= from && d.createdAt <= to,
    );
    const revenue = current.reduce(
      (s, d) => s.plus(d.subtotal.minus(d.discount)),
      new Decimal(0),
    );
    const outstanding = invoices.reduce(
      (s, d) => s.plus(d.total.minus(d.paid)),
      new Decimal(0),
    );
    const quotes = docs.filter(
      (d) => d.kind === "QUOTATION" && d.createdAt >= from && d.createdAt <= to,
    );
    const trend: Record<string, Decimal> = {};
    for (const d of current) {
      const k = d.createdAt.toISOString().slice(0, 10);
      trend[k] = (trend[k] || new Decimal(0)).plus(
        d.subtotal.minus(d.discount),
      );
    }
    const finance = can(c.role, "finance:read");
    const products = await db.product.findMany({ where: scope });
    const lowStock = products.filter((p) =>
      balances
        .filter((b) => b.productId === p.id)
        .reduce((s, b) => s.plus(b.onHand.minus(b.reserved)), new Decimal(0))
        .lt(p.reorderPoint.toString()),
    );
    const costs = finance
      ? await db.commercialCost.findMany({
          where: { ...scope, documentId: { in: current.map((d) => d.id) } },
        })
      : [];
    const costComplete = current.every((d) =>
      costs.some((c) => c.documentId === d.id && c.complete),
    );
    const grossProfit = costComplete
      ? revenue
          .minus(
            costs.reduce(
              (s, c) => s.plus(c.totalCost.toString()),
              new Decimal(0),
            ),
          )
          .toFixed(2)
      : null;
    const inventoryValuation = balances.reduce(
      (s, b) =>
        s.plus(
          new Decimal(b.onHand.toString()).mul(
            products.find((p) => p.id === b.productId)?.cost.toString() || 0,
          ),
        ),
      new Decimal(0),
    );
    const byCustomer: Record<string, Decimal> = {};
    const byProduct: Record<string, Decimal> = {};
    for (const d of current) {
      if (d.customerId)
        byCustomer[d.customerId] = (
          byCustomer[d.customerId] || new Decimal(0)
        ).plus(d.subtotal.minus(d.discount));
      for (const l of d.lines as Line[]) {
        const key = l.productId || l.description;
        byProduct[key] = (byProduct[key] || new Decimal(0)).plus(
          new Decimal(l.quantity).mul(l.unitPrice),
        );
      }
    }
    const customers = await db.customer.findMany({
      where: scope,
      select: { id: true, name: true },
    });
    const allProjects = finance
      ? await db.project.findMany({ where: scope })
      : [];
    const projectExpenses = finance
      ? await db.expense.findMany({ where: scope })
      : [];

    return {
      lowStock: lowStock.map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        reorderPoint: p.reorderPoint,
      })),
      openQuotations: docs.filter(
        (d) =>
          d.kind === "QUOTATION" &&
          !["REJECTED", "CONVERTED", "EXPIRED"].includes(d.status),
      ).length,
      pendingOrders: docs.filter(
        (d) =>
          d.kind === "ORDER" && !["FULFILLED", "CANCELLED"].includes(d.status),
      ).length,
      activeProjects: projects,
      newInquiries: inquiries,
      stockLines: balances.length,
      conversionRate: quotes.length
        ? (quotes.filter((d) => d.status === "CONVERTED").length /
            quotes.length) *
          100
        : 0,
      ...(finance
        ? {
            grossProfit,
            costComplete,
            inventoryValuation: inventoryValuation.toFixed(2),
            salesByCustomer: Object.entries(byCustomer).map(([id, value]) => ({
              id,
              name: customers.find((c) => c.id === id)?.name || id,
              revenue: value.toFixed(2),
            })),
            salesByProduct: Object.entries(byProduct).map(([id, value]) => ({
              id,
              name: products.find((p) => p.id === id)?.name || id,
              revenue: value.toFixed(2),
            })),
            projectBudgets: allProjects.map((p) => ({
              id: p.id,
              name: p.name,
              budget: p.budget.toString(),
              expenses: projectExpenses
                .filter((e) => e.projectId === p.id)
                .reduce((s, e) => s.plus(e.amount.toString()), new Decimal(0))
                .toFixed(2),
            })),
            revenue: revenue.toFixed(2),
            receivables: outstanding.toFixed(2),
            trend: Object.entries(trend)
              .sort()
              .map(([date, value]) => ({ date, revenue: value.toNumber() })),
            aging: [0, 30, 60, 90].map((min, i) => ({
              label: ["Current / 0–30", "31–60", "61–90", "90+"][i],
              amount: invoices
                .filter((d) => {
                  const days = d.dueDate
                    ? Math.max(0, (Date.now() - d.dueDate.getTime()) / 86400000)
                    : 0;
                  return days >= min && (i === 3 || days < (i + 1) * 30);
                })
                .reduce((s, d) => s.plus(d.total.minus(d.paid)), new Decimal(0))
                .toFixed(2),
            })),
          }
        : {}),
      activity,
    };
  }
  @Get("activity") async activity(@Req() req: Request) {
    const c = await context(req);
    return db.auditLog.findMany({
      where: { organizationId: c.organizationId },
      take: 20,
      orderBy: { createdAt: "desc" },
      select: { id: true, action: true, createdAt: true, entityId: true },
    });
  }
  @Get("audit") async logs(
    @Req() req: Request,
    @Query() q: Record<string, string>,
  ) {
    const c = await context(req, "organization:manage"),
      p = page(q);
    return {
      items: await db.auditLog.findMany({
        where: { organizationId: c.organizationId },
        skip: p.skip,
        take: p.take,
        orderBy: { createdAt: "desc" },
      }),
      total: await db.auditLog.count({
        where: { organizationId: c.organizationId },
      }),
    };
  }
  @Post("files")
  @UseGuards(UploadGuard)
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 15 * 1024 * 1024, files: 1 },
    }),
  )
  async upload(
    @Req() req: Request,
    @UploadedFile()
    file: { buffer: Buffer; originalname: string; size: number },
  ) {
    const c = await context(req, "projects:write");
    if (!file) throw new BadRequestException("File required");
    const type = await fileTypeFromBuffer(file.buffer);
    if (
      !type ||
      !["image/png", "image/jpeg", "image/webp", "application/pdf"].includes(
        type.mime,
      )
    )
      throw new BadRequestException(
        "Only validated PNG, JPEG, WebP and PDF files are supported",
      );
    const id = randomBytes(20).toString("hex"),
      root = process.env.STORAGE_ROOT || "/tmp/metalflow-storage",
      folder = path.join(root, c.organizationId);
    await mkdir(folder, { recursive: true, mode: 0o700 });
    await writeFile(path.join(folder, id), file.buffer, {
      mode: 0o600,
      flag: "wx",
    });
    return db.fileAsset.create({
      data: {
        organizationId: c.organizationId,
        name: file.originalname.slice(0, 200),
        mime: type.mime,
        size: file.size,
        path: `${c.organizationId}/${id}`,
        createdBy: c.userId,
      },
    });
  }
  @Get("files/:id") async download(
    @Req() req: Request,
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    const c = await context(req);
    const f = await db.fileAsset.findFirst({
      where: { id, organizationId: c.organizationId },
    });
    if (!f) throw new NotFoundException();
    res.setHeader("Content-Type", f.mime);
    res.setHeader(
      "Content-Disposition",
      `inline; filename*=UTF-8''${encodeURIComponent(f.name)}`,
    );
    res.setHeader("Cache-Control", "private, no-store");
    res.send(
      await readFile(
        path.join(process.env.STORAGE_ROOT || "/tmp/metalflow-storage", f.path),
      ),
    );
  }
  @Get("ai/jobs") async jobs(@Req() req: Request) {
    const c = await context(req);
    return {
      items: await db.aIJob.findMany({
        where: { organizationId: c.organizationId, createdBy: c.userId },
        take: 30,
        orderBy: { createdAt: "desc" },
      }),
    };
  }
  @Post("ai/jobs") async job(@Req() req: Request, @Body() raw: unknown) {
    const c = await context(req, "sales:write");
    const x = z
      .object({
        kind: z.enum(["INQUIRY", "ASSISTANT", "DESIGN", "DOCUMENT"]),
        text: z.string().min(1).max(20000),
        fileId: z.string().optional(),
        inquiryId: z.string().optional(),
        providerId: z.string().uuid().optional(),
      })
      .parse(raw);
    let selected: { providerId: string | null; model: string };
    try {
      selected = await resolveProvider(c.organizationId, x.kind, x.providerId);
    } catch {
      throw new BadRequestException(
        "Configure an enabled AI provider, model and key in Settings.",
      );
    }
    const model = selected.model;
    if (x.fileId) await owned(db, "fileAsset", c, x.fileId);
    if (x.inquiryId) await owned(db, "inquiry", c, x.inquiryId);
    const count = await db.aIJob.count({
      where: {
        organizationId: c.organizationId,
        createdAt: { gte: new Date(Date.now() - 86400000) },
      },
    });
    if (count >= Number(process.env.AI_DAILY_JOB_LIMIT || 30))
      throw new ConflictException("Daily AI job limit reached");
    const j = await db.aIJob.create({
      data: {
        organizationId: c.organizationId,
        kind: x.kind,
        input: json({ ...x, providerId: selected.providerId }),
        model,
        createdBy: c.userId,
      },
    });
    try {
      await queue.add(
        x.kind,
        { id: j.id },
        { jobId: j.id, removeOnComplete: 100, removeOnFail: 100 },
      );
    } catch (e) {
      await db.aIJob.update({
        where: { id: j.id },
        data: {
          status: "FAILED",
          error: "Queue unavailable; submit again later",
        },
      });
      throw e;
    }
    return j;
  }
  @Post("imports/:resource") async importData(
    @Req() req: Request,
    @Param("resource") resource: string,
    @Body() raw: unknown,
  ) {
    const name = z.enum(["customers", "products", "inventory"]).parse(resource);
    const c = await context(
      req,
      name === "customers" ? "sales:write" : "inventory:write",
    );
    if (name === "products" && !can(c.role, "cost:read"))
      throw new ForbiddenException("Product imports require cost visibility");
    return importRecords(c, name, raw);
  }
  @Post("change-orders/:id/approve") async approveChange(
    @Req() req: Request,
    @Param("id") id: string,
  ) {
    const c = await context(req, "projects:write");
    return serial(async (tx) => {
      const change = await tx.projectChangeOrder.findFirst({
        where: { id, organizationId: c.organizationId },
      });
      if (!change) throw new NotFoundException();
      if (change.status === "APPROVED") return change;
      const project = await tx.project.findFirst({
        where: { id: change.projectId, organizationId: c.organizationId },
      });
      if (!project || project.budget.plus(change.amount).lt(0))
        throw new ConflictException("Change would make budget negative");
      await tx.project.update({
        where: { id: project.id },
        data: { budget: { increment: change.amount } },
      });
      await audit(tx, c, "project.change.approve", id);
      return tx.projectChangeOrder.update({
        where: { id },
        data: { status: "APPROVED" },
      });
    });
  }
  @Get(":resource") async list(
    @Req() req: Request,
    @Param("resource") resource: string,
    @Query() q: Record<string, string>,
  ) {
    const config = resources[resource];
    if (!config) throw new NotFoundException();
    const c = await context(
        req,
        resource === "expenses" ? "finance:read" : "read",
      ),
      p = page(q);
    const where = {
      organizationId: c.organizationId,
      ...(q.search
        ? {
            OR: config.search.map((f) => ({
              [f]: { contains: q.search, mode: "insensitive" },
            })),
          }
        : {}),
    };
    const model = delegate(config.model);
    const [items, total] = await Promise.all([
      model.findMany({
        where,
        skip: p.skip,
        take: p.take,
        orderBy: { createdAt: "desc" },
      }),
      model.count({ where }),
    ]);
    if (resource === "products" && !can(c.role, "cost:read"))
      for (const item of items) delete item.cost;
    return { items, total, page: p.page };
  }
  @Post(":resource") async create(
    @Req() req: Request,
    @Param("resource") resource: string,
    @Body() raw: unknown,
  ) {
    const config = resources[resource];
    if (!config) throw new NotFoundException();
    const c = await context(req, config.permission);
    const x = schemas[resource as keyof typeof schemas].parse(raw);
    if (resource === "products" && !can(c.role, "cost:read"))
      delete (x as Record<string, unknown>).cost;
    return serial(async (tx) => {
      for (const [key, model] of [
        ["customerId", "customer"],
        ["projectId", "project"],
        ["fileId", "fileAsset"],
        ["orderId", "document"],
      ] as const) {
        const id = (x as Record<string, unknown>)[key];
        if (typeof id === "string") await owned(tx, model, c, id);
      }
      const out = await delegate(config.model, tx).create({
        data: { ...x, organizationId: c.organizationId, createdBy: c.userId },
      });
      await audit(tx, c, `${resource}.create`, out.id);
      if (resource === "products" && !can(c.role, "cost:read")) delete out.cost;
      return out;
    });
  }
  @Patch(":resource/:id") async update(
    @Req() req: Request,
    @Param("resource") resource: string,
    @Param("id") id: string,
    @Body() raw: unknown,
  ) {
    const config = resources[resource];
    if (!config) throw new NotFoundException();
    const c = await context(req, config.permission),
      x = schemas[resource as keyof typeof schemas].partial().parse(raw);
    // Zod defaults belong to creation; PATCH must preserve omitted fields.
    for (const key of Object.keys(x))
      if (!Object.prototype.hasOwnProperty.call(raw, key))
        delete (x as Record<string, unknown>)[key];
    if (resource === "products" && !can(c.role, "cost:read") && "cost" in x)
      throw new ForbiddenException("Cost permission required");
    return serial(async (tx) => {
      const model = delegate(config.model, tx),
        current = await model.findFirst({
          where: { id, organizationId: c.organizationId },
        });
      if (!current) throw new NotFoundException();
      if (resource === "change-orders" && current.status === "APPROVED")
        throw new ConflictException("Approved changes are immutable");
      for (const [key, m] of [
        ["customerId", "customer"],
        ["projectId", "project"],
        ["fileId", "fileAsset"],
        ["orderId", "document"],
      ] as const) {
        const value = (x as Record<string, unknown>)[key];
        if (typeof value === "string") await owned(tx, m, c, value);
      }
      if (resource === "products" && "unit" in x && x.unit !== current.unit) {
        const count = await tx.inventoryBalance.count({
          where: { organizationId: c.organizationId, productId: id },
        });
        if (count)
          throw new ConflictException("Cannot change stocked product unit");
      }
      await audit(tx, c, `${resource}.update`, id);
      const out = await model.update({ where: { id }, data: x });
      if (resource === "products" && !can(c.role, "cost:read")) delete out.cost;
      return out;
    });
  }
}
