CREATE TABLE "Fulfillment" (
 "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "orderId" TEXT NOT NULL,
 "warehouseId" TEXT NOT NULL, "lines" JSONB NOT NULL, "idempotencyKey" TEXT NOT NULL,
 "status" TEXT NOT NULL, "createdBy" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "Fulfillment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Fulfillment_organizationId_idempotencyKey_key" ON "Fulfillment"("organizationId","idempotencyKey");
CREATE INDEX "Fulfillment_organizationId_orderId_idx" ON "Fulfillment"("organizationId","orderId");
ALTER TABLE "InventoryBalance" ADD CONSTRAINT "stock_nonnegative" CHECK ("onHand" >= 0 AND "reserved" >= 0 AND "onHand" >= "reserved");
ALTER TABLE "Reservation" ADD CONSTRAINT "reservation_valid" CHECK ("quantity" > 0 AND "fulfilled" >= 0 AND "fulfilled" <= "quantity");
ALTER TABLE "Document" ADD CONSTRAINT "document_money_valid" CHECK ("paid" >= 0 AND "paid" <= "total" AND "total" >= 0);
