import { Decimal } from "decimal.js";
import { z } from "zod";
export const amount = z
  .string()
  .regex(
    /^\d{1,12}(\.\d{1,4})?$/,
    "Use a positive decimal with up to 4 places",
  );
export const positive = amount.refine(
  (v) => new Decimal(v).gt(0),
  "Must be greater than zero",
);
export const lineSchema = z.object({
  productId: z.string().optional(),
  description: z.string().min(1).max(500),
  quantity: positive,
  unit: z.enum([
    "piece",
    "m",
    "ft",
    "kg",
    "lb",
    "m2",
    "ft2",
    "sheet",
    "custom",
  ]),
  unitPrice: amount,
});
export const documentSchema = z
  .object({
    kind: z.enum(["QUOTATION", "ORDER", "PURCHASE", "INVOICE"]),
    customerId: z.string().optional(),
    supplierId: z.string().optional(),
    inquiryId: z.string().optional(),
    lines: z.array(lineSchema).min(1).max(100),
    discount: amount.default("0"),
    taxRate: amount.refine((v) => new Decimal(v).lte(100)).default("0"),
    notes: z.string().max(5000).default(""),
    validUntil: z.string().datetime().nullish(),
    dueDate: z.string().datetime().nullish(),
  })
  .superRefine((x, ctx) => {
    if (x.kind === "PURCHASE") {
      if (!x.supplierId || x.customerId || x.inquiryId)
        ctx.addIssue({
          code: "custom",
          message: "Purchases require only a supplier reference",
        });
    } else if (!x.customerId || x.supplierId)
      ctx.addIssue({
        code: "custom",
        message: "Sales documents require only a customer reference",
      });
  });
