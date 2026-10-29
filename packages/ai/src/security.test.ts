import { it, expect, vi, afterEach } from "vitest";
import { randomBytes } from "node:crypto";
import { encryptKey, decryptKey, fingerprint } from "./secrets.js";
import { normalizeBaseUrl, isPublicAddress } from "./network.js";
afterEach(() => vi.unstubAllEnvs());
it("encrypts nondeterministically, authenticates ciphertext and binds tenant/provider", () => {
  vi.stubEnv("AI_KEY_ENCRYPTION_KEY", randomBytes(32).toString("hex"));
  const a = encryptKey("fake-key-unit-test-1234", "org-a", "provider-a"),
    b = encryptKey("fake-key-unit-test-1234", "org-a", "provider-a");
  expect(a).not.toContain("fake-key");
  expect(a).not.toBe(b);
  expect(decryptKey(a, "org-a", "provider-a")).toBe("fake-key-unit-test-1234");
  expect(() => decryptKey(a, "org-b", "provider-a")).toThrow();
  expect(() =>
    decryptKey(a.slice(0, -5) + "AAAAA", "org-a", "provider-a"),
  ).toThrow();
  expect(fingerprint("fake-key-unit-test-1234")).toBe(
    fingerprint("fake-key-unit-test-1234"),
  );
});
it("rejects unsafe endpoints and private/mapped addresses", () => {
  vi.stubEnv("AI_TEST_MODE", "false");
  for (const u of [
    "http://api.example.com/v1",
    "https://localhost/v1",
    "https://127.0.0.1/v1",
    "https://169.254.169.254/v1",
    "https://[::1]/v1",
    "https://[::ffff:127.0.0.1]/v1",
    "https://user:pass@api.example.com/v1",
    "https://api.example.com:8443/v1",
    "https://api.example.com/v1?key=x",
  ])
    expect(() => normalizeBaseUrl(u)).toThrow();
  for (const ip of [
    "10.0.0.1",
    "192.168.1.1",
    "172.16.0.1",
    "127.0.0.1",
    "::1",
    "::ffff:127.0.0.1",
    "169.254.169.254",
    "100.64.0.1",
  ])
    expect(isPublicAddress(ip)).toBe(false);
  expect(isPublicAddress("8.8.8.8")).toBe(true);
  expect(normalizeBaseUrl("https://api.openai.com/v1/")).toBe(
    "https://api.openai.com/v1",
  );
});
