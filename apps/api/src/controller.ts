import { documentLabel } from "../../../packages/shared/src/document-labels.js";
import { issueCredit } from "./finance.js";
import { analyticsReport } from "./analytics.js";
import {
  capabilities,
  resolveProvider,
  runWithKeyPool,
  AIExecutionError,
  type ProviderConfig,
} from "../../../packages/ai/src/pool.js";
import { providerRequest } from "../../../packages/ai/src/request.js";
import { importRecords } from "./imports.js";
import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Delete,
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
import { Prisma } from "@prisma/client";
import { Decimal } from "decimal.js";
import { randomBytes, createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import PDFDocument from "pdfkit";
import { fileTypeFromBuffer } from "file-type";
import { Queue } from "bullmq";
import { db } from "../../../packages/database/index.js";
import {
  can,
  cutting,
  roles,
  documentSchema,
  type Line,
  transitionPermission,
} from "../../../packages/shared/src/domain.js";
import { context, session, owned, serial, audit, json } from "./context.js";
import { resources, schemas, inviteSchema } from "./resources.js";
import { checkDocumentRead, documentDetails } from "./document-details.js";
import {
  createDocument,
  shortagePurchase,
  transferStock,
  transition,
  convertDocument,
  reserve,
  fulfill,
  recordPayment,
  receive,
  updateInvoiceTerms,
  reviseDocument,
} from "./commerce.js";
const queue = new Queue("metalflow-ai", {
  connection: { url: process.env.REDIS_URL || "redis://127.0.0.1:6379" },
});
function getOcrPrompt(target: string): string {
  const t = (target || "general").toLowerCase();
  if (["orders", "quotations", "purchases", "invoices", "documents"].includes(t)) {
    return `Extract all commercial document / order / invoice / quotation / purchase details from this image.
Return JSON with the following structure:
{
  "customerName": string,
  "supplierName": string,
  "date": "YYYY-MM-DD",
  "dueDate": "YYYY-MM-DD",
  "lines": [
    {
      "description": string,
      "quantity": number,
      "unit": string,
      "unitPrice": number,
      "amount": number
    }
  ],
  "discount": number,
  "tax": number,
  "notes": string
}`;
  }
  if (["customers", "suppliers"].includes(t)) {
    return `Extract customer, client, or supplier contact details from this business card, letterhead, or invoice image.
Return JSON with:
{
  "name": string,
  "contact": string,
  "email": string,
  "phone": string,
  "address": string,
  "taxId": string,
  "notes": string
}`;
  }
  if (t === "fabrication") {
    return `Extract fabrication work order or drawing part specifications from this image.
Return JSON with:
{
  "name": string,
  "material": string,
  "quantity": number,
  "thickness": number,
  "width": number,
  "length": number,
  "instructions": string
}`;
  }
  if (t === "inventory") {
    return `Extract warehouse stock count, receiving, or inventory adjustment details from this receipt or count sheet.
Return JSON with:
{
  "name": string,
  "quantity": number,
  "unit": string,
  "reason": string,
  "notes": string
}`;
  }
  return `Extract all readable business data and structured key-value pairs from this document into clean JSON.`;
}
function page(q: Record<string, string>) {
  const n = Math.max(1, Math.min(100000, Math.floor(Number(q.page)) || 1)),
    take = Math.min(100, Math.max(1, Math.floor(Number(q.limit)) || 25));
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
    checkDocumentRead(c, kind);
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
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      }),
      db.document.count({ where }),
    ]);
    return { items, total, page: p.page };
  }
  @Get("documents/:id") async documentDetail(
    @Req() req: Request,
    @Param("id") id: string,
  ) {
    return documentDetails(await context(req), id);
  }
  @Patch("documents/:id/terms") async invoiceTerms(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() raw: unknown,
  ) {
    return updateInvoiceTerms(await context(req, "finance:write"), id, raw);
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
    return reviseDocument(c, id, x);
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
    const permission = transitionPermission(d.kind, status);
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
    const label = (text: string) =>
      documentLabel(
        text,
        req.header("accept-language")?.startsWith("zh") || false,
      );
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
      .text(`${label(d.kind)} ${d.number} · ${label(d.status)}`)
      .moveDown()
      .text(`${label("Customer / supplier")}: ${party?.name || ""}`)
      .text(
        `${label("Date")}: ${d.createdAt.toISOString().slice(0, 10)} · ${d.currency}`,
      )
      .moveDown();
    for (const l of d.lines as Line[])
      pdf
        .text(
          `${l.description} | ${l.quantity} ${label(l.unit)} × ${l.unitPrice} = ${new Decimal(l.quantity).mul(l.unitPrice).toFixed(2)}`,
        )
        .moveDown(0.5);
    pdf
      .moveDown()
      .text(`${label("Subtotal")}: ${d.subtotal}`)
      .text(`${label("Discount")}: ${d.discount}`)
      .text(`${label("Tax")} (${d.taxRate}%): ${d.tax}`)
      .fontSize(16)
      .text(`${label("Total")}: ${d.currency} ${d.total}`)
      .fontSize(10)
      .text(`${label("Credited")}: ${d.credited} · ${label("Paid")}: ${d.paid}`)
      .moveDown()
      .text(d.notes);
    pdf.end();
    res.send(await finished);
  }
  @Post("orders/:id/purchase-shortage") async purchaseShortage(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() raw: unknown,
  ) {
    const x = z
      .object({ supplierId: z.string(), warehouseId: z.string() })
      .parse(raw);
    return shortagePurchase(
      await context(req, "purchase:write"),
      id,
      x.supplierId,
      x.warehouseId,
    );
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
  @Post("credit-notes") async credit(
    @Req() req: Request,
    @Body() raw: unknown,
  ) {
    return issueCredit(await context(req, "finance:write"), raw);
  }
  @Get("credit-notes") async credits(
    @Req() req: Request,
    @Query() q: Record<string, string>,
  ) {
    const c = await context(req, "finance:read"),
      p = page(q);
    const where = { organizationId: c.organizationId };
    const [items, total] = await Promise.all([
      db.creditNote.findMany({
        where,
        take: p.take,
        skip: p.skip,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      }),
      db.creditNote.count({ where }),
    ]);
    return { items, total, page: p.page };
  }
  @Patch("profile") async profile(@Req() req: Request, @Body() raw: unknown) {
    const s = await session(req),
      x = z.object({ name: z.string().trim().min(1).max(100) }).parse(raw);
    return db.user.update({
      where: { id: s.user.id },
      data: x,
      select: { id: true, name: true, email: true },
    });
  }
  @Get("schedule") async schedule(
    @Req() req: Request,
    @Query() q: Record<string, string>,
  ) {
    const c = await context(req);
    const from = new Date(q.from),
      to = new Date(q.to);
    if (
      !Number.isFinite(+from) ||
      !Number.isFinite(+to) ||
      to < from ||
      +to - +from > 62 * 86400000
    )
      throw new BadRequestException("Invalid schedule dates");
    return {
      items: await db.task.findMany({
        where: {
          organizationId: c.organizationId,
          dueDate: { gte: from, lte: to },
        },
        orderBy: { dueDate: "asc" },
        take: 1000,
      }),
    };
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
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      }),
      total: await db.payment.count({
        where: { organizationId: c.organizationId },
      }),
    };
  }
  @Get("inventory") async inventory(
    @Req() req: Request,
    @Query() q: Record<string, string>,
  ) {
    const c = await context(req),
      p = page(q),
      search = q.search?.slice(0, 200) || "";
    const filter = Prisma.sql`b."organizationId"=${c.organizationId} AND (p.name ILIKE ${"%" + search + "%"} OR p.sku ILIKE ${"%" + search + "%"} OR w.name ILIKE ${"%" + search + "%"})`;
    const [items, count] = await Promise.all([
      db.$queryRaw<any[]>(
        Prisma.sql`SELECT b.id,b."productId",b."warehouseId",b."onHand"::text,b.reserved::text,(b."onHand"-b.reserved)::text AS available,jsonb_build_object('id',p.id,'name',p.name,'sku',p.sku,'unit',p.unit,'reorderPoint',p."reorderPoint"::text) AS product,jsonb_build_object('id',w.id,'name',w.name) AS warehouse FROM "InventoryBalance" b JOIN "Product" p ON p.id=b."productId" AND p."organizationId"=b."organizationId" JOIN "Warehouse" w ON w.id=b."warehouseId" AND w."organizationId"=b."organizationId" WHERE ${filter} ORDER BY p.sku,b.id LIMIT ${p.take} OFFSET ${p.skip}`,
      ),
      db.$queryRaw<{ total: number }[]>(
        Prisma.sql`SELECT count(*)::int AS total FROM "InventoryBalance" b JOIN "Product" p ON p.id=b."productId" AND p."organizationId"=b."organizationId" JOIN "Warehouse" w ON w.id=b."warehouseId" AND w."organizationId"=b."organizationId" WHERE ${filter}`,
      ),
    ]);
    return {
      items: items.map((row) => ({
        ...row,
        onHand: new Decimal(row.onHand).toString(),
        reserved: new Decimal(row.reserved).toString(),
        available: new Decimal(row.available).toString(),
      })),
      total: count[0].total,
      page: p.page,
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
          idempotencyKey: z.string().uuid().optional(),
        })
        .parse(raw);
    return serial(async (tx) => {
      const hash = createHash("sha256").update(JSON.stringify(x)).digest("hex");
      if (x.idempotencyKey) {
        const previous = await tx.operationRequest.findUnique({
          where: {
            organizationId_key: {
              organizationId: c.organizationId,
              key: x.idempotencyKey,
            },
          },
        });
        if (previous) {
          if (previous.requestHash !== hash)
            throw new ConflictException("Idempotency key conflict");
          return previous.result;
        }
      }

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
      const result = await tx.inventoryMovement.create({
        data: {
          ...key,
          quantity: x.quantity,
          kind: "ADJUSTMENT",
          reference: x.reason,
          createdBy: c.userId,
        },
      });
      if (x.idempotencyKey)
        await tx.operationRequest.create({
          data: {
            organizationId: c.organizationId,
            key: x.idempotencyKey,
            requestHash: hash,
            result: json(result),
          },
        });
      return result;
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
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
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
    if (to.getTime() - from.getTime() > 366 * 86400000)
      throw new BadRequestException("Date range must not exceed 366 days");
    return analyticsReport(c, from, to);
  }

  @Get("activity") async activity(@Req() req: Request) {
    const c = await context(req);
    return db.auditLog.findMany({
      where: { organizationId: c.organizationId },
      take: 20,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
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
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
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
  @Get("files") async files(
    @Req() req: Request,
    @Query() q: Record<string, string>,
  ) {
    const c = await context(req, "projects:write"),
      p = page(q);
    const where = { organizationId: c.organizationId };
    const [items, total] = await Promise.all([
      db.fileAsset.findMany({
        where,
        take: p.take,
        skip: p.skip,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          name: true,
          mime: true,
          size: true,
          createdAt: true,
        },
      }),
      db.fileAsset.count({ where }),
    ]);
    return { items, total, page: p.page };
  }
  @Delete("files/:id") async deleteFile(
    @Req() req: Request,
    @Param("id") id: string,
  ) {
    const c = await context(req, "projects:write");
    const asset = await serial(async (tx) => {
      const file = await tx.fileAsset.findFirst({
        where: { id, organizationId: c.organizationId },
      });
      if (!file) throw new NotFoundException();
      const [takeoffs, jobs] = await Promise.all([
        tx.takeoff.count({
          where: { organizationId: c.organizationId, fileId: id },
        }),
        tx.aIJob.count({
          where: {
            organizationId: c.organizationId,
            OR: [
              { input: { path: ["fileId"], equals: id } },
              { result: { path: ["fileId"], equals: id } },
            ],
          },
        }),
      ]);
      if (takeoffs || jobs)
        throw new ConflictException(
          "File is linked to a saved takeoff or AI job",
        );
      await tx.fileAsset.delete({ where: { id } });
      await audit(tx, c, "file.delete", id);
      return file;
    });
    await unlink(
      path.join(
        process.env.STORAGE_ROOT || "/tmp/metalflow-storage",
        asset.path,
      ),
    ).catch((error) => {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    });
    return { deleted: true };
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
        take: 100,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      }),
    };
  }
  @Delete("ai/sessions/:sessionId") async deleteSession(
    @Req() req: Request,
    @Param("sessionId") sessionId: string,
  ) {
    const c = await context(req);
    const jobs = await db.aIJob.findMany({
      where: { organizationId: c.organizationId, createdBy: c.userId },
      select: { id: true, input: true },
    });
    const toDelete = jobs
      .filter((j: any) => j.id === sessionId || j.input?.sessionId === sessionId)
      .map((j) => j.id);
    if (toDelete.length) {
      await db.aIJob.deleteMany({
        where: { id: { in: toDelete } },
      });
    }
    return { success: true, count: toDelete.length };
  }
  @Delete("ai/jobs/:id") async deleteJob(
    @Req() req: Request,
    @Param("id") id: string,
  ) {
    const c = await context(req);
    await db.aIJob.deleteMany({
      where: { id, organizationId: c.organizationId, createdBy: c.userId },
    });
    return { success: true };
  }
  @Delete("ai/history") async clearHistory(@Req() req: Request) {
    const c = await context(req);
    const result = await db.aIJob.deleteMany({
      where: { organizationId: c.organizationId, createdBy: c.userId },
    });
    return { success: true, count: result.count };
  }
  @Post("ai/extract")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 20 * 1024 * 1024, files: 1 },
    }),
  )
  async extract(
    @Req() req: Request,
    @UploadedFile()
    file?: { buffer: Buffer; originalname: string; size: number },
    @Body("target") target?: string,
    @Body("fileId") fileId?: string,
  ) {
    const c = await context(req, "sales:write");
    let fileBuffer: Buffer, fileName: string, fileMime: string;
    if (file) {
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
      fileBuffer = file.buffer;
      fileName = file.originalname;
      fileMime = type.mime;
    } else if (fileId) {
      const asset = (await owned(db, "fileAsset", c, fileId)) as {
        path: string;
        name: string;
        mime: string;
      };
      fileBuffer = await readFile(
        path.join(process.env.STORAGE_ROOT || "/tmp/metalflow-storage", asset.path),
      );
      fileName = asset.name;
      fileMime = asset.mime;
    } else {
      throw new BadRequestException("File required");
    }
    let selected: { providerId: string | null; model: string };
    try {
      selected = await resolveProvider(c.organizationId, "DOCUMENT");
    } catch {
      try {
        selected = await resolveProvider(c.organizationId, "ASSISTANT");
      } catch {
        throw new BadRequestException(
          "Configure an enabled AI provider, model and key in Settings.",
        );
      }
    }
    const prompt = getOcrPrompt(target || "general");
    const execute = (config: ProviderConfig, apiKey: string) =>
      providerRequest(config, apiKey, {
        kind: "OCR",
        model: selected.model,
        text: prompt,
        file: {
          bytes: fileBuffer,
          name: fileName,
          mime: fileMime,
        },
      });
    const response = selected.providerId
      ? await runWithKeyPool(
          c.organizationId,
          selected.providerId,
          randomUUID(),
          selected.model,
          execute,
        )
      : await (async () => {
          if (!process.env.OPENAI_API_KEY)
            throw new AIExecutionError("NO_CONFIGURED_PROVIDER");
          return execute(
            {
              id: "environment",
              organizationId: c.organizationId,
              type: "OPENAI",
              protocol: "RESPONSES",
              baseUrl: "https://api.openai.com/v1",
              textModel: process.env.OPENAI_TEXT_MODEL || null,
              imageModel: process.env.OPENAI_IMAGE_MODEL || null,
            },
            process.env.OPENAI_API_KEY,
          );
        })();
    return { success: true, data: response.value };
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
        sessionId: z.string().optional(),
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
    const j = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${c.organizationId}),hashtext('ai-job-quota'))`;
      const count = await tx.aIJob.count({
        where: {
          organizationId: c.organizationId,
          createdAt: { gte: new Date(Date.now() - 86400000) },
        },
      });
      if (count >= Number(process.env.AI_DAILY_JOB_LIMIT || 30))
        throw new ConflictException("Daily AI job limit reached");
      return tx.aIJob.create({
        data: {
          organizationId: c.organizationId,
          kind: x.kind,
          input: json({ ...x, sessionId: x.sessionId || randomUUID(), providerId: selected.providerId }),
          model,
          createdBy: c.userId,
        },
      });
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
  @Post("fabrication") async fabrication(
    @Req() req: Request,
    @Body() raw: unknown,
  ) {
    const c = await context(req, "fabrication:write");
    const x = schemas.fabrication
      .extend({ idempotencyKey: z.string().uuid().optional() })
      .parse(raw);
    const { idempotencyKey, ...data } = x;
    return serial(async (tx) => {
      const hash = createHash("sha256")
        .update(JSON.stringify(data))
        .digest("hex");
      if (idempotencyKey) {
        const prior = await tx.operationRequest.findUnique({
          where: {
            organizationId_key: {
              organizationId: c.organizationId,
              key: idempotencyKey,
            },
          },
        });
        if (prior) {
          if (prior.requestHash !== hash)
            throw new ConflictException("Idempotency key conflict");
          return prior.result;
        }
      }
      if (data.orderId) await owned(tx, "document", c, data.orderId);
      const result = await tx.fabricationJob.create({
        data: {
          ...data,
          cutPlan: data.cutPlan ? json(data.cutPlan) : undefined,
          organizationId: c.organizationId,
          createdBy: c.userId,
        },
      });
      if (idempotencyKey)
        await tx.operationRequest.create({
          data: {
            organizationId: c.organizationId,
            key: idempotencyKey,
            requestHash: hash,
            result: json(result),
          },
        });
      await audit(tx, c, "fabrication.create", result.id);
      return result;
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
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
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
