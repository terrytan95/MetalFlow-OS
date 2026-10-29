import { Decimal } from "decimal.js";
import { Prisma } from "@prisma/client";
import { db } from "../../../packages/database/index.js";
import { can } from "../../../packages/shared/src/domain.js";
import type { Context } from "./context.js";
const paidStatuses = Prisma.sql`('ISSUED','PARTIALLY_PAID','PAID','CREDITED')`;
export async function analyticsReport(c: Context, from: Date, to: Date) {
  const org = c.organizationId;
  const [counts, stock, lowStock, activity] = await Promise.all([
    db.$queryRaw<any[]>(Prisma.sql`SELECT
 count(*) FILTER(WHERE kind='QUOTATION' AND status NOT IN ('REJECTED','CONVERTED','EXPIRED'))::int AS "openQuotations",
 count(*) FILTER(WHERE kind='ORDER' AND status NOT IN ('FULFILLED','CANCELLED'))::int AS "pendingOrders",
 count(*) FILTER(WHERE kind='QUOTATION' AND "createdAt">=${from} AND "createdAt"<=${to})::int AS quotes,
 count(*) FILTER(WHERE kind='QUOTATION' AND status='CONVERTED' AND "createdAt">=${from} AND "createdAt"<=${to})::int AS converted
 FROM "Document" WHERE "organizationId"=${org}`),
    db.$queryRaw<any[]>(
      Prisma.sql`SELECT (SELECT count(*)::int FROM "InventoryBalance" WHERE "organizationId"=${org}) AS "stockLines",(SELECT count(*)::int FROM "Project" WHERE "organizationId"=${org} AND status='ACTIVE') AS "activeProjects",(SELECT count(*)::int FROM "Inquiry" WHERE "organizationId"=${org} AND status IN ('NEW','REVIEWING')) AS "newInquiries"`,
    ),
    db.$queryRaw<any[]>(
      Prisma.sql`SELECT count(*) OVER()::int AS "lowStockCount",p.id,p.sku,p.name,p."reorderPoint"::text FROM "Product" p LEFT JOIN (SELECT "productId",sum("onHand"-reserved) AS available FROM "InventoryBalance" WHERE "organizationId"=${org} GROUP BY "productId") b ON b."productId"=p.id WHERE p."organizationId"=${org} AND COALESCE(b.available,0)<p."reorderPoint" ORDER BY p.sku LIMIT 50`,
    ),
    db.auditLog.findMany({
      where: { organizationId: org },
      take: 8,
      orderBy: { createdAt: "desc" },
      select: { id: true, action: true, entityId: true, createdAt: true },
    }),
  ]);
  const base = {
    ...stock[0],
    openQuotations: counts[0].openQuotations,
    pendingOrders: counts[0].pendingOrders,
    conversionRate: counts[0].quotes
      ? (counts[0].converted / counts[0].quotes) * 100
      : 0,
    lowStockCount: lowStock[0]?.lowStockCount || 0,
    lowStock: lowStock.map(({ lowStockCount: _count, ...row }) => row),
    activity,
  };
  if (!can(c.role, "finance:read")) return base;
  const [
    financial,
    trend,
    aging,
    byCustomer,
    byProduct,
    projectBudgets,
    valuation,
  ] = await Promise.all([
    db.$queryRaw<any[]>(
      Prisma.sql`SELECT COALESCE(sum(d.subtotal-d.discount-CASE WHEN d.total>0 THEN d.credited*(d.subtotal-d.discount)/d.total ELSE 0 END) FILTER(WHERE d."createdAt">=${from} AND d."createdAt"<=${to}),0)::text AS revenue,COALESCE(sum(d.total-d.paid-d.credited),0)::text AS receivables,COALESCE(bool_and(COALESCE(c.complete,false)) FILTER(WHERE d."createdAt">=${from} AND d."createdAt"<=${to}),true) AS "costComplete",COALESCE(sum(d.subtotal-d.discount-CASE WHEN d.total>0 THEN d.credited*(d.subtotal-d.discount)/d.total ELSE 0 END-COALESCE(c."totalCost",0)) FILTER(WHERE d."createdAt">=${from} AND d."createdAt"<=${to}),0)::text AS "grossProfit" FROM "Document" d LEFT JOIN "CommercialCost" c ON c."documentId"=d.id AND c."organizationId"=d."organizationId" WHERE d."organizationId"=${org} AND d.kind='INVOICE' AND d.status IN ${paidStatuses}`,
    ),
    db.$queryRaw<any[]>(
      Prisma.sql`SELECT to_char(date_trunc('day',"createdAt"),'YYYY-MM-DD') AS date,sum(subtotal-discount-CASE WHEN total>0 THEN credited*(subtotal-discount)/total ELSE 0 END)::text AS revenue FROM "Document" WHERE "organizationId"=${org} AND kind='INVOICE' AND status IN ${paidStatuses} AND "createdAt">=${from} AND "createdAt"<=${to} GROUP BY 1 ORDER BY 1`,
    ),
    db.$queryRaw<any[]>(
      Prisma.sql`SELECT CASE WHEN "dueDate" IS NULL THEN -1 WHEN "dueDate">=CURRENT_DATE THEN 0 WHEN "dueDate">=CURRENT_DATE-30 THEN 1 WHEN "dueDate">=CURRENT_DATE-60 THEN 2 WHEN "dueDate">=CURRENT_DATE-90 THEN 3 ELSE 4 END AS bucket,COALESCE(sum(total-paid-credited),0)::text AS amount FROM "Document" WHERE "organizationId"=${org} AND kind='INVOICE' AND status IN ${paidStatuses} GROUP BY 1`,
    ),
    db.$queryRaw<any[]>(
      Prisma.sql`SELECT d."customerId" AS id,COALESCE(c.name,d."customerId") AS name,sum(d.subtotal-d.discount-CASE WHEN d.total>0 THEN d.credited*(d.subtotal-d.discount)/d.total ELSE 0 END)::text AS revenue FROM "Document" d LEFT JOIN "Customer" c ON c.id=d."customerId" AND c."organizationId"=d."organizationId" WHERE d."organizationId"=${org} AND d.kind='INVOICE' AND d.status IN ${paidStatuses} AND d."createdAt">=${from} AND d."createdAt"<=${to} GROUP BY d."customerId",c.name ORDER BY sum(d.subtotal-d.discount-CASE WHEN d.total>0 THEN d.credited*(d.subtotal-d.discount)/d.total ELSE 0 END) DESC LIMIT 50`,
    ),
    db.$queryRaw<any[]>(
      Prisma.sql`SELECT COALESCE(l->>'productId',l->>'description') AS id,COALESCE(p.name,l->>'description') AS name,sum((l->>'quantity')::numeric*(l->>'unitPrice')::numeric)::text AS revenue FROM "Document" d CROSS JOIN LATERAL jsonb_array_elements(d.lines) l LEFT JOIN "Product" p ON p.id=l->>'productId' AND p."organizationId"=d."organizationId" WHERE d."organizationId"=${org} AND d.kind='INVOICE' AND d.status IN ${paidStatuses} AND d."createdAt">=${from} AND d."createdAt"<=${to} GROUP BY 1,2 ORDER BY sum((l->>'quantity')::numeric*(l->>'unitPrice')::numeric) DESC LIMIT 50`,
    ),
    db.$queryRaw<any[]>(
      Prisma.sql`SELECT p.id,p.name,p.budget::text,COALESCE(e.total,0)::text AS expenses FROM "Project" p LEFT JOIN (SELECT "projectId",sum(amount) AS total FROM "Expense" WHERE "organizationId"=${org} GROUP BY "projectId") e ON e."projectId"=p.id WHERE p."organizationId"=${org} ORDER BY p."updatedAt" DESC LIMIT 50`,
    ),
    db.$queryRaw<any[]>(
      Prisma.sql`SELECT COALESCE(sum(b."onHand"*p.cost),0)::text AS value FROM "InventoryBalance" b JOIN "Product" p ON p.id=b."productId" AND p."organizationId"=b."organizationId" WHERE b."organizationId"=${org}`,
    ),
  ]);
  const f = financial[0];
  for (const field of ["revenue", "receivables", "grossProfit"])
    f[field] = new Decimal(f[field]).toFixed(2);
  return {
    ...base,
    ...f,
    grossProfit: f.costComplete ? f.grossProfit : null,
    inventoryValuation: new Decimal(valuation[0].value).toFixed(2),
    trend: trend.map((r) => ({ ...r, revenue: Number(r.revenue) })),
    aging: [-1, 0, 1, 2, 3, 4].map((bucket) => ({
      label: [
        "Undated",
        "Current",
        "1–30 days overdue",
        "31–60 days overdue",
        "61–90 days overdue",
        "90+ days overdue",
      ][bucket + 1],
      amount: aging.find((r) => r.bucket === bucket)?.amount || "0.00",
    })),
    salesByCustomer: byCustomer,
    salesByProduct: byProduct,
    projectBudgets,
  };
}
