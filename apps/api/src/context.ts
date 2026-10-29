import {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from "@nestjs/common";
import { fromNodeHeaders } from "better-auth/node";
import type { Request } from "express";
import { Prisma } from "@prisma/client";
import { db } from "../../../packages/database/index.js";
import { auth } from "./auth.js";
import { can } from "../../../packages/shared/src/domain.js";
export type Context = { organizationId: string; userId: string; role: string };
export async function session(req: Request) {
  const s = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
  if (!s) throw new UnauthorizedException();
  return s;
}
export async function context(
  req: Request,
  permission = "read",
): Promise<Context> {
  const s = await session(req);
  const id = req.header("x-organization-id");
  if (!id) throw new BadRequestException("Select an organization");
  const member = await db.membership.findUnique({
    where: { organizationId_userId: { organizationId: id, userId: s.user.id } },
  });
  if (!member) throw new ForbiddenException("Organization access denied");
  if (!can(member.role, permission))
    throw new ForbiddenException("Permission denied");
  return { organizationId: id, userId: s.user.id, role: member.role };
}
export function audit(
  tx: Prisma.TransactionClient,
  c: Context,
  action: string,
  entityId: string,
  detail: Prisma.InputJsonValue = {},
) {
  return tx.auditLog.create({
    data: {
      organizationId: c.organizationId,
      actorId: c.userId,
      action,
      entityId,
      detail,
    },
  });
}
export async function serial<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let i = 0; i < 8; i++) {
    try {
      return await db.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10000,
        timeout: 20000,
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2034" &&
        i < 7
      ) {
        await new Promise((resolve) =>
          setTimeout(resolve, 10 * (i + 1) + Math.random() * 20),
        );
        continue;
      }
      throw e;
    }
  }
  throw Error("Transaction failed");
}
export async function owned(
  tx: Prisma.TransactionClient,
  model:
    | "customer"
    | "product"
    | "supplier"
    | "warehouse"
    | "project"
    | "inquiry"
    | "document"
    | "fileAsset",
  c: Context,
  id: string,
) {
  const row = await (
    tx[model] as unknown as { findFirst(args: unknown): Promise<unknown> }
  ).findFirst({ where: { id, organizationId: c.organizationId } });
  if (!row) throw new NotFoundException(`${model} not found`);
  return row;
}
export const json = (x: unknown) =>
  JSON.parse(JSON.stringify(x)) as Prisma.InputJsonValue;
