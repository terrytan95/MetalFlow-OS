import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHmac,
} from "node:crypto";
function masterKey() {
  const value = process.env.AI_KEY_ENCRYPTION_KEY;
  if (!value || !/^([a-f\d]{64})$/i.test(value))
    throw new Error("AI secret storage is not configured");
  return Buffer.from(value, "hex");
}
export function secretStorageReady() {
  return /^[a-f\d]{64}$/i.test(process.env.AI_KEY_ENCRYPTION_KEY || "");
}
export function encryptKey(
  value: string,
  organizationId: string,
  providerId: string,
) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", masterKey(), iv);
  cipher.setAAD(Buffer.from(`${organizationId}:${providerId}`));
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    encrypted.toString("base64"),
  ].join(".");
}
export function decryptKey(
  value: string,
  organizationId: string,
  providerId: string,
) {
  const [version, iv, tag, data] = value.split(".");
  if (version !== "v1" || !iv || !tag || !data)
    throw Error("Invalid encrypted key");
  const cipher = createDecipheriv(
    "aes-256-gcm",
    masterKey(),
    Buffer.from(iv, "base64"),
  );
  cipher.setAAD(Buffer.from(`${organizationId}:${providerId}`));
  cipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([
    cipher.update(Buffer.from(data, "base64")),
    cipher.final(),
  ]).toString("utf8");
}
export function fingerprint(value: string) {
  return createHmac("sha256", masterKey()).update(value).digest("hex");
}
