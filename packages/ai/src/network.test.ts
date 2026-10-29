import { it, expect, vi, afterEach } from "vitest";
vi.mock("node:dns/promises", () => ({ lookup: vi.fn() }));
import { lookup } from "node:dns/promises";
import { validateProviderUrl, providerFetch } from "./network.js";
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});
it("rejects DNS names with any private result", async () => {
  vi.stubEnv("AI_TEST_MODE", "false");
  vi.mocked(lookup).mockResolvedValue([
    { address: "8.8.8.8", family: 4 },
    { address: "127.0.0.1", family: 4 },
  ] as never);
  await expect(
    validateProviderUrl("https://provider.example/v1"),
  ).rejects.toThrow("public addresses");
});
it("revalidates DNS at connection time and blocks rebinding", async () => {
  vi.stubEnv("AI_TEST_MODE", "false");
  vi.mocked(lookup).mockResolvedValueOnce([
    { address: "8.8.8.8", family: 4 },
  ] as never);
  await expect(validateProviderUrl("https://rebind.example/v1")).resolves.toBe(
    "https://rebind.example/v1",
  );
  vi.mocked(lookup).mockResolvedValue([
    { address: "127.0.0.1", family: 4 },
  ] as never);
  await expect(
    providerFetch("https://rebind.example/v1")(
      "https://rebind.example/v1/responses",
      { method: "POST", body: "{}", signal: AbortSignal.timeout(2000) },
    ),
  ).rejects.toThrow();
  expect(lookup).toHaveBeenCalledTimes(2);
});
it("does not allow SDK requests to escape the configured origin", async () => {
  await expect(
    providerFetch("https://api.example/v1")(
      "https://other.example/v1/responses",
    ),
  ).rejects.toThrow("outside configured endpoint");
});
