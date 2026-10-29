import { z } from "zod";
import {
  amount,
  positive,
  roles,
} from "../../../packages/shared/src/domain.js";
const name = z.string().min(1).max(200),
  optional = z.string().max(2000).optional();
export const schemas = {
  "tax-rates": z.object({
    name,
    rate: amount.refine((v) => Number(v) <= 100),
    active: z.boolean().default(true),
  }),
  "change-orders": z.object({
    name,
    projectId: z.string(),
    reason: z.string().min(5).max(2000),
    amount: z.string().regex(/^-?\d{1,12}(\.\d{1,2})?$/),
  }),
  customers: z.object({
    name,
    email: z.union([z.email(), z.literal("")]).optional(),
    phone: optional,
    type: z
      .enum([
        "INDIVIDUAL",
        "BUSINESS",
        "CONTRACTOR",
        "DISTRIBUTOR",
        "DEVELOPER",
        "DESIGNER",
      ])
      .default("BUSINESS"),
    address: optional,
    notes: optional,
    tags: z.array(z.string().max(50)).max(20).default([]),
    creditLimit: amount.default("0"),
  }),
  products: z.object({
    sku: z.string().min(1).max(80),
    name,
    material: name,
    grade: optional,
    profile: name,
    unit: z
      .enum(["piece", "m", "ft", "kg", "lb", "m2", "ft2", "sheet", "custom"])
      .default("piece"),
    specifications: z
      .record(z.string(), z.union([z.string(), z.number()]))
      .default({}),
    cost: amount.default("0"),
    price: amount,
    reorderPoint: amount.default("0"),
  }),
  inquiries: z.object({
    customerId: z.string(),
    subject: name,
    text: z.string().min(1).max(20000),
    source: z
      .enum(["MANUAL", "EMAIL", "PHONE", "WHATSAPP", "CSV"])
      .default("MANUAL"),
    status: z
      .enum([
        "NEW",
        "REVIEWING",
        "AWAITING_INFORMATION",
        "READY_TO_QUOTE",
        "QUOTED",
        "CLOSED",
      ])
      .default("NEW"),
    reviewed: z.boolean().default(false),
    extraction: z.record(z.string(), z.unknown()).optional(),
    requestedDate: z.string().datetime().nullish(),
  }),
  suppliers: z.object({
    name,
    email: z.union([z.email(), z.literal("")]).optional(),
    phone: optional,
    address: optional,
    notes: optional,
  }),
  warehouses: z.object({ name, address: optional }),
  projects: z.object({
    name,
    customerId: z.string(),
    address: optional,
    status: z
      .enum(["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED"])
      .default("PLANNING"),
    budget: amount,
    dueDate: z.string().datetime().nullish(),
    notes: optional,
  }),
  tasks: z.object({
    name,
    projectId: z.string().min(1).nullish(),
    status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).default("TODO"),
    assignedTo: z.string().min(1).nullish(),
    dueDate: z.string().datetime().nullish(),
  }),
  expenses: z.object({
    name,
    projectId: z.string().min(1).nullish(),
    category: name,
    amount: positive,
    date: z.string().datetime(),
  }),
  fabrication: z.object({
    name,
    orderId: z.string().min(1).nullish(),
    status: z
      .enum(["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"])
      .default("PLANNED"),
    notes: optional,
    cutPlan: z.record(z.string(), z.unknown()).optional(),
  }),
  takeoffs: z.object({
    name,
    projectId: z.string().min(1).nullish(),
    fileId: z.string().min(1).nullish(),
    scale: positive.default("1"),
    measurements: z
      .array(
        z.object({
          label: name,
          quantity: positive,
          unit: z.string().max(20),
          source: z.enum(["USER", "SCALE", "AI"]),
          verified: z.boolean(),
          points: z
            .array(
              z.object({
                x: z.number().min(0).max(1),
                y: z.number().min(0).max(1),
              }),
            )
            .max(100)
            .optional(),
        }),
      )
      .max(1000)
      .default([]),
  }),
};
export const resources: Record<
  string,
  { model: string; permission: string; search: string[] }
> = {
  "tax-rates": {
    model: "taxRate",
    permission: "finance:write",
    search: ["name"],
  },
  "change-orders": {
    model: "projectChangeOrder",
    permission: "projects:write",
    search: ["name"],
  },
  customers: {
    model: "customer",
    permission: "sales:write",
    search: ["name", "email"],
  },
  products: {
    model: "product",
    permission: "inventory:write",
    search: ["name", "sku"],
  },
  inquiries: {
    model: "inquiry",
    permission: "sales:write",
    search: ["subject", "text"],
  },
  suppliers: {
    model: "supplier",
    permission: "purchase:write",
    search: ["name"],
  },
  warehouses: {
    model: "warehouse",
    permission: "inventory:write",
    search: ["name"],
  },
  projects: {
    model: "project",
    permission: "projects:write",
    search: ["name"],
  },
  tasks: { model: "task", permission: "projects:write", search: ["name"] },
  expenses: { model: "expense", permission: "finance:write", search: ["name"] },
  fabrication: {
    model: "fabricationJob",
    permission: "fabrication:write",
    search: ["name"],
  },
  takeoffs: {
    model: "takeoff",
    permission: "projects:write",
    search: ["name"],
  },
};
export const inviteSchema = z.object({
  email: z.email(),
  role: z.enum(roles).refine((r) => r !== "OWNER"),
});
