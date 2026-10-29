import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import nodemailer from "nodemailer";
import { db } from "../../../packages/database/index.js";
const base = process.env.PUBLIC_URL || "http://localhost:3400/metalflow";
async function mail(to: string, subject: string, url: string) {
  if (!process.env.SMTP_URL)
    throw new Error("Email delivery is not configured");
  await nodemailer.createTransport(process.env.SMTP_URL).sendMail({
    from: process.env.MAIL_FROM,
    to,
    subject,
    text: `${subject}\n${url}\nIf you did not request this, ignore this email.`,
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
    sendResetPassword: async ({ user, url }) =>
      mail(user.email, "Reset your MetalFlow password", url),
  },
  emailVerification: {
    sendOnSignUp: Boolean(process.env.SMTP_URL),
    sendVerificationEmail: async ({ user, url }) =>
      mail(user.email, "Verify your MetalFlow email", url),
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
