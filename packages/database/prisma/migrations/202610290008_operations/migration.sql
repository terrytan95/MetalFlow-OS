CREATE TABLE "OperationRequest"("id" TEXT PRIMARY KEY,"organizationId" TEXT NOT NULL,"key" TEXT NOT NULL,"requestHash" TEXT NOT NULL,"result" JSONB NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE UNIQUE INDEX "OperationRequest_organizationId_key_key" ON "OperationRequest"("organizationId","key");
