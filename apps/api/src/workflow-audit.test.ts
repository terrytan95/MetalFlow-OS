import { beforeEach, describe, expect, it, vi } from "vitest";
import { Decimal } from "decimal.js";
import { randomUUID } from "node:crypto";
import {
  availableTransitions,
  can,
  stockLines,
  transitionPermission,
  type Line,
} from "../../../packages/shared/src/domain.js";

const { db } = vi.hoisted(() => {
  const db: any = {};
  for (const model of [
    "document",
    "documentVersion",
    "warehouse",
    "reservation",
    "inventoryBalance",
    "inventoryMovement",
    "goodsReceipt",
    "fulfillment",
    "auditLog",
    "product",
    "supplier",
  ])
    db[model] = Object.fromEntries(
      [
        "findFirst",
        "findMany",
        "findUnique",
        "update",
        "create",
        "deleteMany",
        "upsert",
        "groupBy",
      ].map((key) => [key, vi.fn()]),
    );
  db.$transaction = vi.fn((fn: (tx: any) => unknown) => fn(db));
  return { db };
});
vi.mock("../../../packages/database/index.js", () => ({ db }));
vi.mock("./auth.js", () => ({ auth: {} }));
import {
  transition,
  fulfill,
  receive,
  updateInvoiceTerms,
  reviseDocument,
} from "./commerce.js";
import { documentDetails } from "./document-details.js";
import { schemas } from "./resources.js";

const c = { organizationId: "org-a", userId: "user-a", role: "OWNER" };
const metal: Line = {
  productId: "metal",
  description: "Steel",
  quantity: "10",
  unit: "piece",
  unitPrice: "5.00",
};
const service: Line = {
  description: "Freight",
  quantity: "1",
  unit: "custom",
  unitPrice: "12.00",
};
let document: any;
let received: Decimal;
let fulfilled: Decimal;
beforeEach(() => {
  vi.clearAllMocks();
  document = {
    id: "doc-a",
    organizationId: c.organizationId,
    kind: "ORDER",
    status: "CONFIRMED",
    lines: [metal],
    version: 1,
  };
  received = new Decimal(0);
  fulfilled = new Decimal(0);
  db.document.findFirst.mockImplementation(({ where }: any) => {
    if (where.sourceId) return null;
    if (
      where.organizationId !== document.organizationId ||
      (where.kind && where.kind !== document.kind) ||
      (typeof where.status === "string" && where.status !== document.status)
    )
      return null;
    return document;
  });
  db.document.update.mockImplementation(({ data }: any) => {
    document = {
      ...document,
      ...data,
      version: data.version
        ? document.version + data.version.increment
        : document.version,
    };
    return document;
  });
  db.warehouse.findFirst.mockResolvedValue({ id: "reserved-warehouse" });
  db.product.findMany.mockResolvedValue([{ id: "metal", unit: "piece" }]);
  db.supplier.findFirst.mockResolvedValue({ id: "supplier-a" });
  db.warehouse.findMany.mockResolvedValue([
    { id: "reserved-warehouse", name: "Reserved warehouse" },
  ]);
  db.inventoryMovement.groupBy.mockImplementation(() => [
    { productId: metal.productId, _sum: { quantity: received } },
  ]);
  db.inventoryMovement.create.mockImplementation(({ data }: any) => {
    if (data.kind === "RECEIPT") received = received.plus(data.quantity);
    return data;
  });
  db.goodsReceipt.findUnique.mockResolvedValue(null);
  db.goodsReceipt.create.mockImplementation(({ data }: any) => data);
  db.fulfillment.findUnique.mockResolvedValue(null);
  db.fulfillment.create.mockImplementation(({ data }: any) => data);
  const reservation = () => ({
    id: "reservation",
    productId: "metal",
    warehouseId: "reserved-warehouse",
    quantity: new Decimal(10),
    fulfilled,
  });
  db.reservation.findMany.mockImplementation(() => [reservation()]);
  db.reservation.findUnique.mockImplementation(({ where }: any) =>
    where.organizationId_orderId_productId_warehouseId.warehouseId ===
    "reserved-warehouse"
      ? reservation()
      : null,
  );
  db.reservation.update.mockImplementation(({ data }: any) => {
    fulfilled = fulfilled.plus(data.fulfilled.increment);
  });
});

