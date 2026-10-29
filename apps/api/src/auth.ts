import { authEmailCopy } from "../../../packages/shared/src/auth-copy.js";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import nodemailer from "nodemailer";
import { db } from "../../../packages/database/index.js";
const base = process.env.PUBLIC_URL || "http://localhost:3400/metalflow";
async function mail(
  to: string,
  kind: "reset" | "verify",
  url: string,
  request?: Request,
) {
  const copy = authEmailCopy(
    kind,
    url,
    request?.headers.get("accept-language"),
  );
  if (!process.env.SMTP_URL)
    throw new Error("Email delivery is not configured");
  await nodemailer.createTransport(process.env.SMTP_URL).sendMail({
    from: process.env.MAIL_FROM,
    to,
    ...copy,
  });
}
export const auth = betterAuth({
  database: prismaAdapter(db, { provider: "postgresql" }),
  baseURL: new URL(base).origin,
  basePath: "/metalflow/api/v1/auth",
  secret: process.env.AUTH_SECRET,
  trustedOrigins: [new URL(base).origin],
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    requireEmailVerification: process.env.REQUIRE_EMAIL_VERIFICATION === "true",
    sendResetPassword: async ({ user, url }, request) =>
      mail(user.email, "reset", url, request),
  },
  emailVerification: {
    sendOnSignUp: Boolean(process.env.SMTP_URL),
    sendVerificationEmail: async ({ user, url }, request) =>
      mail(user.email, "verify", url, request),
  },
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 12 },
  advanced: {
    ipAddress: { ipAddressHeaders: ["x-real-ip"] },
    cookiePrefix: "metalflow",
    useSecureCookies: base.startsWith("https://"),
    defaultCookieAttributes: {
      path: "/metalflow",
      sameSite: "lax",
      httpOnly: true,
    },
  },
  rateLimit: { enabled: true, window: 60, max: 30 },
});
