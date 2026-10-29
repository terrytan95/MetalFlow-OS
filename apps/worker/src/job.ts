import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileTypeFromBuffer } from "file-type";
import { db } from "../../../packages/database/index.js";
import { json } from "../../api/src/context.js";
import {
  runWithKeyPool,
  type ProviderConfig,
} from "../../../packages/ai/src/pool.js";
import { providerRequest } from "../../../packages/ai/src/request.js";
import { AIExecutionError } from "../../../packages/ai/src/routing.js";
export async function executeAIJob(id: string) {
  const row = await db.aIJob.findUniqueOrThrow({
    where: { id },
  });
  const claimed = await db.aIJob.updateMany({
    where: { id: row.id, status: "QUEUED" },
    data: { status: "RUNNING" },
  });
  if (!claimed.count) {
    if (row.status === "RUNNING")
      await db.aIJob.updateMany({
        where: { id, status: "RUNNING" },
        data: {
          status: "FAILED",
          error: "INTERRUPTED_PROVIDER_STATUS_UNKNOWN",
        },
      });
    return;
  }
  try {
    const member = await db.membership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: row.organizationId,
          userId: row.createdBy,
        },
      },
    });
    if (
      !member ||
      !["OWNER", "ADMIN", "SALES_MANAGER", "SALES_REP"].includes(member.role)
    )
      throw new AIExecutionError("PERMISSION_REVOKED");
    if (!row.model) throw new AIExecutionError("MODEL_NOT_CONFIGURED");
    const input = row.input as {
      text: string;
      fileId?: string;
      inquiryId?: string;
      providerId?: string | null;
    };
    const asset = input.fileId
      ? await db.fileAsset.findFirst({
          where: { id: input.fileId, organizationId: row.organizationId },
        })
      : null;
    if (input.fileId && !asset) throw new AIExecutionError("FILE_NOT_FOUND");
    const file = asset
      ? {
          bytes: await readFile(
            path.join(process.env.STORAGE_ROOT!, asset.path),
          ),
          name: asset.name,
          mime: asset.mime,
        }
      : undefined;
    const execute = (config: ProviderConfig, apiKey: string) =>
      providerRequest(config, apiKey, {
        kind: row.kind,
        model: row.model!,
        text: input.text,
        file,
      });
    const response = input.providerId
      ? await runWithKeyPool(
          row.organizationId,
          input.providerId,
          row.id,
          row.model,
          execute,
        )
      : await (async () => {
          if (!process.env.OPENAI_API_KEY)
            throw new AIExecutionError("NO_CONFIGURED_PROVIDER");
          return execute(
            {
              id: "environment",
              organizationId: row.organizationId,
              type: "OPENAI",
              protocol: "RESPONSES",
              baseUrl: "https://api.openai.com/v1",
              textModel: process.env.OPENAI_TEXT_MODEL || null,
              imageModel: process.env.OPENAI_IMAGE_MODEL || null,
            },
            process.env.OPENAI_API_KEY,
          );
        })();
    let result = response.value;
    if (row.kind === "DESIGN") {
      const image = (result as { imageBase64: string }).imageBase64;
      if (image.length > 28 * 1024 * 1024)
        throw new AIExecutionError("IMAGE_TOO_LARGE");
      const bytes = Buffer.from(image, "base64");
      const type = await fileTypeFromBuffer(bytes);
      if (
        !type ||
        !["image/png", "image/jpeg", "image/webp"].includes(type.mime)
      )
        throw new AIExecutionError("INVALID_IMAGE");
      const name = `${randomUUID()}.${type.ext}`,
        dir = path.join(process.env.STORAGE_ROOT!, row.organizationId);
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, name), bytes, { mode: 0o600 });
      const file = await db.fileAsset.create({
        data: {
          organizationId: row.organizationId,
          name: `Design concept.${type.ext}`,
          mime: type.mime,
          size: bytes.length,
          path: `${row.organizationId}/${name}`,
          createdBy: row.createdBy,
        },
      });
      result = {
        fileId: file.id,
        disclaimer: "Concept only. Not suitable as construction documentation.",
      };
    } else if (row.kind === "INQUIRY" && input.inquiryId)
      await db.inquiry.updateMany({
        where: { id: input.inquiryId, organizationId: row.organizationId },
        data: {
          extraction: json(result),
          reviewed: false,
          status: "REVIEWING",
        },
      });
    await db.aIJob.update({
      where: { id: row.id },
      data: {
        status: "SUCCEEDED",
        result: json(result),
        usage: json(response.usage),
      },
    });
  } catch (error) {
    await db.aIJob.update({
      where: { id: row.id },
      data: {
        status: "FAILED",
        error:
          error instanceof AIExecutionError ? error.code : "AI_REQUEST_FAILED",
      },
    });
  }
}