export type Line = z.infer<typeof lineSchema>;
export const documentTransitions: Record<string, Record<string, string[]>> = {
  QUOTATION: {
    DRAFT: ["PENDING_APPROVAL"],
    PENDING_APPROVAL: ["APPROVED", "REJECTED"],
    APPROVED: ["SENT"],
    SENT: ["ACCEPTED", "REJECTED"],
  },
  ORDER: {
    DRAFT: ["CONFIRMED", "CANCELLED"],
    CONFIRMED: ["FULFILLED", "CANCELLED"],
    RESERVED: ["PROCESSING", "CANCELLED"],
    PROCESSING: ["CANCELLED"],
  },
  PURCHASE: {
    DRAFT: ["PENDING_APPROVAL", "CANCELLED"],
    PENDING_APPROVAL: ["APPROVED", "REJECTED"],
    APPROVED: ["SENT", "RECEIVED", "CANCELLED"],
    SENT: ["RECEIVED", "CANCELLED"],
  },
  INVOICE: { DRAFT: ["ISSUED"] },
};
export function transitionPermission(kind: string, status: string) {
  return kind === "INVOICE"
    ? "finance:write"
    : `${kind === "PURCHASE" ? "purchase" : "sales"}:${status === "APPROVED" ? "approve" : "write"}`;
}
export function availableTransitions(
  d: {
    kind: string;
    status: string;
    lines: Line[];
  },
  invoiced = false,
) {
  return (documentTransitions[d.kind]?.[d.status] || []).filter(
    (status) =>
      !(status === "CANCELLED" && d.kind === "ORDER" && invoiced) &&
      !(
        ["FULFILLED", "RECEIVED"].includes(status) &&
        d.lines.some((l) => l.productId)
      ),
  );
}
export function stockLines(lines: Line[]) {
  const grouped = new Map<
    string,
    { productId: string; description: string; unit: string; quantity: string }
  >();
  for (const line of lines) {
    if (!line.productId) continue;
    const prior = grouped.get(line.productId);
    grouped.set(line.productId, {
      productId: line.productId,
      description: line.description,
      unit: line.unit,
      quantity: new Decimal(prior?.quantity || "0")
        .plus(line.quantity)
        .toString(),
    });
  }
  return [...grouped.values()];
}
export function totals(lines: Line[], discount = "0", taxRate = "0") {
  const subtotal = lines.reduce(
    (s, l) =>
      s.plus(new Decimal(l.quantity).mul(l.unitPrice).toDecimalPlaces(2)),
    new Decimal(0),
  );
  const d = new Decimal(discount).toDecimalPlaces(2),
    rate = new Decimal(taxRate);
  if (d.lt(0) || d.gt(subtotal) || rate.lt(0) || rate.gt(100))
    throw new RangeError("Invalid discount or tax");
  const tax = subtotal.minus(d).mul(rate).div(100).toDecimalPlaces(2);
  return {
    subtotal: subtotal.toFixed(2),
    discount: d.toFixed(2),
    taxRate: rate.toString(),
    tax: tax.toFixed(2),
    total: subtotal.minus(d).plus(tax).toFixed(2),
  };
}
export const roles = [
  "OWNER",
  "ADMIN",
  "SALES_MANAGER",
  "SALES_REP",
  "WAREHOUSE_MANAGER",
  "PROCUREMENT_MANAGER",
  "FABRICATION_OPERATOR",
  "PROJECT_MANAGER",
  "ACCOUNTANT",
  "VIEWER",
] as const;
const grants: Record<string, string[]> = {
  OWNER: ["*"],
  ADMIN: ["*"],
  SALES_MANAGER: ["read", "sales:write", "sales:approve", "cost:read"],
  SALES_REP: ["read", "sales:write"],
  WAREHOUSE_MANAGER: ["read", "inventory:write"],
  PROCUREMENT_MANAGER: [
    "read",
    "purchase:write",
    "purchase:approve",
    "cost:read",
  ],
  FABRICATION_OPERATOR: ["read", "fabrication:write"],
  PROJECT_MANAGER: ["read", "projects:write"],
  ACCOUNTANT: ["read", "finance:write", "finance:read", "cost:read"],
  VIEWER: ["read"],
};
export function can(role: string, permission: string) {
  return Boolean(grants[role]?.some((p) => p === "*" || p === permission));
}
const conversions: Record<string, { dimension: string; factor: string }> = {
  m: { dimension: "length", factor: "1" },
  ft: { dimension: "length", factor: "0.3048" },
  kg: { dimension: "mass", factor: "1" },
  lb: { dimension: "mass", factor: "0.45359237" },
  m2: { dimension: "area", factor: "1" },
  ft2: { dimension: "area", factor: "0.09290304" },
};
export function convert(value: string, from: string, to: string) {
  if (from === to) return value;
  const a = conversions[from],
    b = conversions[to];
  if (!a || !b || a.dimension !== b.dimension)
    throw Error("Incompatible units");
  return new Decimal(value).mul(a.factor).div(b.factor).toString();
}
export function weight(
  profile: string,
  d: {
    width: number;
    height: number;
    thickness: number;
    length: number;
    density: number;
  },
) {
  for (const v of Object.values(d))
    if (!Number.isFinite(v) || v <= 0)
      throw Error("Positive dimensions and configured density required");
  const { width: w, height: h, thickness: t, length: l, density } = d;
  let area: number;
  if (profile === "sheet" || profile === "plate" || profile === "solid-bar")
    area = w * h;
  else if (profile === "square-tube" || profile === "rectangular-tube") {
    if (t * 2 >= Math.min(w, h)) throw Error("Invalid wall thickness");
    area = w * h - (w - 2 * t) * (h - 2 * t);
  } else if (profile === "round-tube") {
    if (t * 2 >= w) throw Error("Invalid wall thickness");
    area = (Math.PI / 4) * (w * w - (w - 2 * t) ** 2);
  } else if (profile === "angle") {
    if (t >= Math.min(w, h)) throw Error("Invalid thickness");
    area = t * (w + h - t);
  } else if (profile === "channel") {
    if (t * 2 >= h || t >= w) throw Error("Invalid thickness");
    area = t * h + 2 * (w - t) * t;
  } else throw Error("Custom extrusion requires measured supplier weight");
  return {
    kg: (area * l * density) / 1e9,
    approximate: true,
    note: "Nominal dimensions; corner radii and tolerances excluded.",
  };
}
export const cutSchema = z.object({
  stockLength: z.number().positive().max(100000),
  kerf: z.number().nonnegative().max(100),
  trim: z.number().nonnegative().default(0),
  available: z.number().int().positive().max(10000),
  offcutThreshold: z.number().nonnegative().default(300),
  cuts: z
    .array(
      z.object({
        length: z.number().positive(),
        quantity: z.number().int().positive().max(1000),
      }),
    )
    .min(1)
    .max(100),
});
export function cutting(input: z.infer<typeof cutSchema>) {
  const x = cutSchema.parse(input);
  const usable = x.stockLength - 2 * x.trim;
  const pieceCount = x.cuts.reduce((sum, cut) => sum + cut.quantity, 0);
  if (
    pieceCount > 5000 ||
    usable <= 0 ||
    x.cuts.some((c) => c.length + x.kerf > usable)
  )
    throw Error("Cut exceeds usable stock or 5000-piece limit");
  const pieces = x.cuts
    .flatMap((c) => Array(c.quantity).fill(c.length) as number[])
    .sort((a, b) => b - a);
  const bins: { cuts: number[]; remaining: number }[] = [];
  let size = 1;
  while (size < Math.min(x.available, pieces.length)) size *= 2;
  const maxRemaining = new Float64Array(size * 2).fill(-Infinity);
  const update = (index: number, remaining: number) => {
    let node = size + index;
    maxRemaining[node] = remaining;
    while (node > 1) {
      node >>= 1;
      maxRemaining[node] = Math.max(
        maxRemaining[node * 2],
        maxRemaining[node * 2 + 1],
      );
    }
  };
  for (const length of pieces) {
    const needed = length + x.kerf;
    let index: number;
    if (maxRemaining[1] >= needed) {
      let node = 1;
      while (node < size)
        node = maxRemaining[node * 2] >= needed ? node * 2 : node * 2 + 1;
      index = node - size;
    } else {
      if (bins.length >= x.available) throw Error("Insufficient stock");
      index = bins.length;
      bins.push({ cuts: [], remaining: usable });
    }
    const bin = bins[index];
    bin.cuts.push(length);
    bin.remaining -= needed;
    update(index, bin.remaining);
  }
  const used = pieces.reduce((a, b) => a + b, 0),
    total = bins.length * x.stockLength;
  return {
    algorithm: "First-fit decreasing heuristic; not guaranteed optimal",
    patterns: bins,
    stockPieces: bins.length,
    waste: total - used,
    utilization: (used / total) * 100,
    offcuts: bins
      .filter((b) => b.remaining >= x.offcutThreshold)
      .map((b) => b.remaining),
  };
}
