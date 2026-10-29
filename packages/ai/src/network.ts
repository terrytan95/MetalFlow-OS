import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import ipaddr from "ipaddr.js";
import { Agent, fetch as safeFetch } from "undici";
export function isPublicAddress(address: string) {
  try {
    const addr = ipaddr.process(address);
    return addr.range() === "unicast";
  } catch {
    return false;
  }
}
function testOrigin() {
  const origin = process.env.AI_TEST_PROVIDER_ORIGIN;
  const publicHost = new URL(
    process.env.PUBLIC_URL || "https://invalid.invalid",
  ).hostname;
  return process.env.AI_TEST_MODE === "true" &&
    ["localhost", "127.0.0.1"].includes(publicHost)
    ? origin
    : undefined;
}
export function normalizeBaseUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new RangeError("Enter a valid provider base URL");
  }
  if (url.username || url.password || url.search || url.hash)
    throw new RangeError(
      "Base URL cannot contain credentials, query or fragment",
    );
  if (
    url.origin !== testOrigin() &&
    (url.protocol !== "https:" || (url.port && url.port !== "443"))
  )
    throw new RangeError("Provider must use public HTTPS on port 443");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (
    url.origin !== testOrigin() &&
    (host === "localhost" ||
      host.endsWith(".localhost") ||
      !host.includes(".") ||
      (isIP(host) && !isPublicAddress(host)))
  )
    throw new RangeError("Private provider addresses are not allowed");
  return url.toString().replace(/\/+$/, "");
}
export async function validateProviderUrl(value: string) {
  const base = normalizeBaseUrl(value),
    url = new URL(base);
  if (url.origin === testOrigin()) return base;
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some((a) => !isPublicAddress(a.address)))
    throw new RangeError("Provider must resolve only to public addresses");
  return base;
}
// Resolve and validate in the actual socket lookup, not just during configuration.
const dispatcher = new Agent({
  connect: {
    lookup: (hostname, options, callback) => {
      lookup(hostname, { all: true })
        .then((addresses) => {
          if (
            !addresses.length ||
            addresses.some((a) => !isPublicAddress(a.address))
          )
            throw Error("Provider network policy rejected address");
          const selected =
            addresses.find(
              (a) => !options.family || a.family === options.family,
            ) || addresses[0];
          if (options.all) (callback as any)(null, addresses);
          else (callback as any)(null, selected.address, selected.family);
        })
        .catch(() =>
          callback(
            new Error("Provider network policy rejected address"),
            "",
            4,
          ),
        );
    },
  },
});
export function providerFetch(baseUrl: string): typeof globalThis.fetch {
  const base = new URL(normalizeBaseUrl(baseUrl));
  return (async (input: any, init: any) => {
    const target = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );
    if (
      target.origin !== base.origin ||
      !target.pathname.startsWith(base.pathname.replace(/\/$/, "") + "/")
    )
      throw Error("Provider request outside configured endpoint");
    const test = base.origin === testOrigin();
    return safeFetch(target, {
      ...init,
      redirect: "error",
      ...(test ? {} : { dispatcher }),
    });
  }) as unknown as typeof globalThis.fetch;
}
