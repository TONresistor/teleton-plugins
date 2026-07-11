import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { UranusError } from "./errors.js";

const TONCENTER_ORIGIN = "https://toncenter.com";
const IPFS_ORIGIN = "https://ipfs.io";
const TIMEOUT_MS = 10_000;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;

function isPrivateIpv4(ip) {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  return parts[0] === 10
    || parts[0] === 127
    || parts[0] === 0
    || (parts[0] === 169 && parts[1] === 254)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168)
    || (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127)
    || parts[0] >= 224;
}

function isPrivateIp(ip) {
  if (isIP(ip) === 4) return isPrivateIpv4(ip);
  if (isIP(ip) !== 6) return true;
  const normalized = ip.toLowerCase();
  return normalized === "::" || normalized === "::1" || normalized.startsWith("fc")
    || normalized.startsWith("fd") || normalized.startsWith("fe8")
    || normalized.startsWith("fe9") || normalized.startsWith("fea")
    || normalized.startsWith("feb") || normalized.startsWith("ff")
    || normalized.startsWith("::ffff:");
}

export async function assertPublicMetadataUrl(input) {
  let url;
  try {
    url = new URL(input);
  } catch {
    throw new UranusError("INVALID_METADATA_URI", "Metadata URI is invalid");
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new UranusError("INVALID_METADATA_URI", "Metadata URI must use IPFS, HTTP, or HTTPS");
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
    throw new UranusError("METADATA_SSRF_BLOCKED", "Metadata host is local or private");
  }
  if (isIP(host)) {
    if (isPrivateIp(host)) throw new UranusError("METADATA_SSRF_BLOCKED", "Metadata host is local or private");
  } else {
    let records;
    try {
      records = await lookup(host, { all: true, verbatim: true });
    } catch (error) {
      throw new UranusError("UPSTREAM_UNAVAILABLE", "Metadata host could not be resolved", error);
    }
    if (!records.length || records.some(({ address }) => isPrivateIp(address))) {
      throw new UranusError("METADATA_SSRF_BLOCKED", "Metadata host resolves to a local or private address");
    }
  }
  return url;
}

export function normalizeMetadataUri(uri) {
  if (typeof uri !== "string" || uri.length < 1 || uri.length > 1024) {
    throw new UranusError("INVALID_METADATA_URI", "metadata_uri must be 1 to 1024 characters");
  }
  if (uri.startsWith("ipfs://")) {
    const path = uri.slice(7).replace(/^ipfs\//, "");
    if (!path || /[?#]/.test(path.split("/")[0])) throw new UranusError("INVALID_METADATA_URI", "Invalid IPFS metadata URI");
    return `${IPFS_ORIGIN}/ipfs/${path}`;
  }
  let url;
  try {
    url = new URL(uri);
  } catch (error) {
    throw new UranusError("INVALID_METADATA_URI", "Metadata URI is invalid", error);
  }
  if (!["https:", "http:"].includes(url.protocol)) throw new UranusError("INVALID_METADATA_URI", "Metadata URI must use IPFS, HTTP, or HTTPS");
  return url.toString();
}

async function readBounded(response) {
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES) throw new UranusError("RESPONSE_TOO_LARGE", "Upstream response exceeds 2 MiB");
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) throw new UranusError("RESPONSE_TOO_LARGE", "Upstream response exceeds 2 MiB");
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

async function fetchJsonOnce(url, options = {}, validateRedirect = null) {
  let current = new URL(url);
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const response = await fetch(current, {
      ...options,
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: "application/json", ...options.headers },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      if (redirects === MAX_REDIRECTS) throw new UranusError("UPSTREAM_UNAVAILABLE", "Too many upstream redirects");
      const location = response.headers.get("location");
      if (!location) throw new UranusError("INVALID_RESPONSE", "Upstream redirect is missing a location");
      current = new URL(location, current);
      if (validateRedirect) await validateRedirect(current.toString());
      continue;
    }
    const body = await readBounded(response);
    if (response.status === 429) throw new UranusError("UPSTREAM_RATE_LIMITED", "TON indexer rate limit reached; retry shortly");
    if (!response.ok) throw new UranusError("UPSTREAM_UNAVAILABLE", `Upstream request failed with HTTP ${response.status}`);
    try {
      return JSON.parse(body);
    } catch (error) {
      throw new UranusError("INVALID_RESPONSE", "Upstream returned malformed JSON", error);
    }
  }
  throw new UranusError("UPSTREAM_UNAVAILABLE", "Upstream redirect limit reached");
}

async function fetchJson(url, options = {}, validateRedirect = null) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await fetchJsonOnce(url, options, validateRedirect);
    } catch (error) {
      lastError = error;
      if (error instanceof UranusError && error.code !== "UPSTREAM_UNAVAILABLE") throw error;
    }
  }
  if (lastError instanceof UranusError) throw lastError;
  throw new UranusError("UPSTREAM_UNAVAILABLE", "Upstream request failed", lastError);
}

function cached(sdk, key, ttl, loader) {
  const hit = sdk.storage?.get?.(key);
  if (hit !== undefined) return Promise.resolve(hit);
  return loader().then((value) => {
    sdk.storage?.set?.(key, value, { ttl });
    return value;
  });
}

function toncenterHeaders(sdk) {
  const key = sdk.secrets?.get?.("toncenter_api_key");
  return key ? { "X-API-Key": key } : {};
}

export function createHttp(sdk) {
  const toncenter = (path, params, ttl = 10_000) => {
    const url = new URL(`/api/v3/${path}`, TONCENTER_ORIGIN);
    for (const [key, value] of Object.entries(params)) if (value !== undefined) url.searchParams.set(key, String(value));
    return cached(sdk, `uranus:http:${url}`, ttl, () => fetchJson(url, { headers: toncenterHeaders(sdk) }));
  };

  return {
    accountState(address) {
      return toncenter("accountStates", { address, include_boc: "false" }, 600_000);
    },
    transactions(address, limit = 50) {
      return toncenter("transactions", { account: address, limit: Math.min(100, Math.max(1, limit)), sort: "desc" }, 10_000);
    },
    async metadata(uri) {
      const normalized = normalizeMetadataUri(uri);
      await assertPublicMetadataUrl(normalized);
      return cached(sdk, `uranus:metadata:${normalized}`, 600_000, () => fetchJson(normalized, {}, assertPublicMetadataUrl));
    },
  };
}

export const HTTP_LIMITS = Object.freeze({ timeoutMs: TIMEOUT_MS, maxBytes: MAX_BYTES, maxRedirects: MAX_REDIRECTS });
