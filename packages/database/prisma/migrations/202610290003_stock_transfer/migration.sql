CREATE TABLE "StockTransfer" (
 "id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "productId" TEXT NOT NULL,
 "fromWarehouseId" TEXT NOT NULL, "toWarehouseId" TEXT NOT NULL,
 "quantity" DECIMAL(18,4) NOT NULL CHECK ("quantity">0), "reason" TEXT NOT NULL,
 "idempotencyKey" TEXT NOT NULL, "createdBy" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "StockTransfer_organizationId_idempotencyKey_key" ON "StockTransfer"("organizationId","idempotencyKey");
CREATE INDEX "StockTransfer_organizationId_createdAt_idx" ON "StockTransfer"("organizationId","createdAt");
