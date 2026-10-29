import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Req,
  Param,
  Body,
  NotFoundException,
  ConflictException,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { Request } from "express";
import { z } from "zod";
import { db } from "../../../packages/database/index.js";
import { context, audit } from "./context.js";
import {
  encryptKey,
  fingerprint,
  secretStorageReady,
} from "../../../packages/ai/src/secrets.js";
import { validateProviderUrl } from "../../../packages/ai/src/network.js";
import { keyDisplayState } from "../../../packages/ai/src/pool.js";
import { utcDay } from "../../../packages/ai/src/routing.js";
const models = {
  textModel: z.string().trim().max(120).nullable().optional(),
  imageModel: z.string().trim().max(120).nullable().optional(),
};
const providerSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    type: z.enum(["OPENAI", "COMPATIBLE"]),
    protocol: z.enum(["RESPONSES", "CHAT"]).default("RESPONSES"),
    baseUrl: z.string().max(500).optional(),
    ...models,
    priority: z.number().int().min(0).max(100).default(0),
    enabled: z.boolean().default(true),
  })
  .superRefine((x, ctx) => {
    if (x.type === "OPENAI" && x.protocol !== "RESPONSES")
      ctx.addIssue({ code: "custom", message: "OpenAI uses Responses API" });
  });
const limits = {
  dailyRequestLimit: z.number().int().min(1).max(1000000).nullable().optional(),
  dailyTokenLimit: z
    .number()
    .int()
    .min(1)
    .max(1000000000)
    .nullable()
    .optional(),
};
const keySchema = z.object({
  label: z.string().trim().min(1).max(80),
  apiKey: z.string().trim().min(16).max(4096).regex(/^\S+$/),
  ...limits,
});
const safeKey = {
  id: true,
  label: true,
  suffix: true,
  enabled: true,
  status: true,
  dailyRequestLimit: true,
  dailyTokenLimit: true,
  usageDay: true,
  dailyRequests: true,
  dailyTokens: true,
  totalRequests: true,
  totalTokens: true,
  lastUsedAt: true,
  cooldownUntil: true,
  leaseUntil: true,
  lastErrorCode: true,
  lastHttpStatus: true,
  createdAt: true,
} as const;
function normalizeModels(x: {
  textModel?: string | null;
  imageModel?: string | null;
}) {
  return Object.fromEntries(
    Object.entries(x)
      .filter(([k]) => ["textModel", "imageModel"].includes(k))
      .map(([k, v]) => [k, v?.trim() || null]),
  );
}
@Controller("ai/providers")
export class AISettingsController {
  @Get() async list(@Req() req: Request) {
    const c = await context(req, "organization:manage");
    const providers = await db.aIProvider.findMany({
      where: { organizationId: c.organizationId },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        type: true,
        protocol: true,
        baseUrl: true,
        textModel: true,
        imageModel: true,
        enabled: true,
        priority: true,
        keys: { select: safeKey, orderBy: { createdAt: "asc" } },
      },
    });
    return {
      encryptionReady: secretStorageReady(),
      providers: providers.map((p) => ({
        ...p,
        keys: p.keys.map((k) => ({
          ...k,
          totalTokens: k.totalTokens.toString(),
          state: keyDisplayState(k),
          dailyRequests: k.usageDay === utcDay() ? k.dailyRequests : 0,
          dailyTokens: k.usageDay === utcDay() ? k.dailyTokens : 0,
        })),
      })),
      attempts: await db.aIKeyAttempt.findMany({
        where: { organizationId: c.organizationId },
        take: 30,
        orderBy: { createdAt: "desc" },
      }),
    };
  }
  @Post() async create(@Req() req: Request, @Body() raw: unknown) {
    const c = await context(req, "organization:manage"),
      x = providerSchema.parse(raw);
    if (!secretStorageReady())
      throw new ServiceUnavailableException(
        "AI secret storage is not configured",
      );
    if (
      (await db.aIProvider.count({
        where: { organizationId: c.organizationId },
      })) >= 10
    )
      throw new ConflictException("Maximum 10 providers per organization");
    const baseUrl = await validateProviderUrl(
      x.type === "OPENAI" ? "https://api.openai.com/v1" : x.baseUrl || "",
    );
    return db.$transaction(async (tx) => {
      const p = await tx.aIProvider.create({
        data: {
          ...x,
          ...normalizeModels(x),
          baseUrl,
          organizationId: c.organizationId,
          createdBy: c.userId,
        },
      });
      await audit(tx, c, "ai.provider.create", p.id, {
        type: p.type,
        protocol: p.protocol,
      });
      return p;
    });
  }
  @Patch(":id") async update(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() raw: unknown,
  ) {
    const c = await context(req, "organization:manage"),
      x = z
        .object({
          name: z.string().trim().min(1).max(100).optional(),
          enabled: z.boolean().optional(),
          priority: z.number().int().min(0).max(100).optional(),
          ...models,
        })
        .strict()
        .parse(raw);
    return db.$transaction(async (tx) => {
      const p = await tx.aIProvider.findFirst({
        where: { id, organizationId: c.organizationId },
      });
      if (!p) throw new NotFoundException();
      await audit(tx, c, "ai.provider.update", id);
      return tx.aIProvider.update({
        where: { id },
        data: { ...x, ...normalizeModels(x) },
      });
    });
  }
  @Post(":id/keys") async addKey(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() raw: unknown,
  ) {
    const c = await context(req, "organization:manage"),
      x = keySchema.parse(raw);
    if (!secretStorageReady())
      throw new ServiceUnavailableException(
        "AI secret storage is not configured",
      );
    const provider = await db.aIProvider.findFirst({
      where: { id, organizationId: c.organizationId },
    });
    if (!provider) throw new NotFoundException();
    if (
      (await db.aIProviderKey.count({
        where: { organizationId: c.organizationId, providerId: id },
      })) >= 20
    )
      throw new ConflictException("Maximum 20 keys per provider");
    return db.$transaction(async (tx) => {
      const k = await tx.aIProviderKey.create({
        data: {
          organizationId: c.organizationId,
          providerId: id,
          label: x.label,
          encryptedKey: encryptKey(x.apiKey, c.organizationId, id),
          fingerprint: fingerprint(x.apiKey),
          suffix: x.apiKey.slice(-4),
          dailyRequestLimit: x.dailyRequestLimit,
          dailyTokenLimit: x.dailyTokenLimit,
          usageDay: utcDay(),
          createdBy: c.userId,
        },
        select: { id: true, label: true, suffix: true },
      });
      await audit(tx, c, "ai.key.create", k.id, { providerId: id });
      return k;
    });
  }
  @Patch(":id/keys/:keyId") async updateKey(
    @Req() req: Request,
    @Param("id") id: string,
    @Param("keyId") keyId: string,
    @Body() raw: unknown,
  ) {
    const c = await context(req, "organization:manage"),
      x = z
        .object({
          label: z.string().trim().min(1).max(80).optional(),
          enabled: z.boolean().optional(),
          ...limits,
          resetHealth: z.boolean().optional(),
        })
        .strict()
        .parse(raw);
    return db.$transaction(async (tx) => {
      const k = await tx.aIProviderKey.findFirst({
        where: { id: keyId, providerId: id, organizationId: c.organizationId },
      });
      if (!k) throw new NotFoundException();
      const { resetHealth, ...data } = x;
      await audit(tx, c, "ai.key.update", keyId, {
        providerId: id,
        resetHealth: !!resetHealth,
      });
      const out = await tx.aIProviderKey.update({
        where: { id: keyId },
        data: {
          ...data,
          ...(resetHealth
            ? {
                status: "READY",
                cooldownUntil: null,
                lastErrorCode: null,
                lastHttpStatus: null,
              }
            : {}),
        },
        select: safeKey,
      });
      return { ...out, totalTokens: out.totalTokens.toString() };
    });
  }
  @Delete(":id/keys/:keyId") async removeKey(
    @Req() req: Request,
    @Param("id") id: string,
    @Param("keyId") keyId: string,
  ) {
    const c = await context(req, "organization:manage");
    return db.$transaction(async (tx) => {
      const k = await tx.aIProviderKey.findFirst({
        where: { id: keyId, providerId: id, organizationId: c.organizationId },
      });
      if (!k) throw new NotFoundException();
      if (k.leaseUntil && k.leaseUntil > new Date())
        throw new ConflictException(
          "Key is in use; disable it and wait for the active request",
        );
      await tx.aIProviderKey.delete({ where: { id: keyId } });
      await audit(tx, c, "ai.key.delete", keyId, { providerId: id });
      return { deleted: true };
    });
  }
}