describe("document lifecycle audit regressions", () => {
  it("releases the reservation when an eligible order is cancelled", async () => {
    document.status = "RESERVED";
    await transition(c, document.id, "CANCELLED");
    expect(document.status).toBe("CANCELLED");
    expect(db.inventoryBalance.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { reserved: { decrement: new Decimal(10) } },
      }),
    );
    expect(db.reservation.deleteMany).toHaveBeenCalledWith({
      where: { organizationId: c.organizationId, orderId: document.id },
    });
  });
  it("blocks invoiced/partially fulfilled cancellation and viewer transitions", async () => {
    document.status = "RESERVED";
    db.document.findFirst.mockImplementation(({ where }: any) =>
      where.sourceId ? { id: "invoice" } : document,
    );
    await expect(transition(c, document.id, "CANCELLED")).rejects.toThrow(
      "invoiced order",
    );
    expect(db.inventoryBalance.update).not.toHaveBeenCalled();
    document.status = "PARTIALLY_FULFILLED";
    await expect(transition(c, document.id, "CANCELLED")).rejects.toThrow(
      "Cannot change",
    );
    await expect(
      transition({ ...c, role: "VIEWER" }, document.id, "CANCELLED"),
    ).rejects.toThrow("Forbidden");
  });
  it("completes service-only orders/purchases without inventory, but never bypasses stocked fulfillment", async () => {
    document.lines = [service];
    await transition(c, document.id, "FULFILLED");
    document = { ...document, kind: "PURCHASE", status: "APPROVED" };
    await transition(c, document.id, "RECEIVED");
    expect(document.status).toBe("RECEIVED");
    expect(db.inventoryBalance.update).not.toHaveBeenCalled();
    document = {
      ...document,
      kind: "ORDER",
      status: "CONFIRMED",
      lines: [metal, service],
    };
    await expect(transition(c, document.id, "FULFILLED")).rejects.toThrow(
      "Cannot change",
    );
  });
  it("receives mixed stock/service purchases in 4+6 units, with exact remaining progress", async () => {
    document = {
      ...document,
      kind: "PURCHASE",
      status: "APPROVED",
      lines: [metal, service],
    };
    const input = (quantity: string) => ({
      warehouseId: "reserved-warehouse",
      lines: [{ productId: "metal", quantity }],
      idempotencyKey: randomUUID(),
    });
    await receive(c, document.id, input("4"));
    expect(document.status).toBe("PARTIALLY_RECEIVED");
    expect((await documentDetails(c, document.id)).stockProgress).toMatchObject(
      [{ ordered: "10", completed: "4", remaining: "6" }],
    );
    await expect(receive(c, document.id, input("7"))).rejects.toThrow(
      "exceeds ordered",
    );
    await receive(c, document.id, input("6"));
    expect(document.status).toBe("RECEIVED");
    expect(received.toString()).toBe("10");
    expect(db.inventoryMovement.create).toHaveBeenCalledTimes(2);
  });
  it("fulfills 4+6 units from the actual reservation warehouse and rejects excess", async () => {
    document.status = "RESERVED";
    const input = (quantity: string, warehouseId = "reserved-warehouse") => ({
      warehouseId,
      lines: [{ productId: "metal", quantity }],
      idempotencyKey: randomUUID(),
    });
    await fulfill(c, document.id, input("4"));
    const detail = await documentDetails(c, document.id);
    expect(detail.stockProgress).toMatchObject([
      {
        warehouseId: "reserved-warehouse",
        ordered: "10",
        completed: "4",
        remaining: "6",
      },
    ]);
    expect(db.warehouse.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: c.organizationId,
          id: { in: ["reserved-warehouse"] },
        },
      }),
    );
    await expect(fulfill(c, document.id, input("7"))).rejects.toThrow(
      "exceeds reservation",
    );
    await expect(
      fulfill(c, document.id, input("6", "other-warehouse")),
    ).rejects.toThrow("exceeds reservation");
    await fulfill(c, document.id, input("6"));
    expect(document.status).toBe("FULFILLED");
    expect(fulfilled.toString()).toBe("10");
  });
  it("keeps invoice source/prices immutable while draft terms can change", async () => {
    document = {
      ...document,
      kind: "INVOICE",
      status: "DRAFT",
      sourceId: "order-a",
      total: "50.00",
    };
    await updateInvoiceTerms(c, document.id, {
      dueDate: "2026-01-01T23:59:59Z",
      notes: "Net 30",
    });
    expect(document).toMatchObject({
      sourceId: "order-a",
      total: "50.00",
      version: 2,
      dueDate: "2026-01-01T23:59:59Z",
    });
    await expect(
      updateInvoiceTerms(c, document.id, { dueDate: null, lines: [] }),
    ).rejects.toThrow();
    document.status = "ISSUED";
    await expect(
      updateInvoiceTerms(c, document.id, { dueDate: null }),
    ).rejects.toThrow("Only draft");
    await expect(
      updateInvoiceTerms({ ...c, role: "SALES_REP" }, document.id, {
        dueDate: null,
      }),
    ).rejects.toThrow("Forbidden");
    await expect(
      updateInvoiceTerms({ ...c, organizationId: "org-b" }, document.id, {
        dueDate: null,
      }),
    ).rejects.toThrow("Only draft");
  });
  it("protects purchase cost and tenant isolation on the detail endpoint", async () => {
    document.kind = "PURCHASE";
    await expect(
      documentDetails({ ...c, role: "VIEWER" }, document.id),
    ).rejects.toThrow("Forbidden");
    await expect(
      documentDetails({ ...c, organizationId: "org-b" }, document.id),
    ).rejects.toThrow("Not Found");
    expect(db.warehouse.findMany).not.toHaveBeenCalled();
  });
  it("allows supplier-price revisions on shortage drafts without changing source lineage", async () => {
    document = {
      ...document,
      kind: "PURCHASE",
      status: "DRAFT",
      sourceId: "order-a",
    };
    const draft = {
      kind: "PURCHASE",
      supplierId: "supplier-a",
      lines: [{ ...metal, unitPrice: "4.25" }],
    };
    await reviseDocument(c, document.id, draft);
    expect(document).toMatchObject({
      sourceId: "order-a",
      total: "42.50",
      version: 2,
    });
    expect(db.supplier.findFirst).toHaveBeenCalledWith({
      where: { id: "supplier-a", organizationId: c.organizationId },
    });
    db.supplier.findFirst.mockResolvedValueOnce(null);
    await expect(reviseDocument(c, document.id, draft)).rejects.toThrow(
      "supplier not found",
    );
    await expect(
      reviseDocument(c, document.id, {
        ...draft,
        lines: [{ ...metal, unit: "kg" }],
      }),
    ).rejects.toThrow("Invalid product or unit");
    document.status = "APPROVED";
    await expect(reviseDocument(c, document.id, draft)).rejects.toThrow(
      "Only original",
    );
    await expect(
      reviseDocument({ ...c, role: "VIEWER" }, document.id, draft),
    ).rejects.toThrow("Forbidden");
  });
  it("shares status/permission rules and aggregates repeated catalog lines exactly", () => {
    expect(availableTransitions({ ...document, lines: [metal] }, true)).toEqual(
      [],
    );
    expect(can("SALES_REP", transitionPermission("PURCHASE", "APPROVED"))).toBe(
      false,
    );
    expect(
      stockLines([metal, { ...metal, quantity: "0.125" }, service]),
    ).toMatchObject([{ quantity: "10.125" }]);
  });
  it("accepts explicit nullable dates/references while preserving omission semantics", () => {
    expect(
      schemas.tasks.partial().parse({ dueDate: null, projectId: null }),
    ).toMatchObject({ dueDate: null, projectId: null });
    expect(
      schemas.projects.partial().parse({ dueDate: null, notes: "" }),
    ).toMatchObject({ dueDate: null, notes: "" });
    expect(
      schemas.tasks.partial().parse({ name: "Keep due date" }),
    ).not.toHaveProperty("dueDate");
    expect(() => schemas.tasks.partial().parse({ projectId: "" })).toThrow();
  });
});
