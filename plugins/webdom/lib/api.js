/**
 * Webdom marketplace HTTP client
 *
 * Provides GET/POST helpers with caching via sdk.storage.
 */

import { API_BASE, API_TIMEOUT, CACHE_TTL } from "./constants.js";

// ---------------------------------------------------------------------------
// SDK reference (set by index.js at load time)
// ---------------------------------------------------------------------------

let _sdk = null;

export function initApi(sdk) {
  _sdk = sdk;
}

// ---------------------------------------------------------------------------
// Core HTTP helpers
// ---------------------------------------------------------------------------

/**
 * GET request to webdom.market API.
 * @param {string} path   API path (e.g. "/domains/search")
 * @param {Record<string, any>} params  Query parameters
 * @param {Record<string, string>} [headers]  Extra headers
 * @returns {Promise<any>}
 */
export async function webdomGet(path, params = {}, headers = {}) {
  const url = new URL(API_BASE + path);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }

  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json", ...headers },
    signal: AbortSignal.timeout(API_TIMEOUT),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Webdom API error: ${res.status} ${text.slice(0, 200)}`.trim());
  }

  return res.json();
}

/**
 * POST request to webdom.market API.
 * @param {string} path   API path
 * @param {any} body      JSON body
 * @param {Record<string, string>} [headers]  Extra headers
 * @returns {Promise<any>}
 */
export async function webdomPost(path, body = {}, headers = {}) {
  const res = await fetch(new URL(API_BASE + path), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(API_TIMEOUT),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Webdom API error: ${res.status} ${text.slice(0, 200)}`.trim());
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// Cached GET — uses sdk.storage with TTL
// ---------------------------------------------------------------------------

/**
 * GET with sdk.storage caching.
 * @param {string} cacheKey  Unique cache key
 * @param {string} path      API path
 * @param {Record<string, any>} params  Query parameters
 * @param {number} [ttl]     Cache TTL in milliseconds (default: CACHE_TTL)
 * @returns {Promise<any>}
 */
export async function webdomGetCached(cacheKey, path, params = {}, ttl = CACHE_TTL) {
  if (_sdk) {
    const cached = await _sdk.storage.get(cacheKey);
    if (cached !== undefined && cached !== null) {
      return cached;
    }
  }

  const data = await webdomGet(path, params);

  if (_sdk) {
    await _sdk.storage.set(cacheKey, data, { ttl });
  }

  return data;
}

