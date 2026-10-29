CREATE TABLE "AIProvider" (
 "id" TEXT PRIMARY KEY,"organizationId" TEXT NOT NULL,"name" TEXT NOT NULL,
 "type" TEXT NOT NULL,"protocol" TEXT NOT NULL DEFAULT 'RESPONSES',"baseUrl" TEXT NOT NULL,
 "textModel" TEXT,"imageModel" TEXT,"enabled" BOOLEAN NOT NULL DEFAULT true,"priority" INTEGER NOT NULL DEFAULT 0,
 "createdBy" TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "AIProvider_organizationId_id_key" ON "AIProvider"("organizationId","id");
CREATE INDEX "AIProvider_organizationId_enabled_priority_idx" ON "AIProvider"("organizationId","enabled","priority");
CREATE TABLE "AIProviderKey" (
 "id" TEXT PRIMARY KEY,"organizationId" TEXT NOT NULL,"providerId" TEXT NOT NULL,
 "label" TEXT NOT NULL,"encryptedKey" TEXT NOT NULL,"fingerprint" TEXT NOT NULL,"suffix" TEXT NOT NULL,
 "enabled" BOOLEAN NOT NULL DEFAULT true,"status" TEXT NOT NULL DEFAULT 'READY',
 "dailyRequestLimit" INTEGER,"dailyTokenLimit" INTEGER,"usageDay" TEXT NOT NULL,
 "dailyRequests" INTEGER NOT NULL DEFAULT 0,"dailyTokens" INTEGER NOT NULL DEFAULT 0,
 "totalRequests" INTEGER NOT NULL DEFAULT 0,"totalTokens" BIGINT NOT NULL DEFAULT 0,
 "lastUsedAt" TIMESTAMP(3),"cooldownUntil" TIMESTAMP(3),"leaseUntil" TIMESTAMP(3),"leaseId" TEXT,
 "lastErrorCode" TEXT,"lastHttpStatus" INTEGER,"createdBy" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "AIProviderKey_provider_fkey" FOREIGN KEY ("organizationId","providerId") REFERENCES "AIProvider"("organizationId","id"),
 CONSTRAINT "AIProviderKey_limits_valid" CHECK (("dailyRequestLimit" IS NULL OR "dailyRequestLimit">0) AND ("dailyTokenLimit" IS NULL OR "dailyTokenLimit">0))
);
CREATE UNIQUE INDEX "AIProviderKey_organizationId_providerId_fingerprint_key" ON "AIProviderKey"("organizationId","providerId","fingerprint");
CREATE INDEX "AIProviderKey_organizationId_providerId_enabled_idx" ON "AIProviderKey"("organizationId","providerId","enabled");
CREATE TABLE "AIKeyAttempt" (
 "id" TEXT PRIMARY KEY,"organizationId" TEXT NOT NULL,"jobId" TEXT NOT NULL,"providerId" TEXT NOT NULL,"keyId" TEXT NOT NULL,
 "model" TEXT NOT NULL,"status" TEXT NOT NULL DEFAULT 'RUNNING',"httpStatus" INTEGER,"errorCode" TEXT,
 "inputTokens" INTEGER NOT NULL DEFAULT 0,"outputTokens" INTEGER NOT NULL DEFAULT 0,"totalTokens" INTEGER NOT NULL DEFAULT 0,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"completedAt" TIMESTAMP(3)
);
CREATE INDEX "AIKeyAttempt_organizationId_createdAt_idx" ON "AIKeyAttempt"("organizationId","createdAt");
CREATE INDEX "AIKeyAttempt_organizationId_jobId_idx" ON "AIKeyAttempt"("organizationId","jobId");
