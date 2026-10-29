import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import {
  Module,
  Catch,
  type ArgumentsHost,
  type ExceptionFilter,
  HttpException,
} from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { toNodeHandler } from "better-auth/node";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { AISettingsController } from "./ai-settings.js";
import { AppController } from "./controller.js";
import { auth } from "./auth.js";
@Catch()
class Errors implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp(),
      res = ctx.getResponse(),
      req = ctx.getRequest();
    let status = 500,
      message = "Unexpected server error";
    if (error instanceof ZodError) {
      status = 400;
      message = error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
    } else if (error instanceof RangeError) {
      status = 400;
      message = error.message;
    } else if (error instanceof HttpException) {
      status = error.getStatus();
      message = error.message;
    } else if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ["P2002", "P2003", "P2034"].includes(error.code)
    ) {
      status = 409;
      message = "Record conflict. Refresh and try again.";
    }
    if (status === 500)
      console.error(
        JSON.stringify({
          level: "error",
          requestId: req.requestId,
          error: String(error),
        }),
      );
    if (res.headersSent) {
      res.end();
      return;
    }
    res
      .status(status)
      .json({ error: { code: status, message, requestId: req.requestId } });
  }
}
@Module({ controllers: [AISettingsController, AppController] })
class AppModule {}
const app = await NestFactory.create(AppModule, { bodyParser: false });
const server = app.getHttpAdapter().getInstance();
server.set("trust proxy", "loopback");
app.use((req: any, res: any, next: any) => {
  req.requestId = randomUUID();
  res.setHeader("X-Request-ID", req.requestId);
  res.setHeader("Cache-Control", "no-store");
  next();
});
app.use(
  helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }),
);
app.use(
  rateLimit({
    windowMs: 60000,
    limit: 600,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }),
);
server.all("/metalflow/api/v1/auth/*path", toNodeHandler(auth));
app.use(express.json({ limit: "1mb" }));
app.use((req: any, res: any, next: any) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.headers.origin;
    const expected = new URL(process.env.PUBLIC_URL || "http://localhost:3400")
      .origin;
    if (origin !== expected)
      return res
        .status(403)
        .json({ error: { message: "Origin check failed" } });
  }
  next();
});
app.setGlobalPrefix("metalflow/api/v1");
app.useGlobalFilters(new Errors());
const config = new DocumentBuilder()
  .setTitle("MetalFlow OS API")
  .setDescription(
    "Tenant-scoped business operations. Send a session cookie and X-Organization-ID. Mutations require the configured Origin.",
  )
  .setVersion("1.0")
  .addCookieAuth("metalflow.session_token")
  .addApiKey(
    { type: "apiKey", in: "header", name: "X-Organization-ID" },
    "organization",
  )
  .build();
SwaggerModule.setup(
  "metalflow/api/docs",
  app,
  SwaggerModule.createDocument(app, config),
);
app.enableShutdownHooks();
await app.listen(Number(process.env.PORT || 3401), "0.0.0.0");
