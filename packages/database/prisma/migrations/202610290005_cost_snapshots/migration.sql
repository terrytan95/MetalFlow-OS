CREATE TABLE "CommercialCost" (
 "id" TEXT PRIMARY KEY,"organizationId" TEXT NOT NULL,"documentId" TEXT NOT NULL,
 "totalCost" DECIMAL(18,2) NOT NULL,"complete" BOOLEAN NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "CommercialCost_documentId_key" ON "CommercialCost"("documentId");
CREATE INDEX "CommercialCost_organizationId_documentId_idx" ON "CommercialCost"("organizationId","documentId");
