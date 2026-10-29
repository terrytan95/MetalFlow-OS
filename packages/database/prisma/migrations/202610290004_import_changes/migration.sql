CREATE TABLE "ImportBatch" (
 "id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "resource" TEXT NOT NULL,
 "requestHash" TEXT NOT NULL, "idempotencyKey" TEXT NOT NULL,"count" INTEGER NOT NULL,
 "createdBy" TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "ImportBatch_organizationId_idempotencyKey_key" ON "ImportBatch"("organizationId","idempotencyKey");
CREATE TABLE "ProjectChangeOrder" (
 "id" TEXT PRIMARY KEY,"organizationId" TEXT NOT NULL,"projectId" TEXT NOT NULL,
 "name" TEXT NOT NULL,"reason" TEXT NOT NULL,"amount" DECIMAL(18,2) NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'DRAFT',"createdBy" TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "ProjectChangeOrder_organizationId_projectId_idx" ON "ProjectChangeOrder"("organizationId","projectId");
