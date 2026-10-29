import { randomUUID } from "node:crypto";
import { db } from "../../database/index.js";
import { decryptKey, secretStorageReady } from "./secrets.js";
import {
  classifyFailure,
  eligible,
  rankKeys,
  utcDay,
  responseCooldown,
  tokenUsage,
  AIExecutionError,
  CompletedOutputError,
} from "./routing.js";
import type { AIProvider } from "@prisma/client";
export type ProviderConfig = Pick<
  AIProvider,
  | "id"
  | "organizationId"
  | "type"
  | "protocol"
  | "baseUrl"
  | "textModel"
  | "imageModel"
>;
export async function configuredProviders(
  organizationId: string,
  kind: string,
) {
  return db.aIProvider.findMany({
    where: {
      organizationId,
      enabled: true,
      ...(kind === "DESIGN"
        ? { imageModel: { not: null } }
        : { textModel: { not: null } }),
    },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    include: { keys: true },
  });
}
export async function resolveProvider(
  organizationId: string,
  kind: string,
  providerId?: string,
) {
  const providers = await configuredProviders(organizationId, kind);
  const provider = providers.find(
    (p) =>
      (!providerId || p.id === providerId) &&
      p.keys.some(
        (k) => k.enabled && !["INVALID", "QUOTA_EXHAUSTED"].includes(k.status),
      ),
  );
  if (provider && secretStorageReady())
    return {
      providerId: provider.id,
      model: (kind === "DESIGN" ? provider.imageModel : provider.textModel)!,
    };
  if (providerId || (await db.aIProvider.count({ where: { organizationId } })))
    throw new AIExecutionError("NO_CONFIGURED_PROVIDER");
  const model =
    kind === "DESIGN"
      ? process.env.OPENAI_IMAGE_MODEL
      : process.env.OPENAI_TEXT_MODEL;
  if (process.env.OPENAI_API_KEY && model) return { providerId: null, model };
  throw new AIExecutionError("NO_CONFIGURED_PROVIDER");
}
export async function capabilities(organizationId: string) {
  const providers = await db.aIProvider.findMany({
    where: { organizationId },
    include: { keys: { select: { enabled: true, status: true } } },
  });
  if (providers.length)
    return {
      ai:
        secretStorageReady() &&
        providers.some(
          (p) =>
            p.enabled &&
            p.textModel &&
            p.keys.some(
              (k) =>
                k.enabled && !["INVALID", "QUOTA_EXHAUSTED"].includes(k.status),
            ),
        ),
      image:
        secretStorageReady() &&
        providers.some(
          (p) =>
            p.enabled &&
            p.imageModel &&
            p.keys.some(
              (k) =>
                k.enabled && !["INVALID", "QUOTA_EXHAUSTED"].includes(k.status),
            ),
        ),
    };
  return {
    ai: Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_TEXT_MODEL),
    image: Boolean(
      process.env.OPENAI_API_KEY && process.env.OPENAI_IMAGE_MODEL,
    ),
  };
}
export async function claimKey(
  organizationId: string,
  providerId: string,
  excluded: string[],
  jobId: string,
  model: string,
) {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId}),hashtext(${providerId}))`;
    const provider = await tx.aIProvider.findFirst({
      where: { id: providerId, organizationId, enabled: true },
    });
    if (!provider) throw new AIExecutionError("PROVIDER_DISABLED");
    const now = new Date(),
      today = utcDay(now);
    const keys = await tx.aIProviderKey.findMany({
      where: { organizationId, providerId, id: { notIn: excluded } },
    });
    const key = rankKeys(keys, now)[0];
    if (!key) return null;
    const leaseId = randomUUID();
    const out = await tx.aIProviderKey.update({
      where: { id: key.id },
      data: {
        usageDay: today,
        dailyRequests: key.usageDay === today ? key.dailyRequests + 1 : 1,
        dailyTokens: key.usageDay === today ? key.dailyTokens : 0,
        totalRequests: { increment: 1 },
        lastUsedAt: now,
        leaseId,
        leaseUntil: new Date(now.getTime() + 240000),
      },
    });
    const attempt = await tx.aIKeyAttempt.create({
      data: { organizationId, jobId, providerId, keyId: key.id, model },
    });
    return { key: out, provider, attemptId: attempt.id, leaseId };
  });
}
type AIResult = { value: unknown; usage: unknown; headers: Headers };
export async function runWithKeyPool(
  organizationId: string,
  providerId: string,
  jobId: string,
  model: string,
  execute: (config: ProviderConfig, apiKey: string) => Promise<AIResult>,
) {
  const tried: string[] = [];
  const started = Date.now();
  for (let attempt = 0; attempt < 20; attempt++) {
    if (Date.now() - started > 240000)
      throw new AIExecutionError("JOB_RETRY_TIME_LIMIT");
    const claim = await claimKey(
      organizationId,
      providerId,
      tried,
      jobId,
      model,
    );
    if (!claim) throw new AIExecutionError("NO_AVAILABLE_KEY");
    tried.push(claim.key.id);
    let apiKey: string;
    try {
      apiKey = decryptKey(claim.key.encryptedKey, organizationId, providerId);
    } catch {
      await db.aIProviderKey.updateMany({
        where: { id: claim.key.id, leaseId: claim.leaseId },
        data: {
          leaseId: null,
          leaseUntil: null,
          status: "INVALID",
          lastErrorCode: "DECRYPTION_FAILED",
        },
      });
      await db.aIKeyAttempt.update({
        where: { id: claim.attemptId },
        data: {
          status: "FAILED",
          errorCode: "DECRYPTION_FAILED",
          completedAt: new Date(),
        },
      });
      throw new AIExecutionError("SECRET_STORAGE_ERROR");
    }
    let response: AIResult;
    try {
      response = await execute(claim.provider, apiKey);
    } catch (error) {
      if (error instanceof CompletedOutputError) {
        await recordCompleted(
          claim,
          organizationId,
          error.usage,
          error.headers,
          true,
        );
        throw new AIExecutionError("INVALID_PROVIDER_OUTPUT");
      }
      const failure = classifyFailure(error);
      await db.$transaction(async (tx) => {
        await tx.aIProviderKey.updateMany({
          where: { id: claim.key.id, organizationId, leaseId: claim.leaseId },
          data: {
            leaseId: null,
            leaseUntil: null,
            status: failure.keyStatus,
            cooldownUntil: failure.cooldownUntil,
            lastErrorCode: failure.code,
            lastHttpStatus: failure.status,
          },
        });
        await tx.aIKeyAttempt.update({
          where: { id: claim.attemptId },
          data: {
            status: "FAILED",
            errorCode: failure.code,
            httpStatus: failure.status,
            completedAt: new Date(),
          },
        });
      });
      if (!failure.switchKey) throw new AIExecutionError(failure.code);
      continue;
    }
    await recordCompleted(
      claim,
      organizationId,
      response.usage,
      response.headers,
    );
    return {
      value: response.value,
      usage: response.usage,
      keyId: claim.key.id,
      providerId,
    };
  }
  throw new AIExecutionError("KEY_ATTEMPT_LIMIT");
}
async function recordCompleted(
  claim: NonNullable<Awaited<ReturnType<typeof claimKey>>>,
  organizationId: string,
  rawUsage: unknown,
  headers: Headers,
  outputError = false,
) {
  const usage = tokenUsage(rawUsage),
    cooldownUntil = responseCooldown(headers);
  const now = new Date();
  // Successful provider calls are never replayed if recording their result fails.
  await db.$transaction(async (tx) => {
    const current = await tx.aIProviderKey.findFirstOrThrow({
      where: { id: claim.key.id, organizationId },
    });
    const today = current.usageDay === utcDay(now);
    await tx.aIProviderKey.updateMany({
      where: { id: claim.key.id, organizationId, leaseId: claim.leaseId },
      data: {
        leaseId: null,
        leaseUntil: null,
        status: cooldownUntil ? "COOLDOWN" : "READY",
        cooldownUntil,
        lastErrorCode: outputError ? "INVALID_PROVIDER_OUTPUT" : null,
        lastHttpStatus: 200,
        usageDay: utcDay(now),
        dailyRequests: today ? current.dailyRequests : 0,
        dailyTokens: (today ? current.dailyTokens : 0) + usage.totalTokens,
        totalTokens: { increment: BigInt(usage.totalTokens) },
      },
    });
    await tx.aIKeyAttempt.update({
      where: { id: claim.attemptId },
      data: {
        status: outputError ? "FAILED" : "SUCCEEDED",
        errorCode: outputError ? "INVALID_PROVIDER_OUTPUT" : null,
        httpStatus: 200,
        ...usage,
        completedAt: now,
      },
    });
  });
}
export function keyDisplayState(key: Parameters<typeof eligible>[0]) {
  if (!key.enabled) return "DISABLED";
  if (eligible(key)) return "READY";
  if (["INVALID", "QUOTA_EXHAUSTED"].includes(key.status)) return key.status;
  if (key.leaseUntil && key.leaseUntil > new Date()) return "IN_USE";
  if (key.cooldownUntil && key.cooldownUntil > new Date()) return "COOLDOWN";
  return "DAILY_LIMIT";
}
