/**
 * Gaspump plugin -- Gas111 token launchpad on TON
 *
 * Create, manage, and search tokens on the Gas111 platform.
 * Authenticated endpoints require a Telegram authorization token.
 * Public endpoints (info, search, user list, stats) need no auth.
 */

const API_BASE = "https://api.gas111.com/api/v1";

// Shared fetch helper. Supports GET/POST/PATCH, query params, JSON body, and auth header.
async function gasFetch(path, { method = "GET", params = {}, body = null, auth = null } = {}) {
  const url = new URL(API_BASE + path);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }
  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  if (auth) headers["Authorization"] = auth;
  const opts = { method, headers, signal: AbortSignal.timeout(15000) };
  if (body && method !== "GET") opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gas111 API error: ${res.status} ${text}`.trim());
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Tool 1: gas_login
// Authenticate with Gas111 via Telegram credentials.
// ---------------------------------------------------------------------------

const gasLogin = {
  name: "gas_login",
  description:
    "Log in to Gas111 with Telegram credentials. Returns whether the account is new. Required before creating tokens.",

  parameters: {
    type: "object",
    properties: {
      auth: { type: "string", description: "Telegram authorization token" },
      image_url: { type: "string", description: "Profile image URL (optional)" },
      ref_user_id: { type: "integer", description: "Referral user ID (optional)" },
    },
    required: ["auth"],
  },

  execute: async (params) => {
    try {
      const body = {};
      if (params.image_url !== undefined) body.image_url = params.image_url;
      if (params.ref_user_id !== undefined) body.ref_user_id = params.ref_user_id;
      const result = await gasFetch("/users/login", {
        method: "POST",
        auth: params.auth,
        body: Object.keys(body).length > 0 ? body : null,
      });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
};

// ---------------------------------------------------------------------------
// Tool 2: gas_upload_image
// Upload a base64 image for use as a token icon.
// ---------------------------------------------------------------------------

const gasUploadImage = {
  name: "gas_upload_image",
  description:
    "Upload an image for a token. Takes base64-encoded image data, returns the hosted URL. Call before creating a token.",

  parameters: {
    type: "object",
    properties: {
      auth: { type: "string", description: "Authorization token" },
      image_base64: { type: "string", description: "Base64-encoded image data" },
    },
    required: ["auth", "image_base64"],
  },

  execute: async (params) => {
    try {
      const result = await gasFetch("/images/upload", {
        method: "POST",
        auth: params.auth,
        body: { image_base64: params.image_base64 },
      });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
};

// ---------------------------------------------------------------------------
// Tool 3: gas_create_token
// Launch a new token on Gas111.
// ---------------------------------------------------------------------------

const gasCreateToken = {
  name: "gas_create_token",
  description:
    "Create and launch a new token on Gas111. Requires name, ticker, token address, image URL, and contract version. Optionally add social links and description.",

  parameters: {
    type: "object",
    properties: {
      auth: { type: "string", description: "Authorization token" },
      name: { type: "string", description: "Token name" },
      ticker: { type: "string", description: "Token ticker symbol" },
      token_address: { type: "string", description: "TON token contract address" },
      image_url: { type: "string", description: "Token image URL (from gas_upload_image)" },
      contract_version: { type: "integer", description: "Contract version number" },
      audio_url: { type: "string", description: "Audio URL for audio tokens (optional)" },
      description: { type: "string", description: "Token description (optional)" },
      tg_channel_link: { type: "string", description: "Telegram channel link (optional)" },
      tg_chat_link: { type: "string", description: "Telegram chat link (optional)" },
      twitter_link: { type: "string", description: "Twitter/X link (optional)" },
      website_link: { type: "string", description: "Website URL (optional)" },
      dextype: { type: "string", description: "DEX type (optional)" },
    },
    required: ["auth", "name", "ticker", "token_address", "image_url", "contract_version"],
  },

  execute: async (params) => {
    try {
      const body = {};
      const bodyFields = [
        "name", "ticker", "token_address", "image_url", "contract_version",
        "audio_url", "description", "tg_channel_link", "tg_chat_link",
        "twitter_link", "website_link", "dextype",
      ];
      for (const field of bodyFields) {
        if (params[field] !== undefined) body[field] = params[field];
      }
      const result = await gasFetch("/tokens/create", {
        method: "POST",
        auth: params.auth,
        body,
      });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
};

// ---------------------------------------------------------------------------
// Tool 4: gas_update_token
// Update social links on an existing token.
// ---------------------------------------------------------------------------

const gasUpdateToken = {
  name: "gas_update_token",
  description:
    "Update social links on an existing token (Telegram channel, chat, Twitter, website).",

  parameters: {
    type: "object",
    properties: {
      auth: { type: "string", description: "Authorization token" },
      token_address: { type: "string", description: "Token contract address" },
      tg_channel_link: { type: "string", description: "Telegram channel link" },
      tg_chat_link: { type: "string", description: "Telegram chat link" },
      twitter_link: { type: "string", description: "Twitter/X link" },
      website_link: { type: "string", description: "Website URL" },
    },
    required: ["auth", "token_address"],
  },

  execute: async (params) => {
    try {
      const body = {};
      for (const field of ["tg_channel_link", "tg_chat_link", "twitter_link", "website_link"]) {
        if (params[field] !== undefined) body[field] = params[field];
      }
      const result = await gasFetch("/tokens/update", {
        method: "PATCH",
        params: { token_address: params.token_address },
        auth: params.auth,
        body: Object.keys(body).length > 0 ? body : null,
      });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
};

// ---------------------------------------------------------------------------
// Tool 5: gas_token_info
// Full details on a single token.
// ---------------------------------------------------------------------------

const gasTokenInfo = {
  name: "gas_token_info",
  description:
    "Get full details on a token: name, ticker, market cap, status, holders count, liquidity progress, deployed date, and social links.",

  parameters: {
    type: "object",
    properties: {
      token_address: { type: "string", description: "Token contract address" },
    },
    required: ["token_address"],
  },

  execute: async (params) => {
    try {
      const result = await gasFetch("/tokens/info", {
        params: { token_address: params.token_address },
      });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
};

// ---------------------------------------------------------------------------
// Tool 6: gas_token_search
// Search and list tokens with sorting and filtering.
// ---------------------------------------------------------------------------

const gasTokenSearch = {
  name: "gas_token_search",
  description:
    "Search and list tokens. Sort by market cap, volume, or creation date. Filter by name, creator, or audio tokens.",

  parameters: {
    type: "object",
    properties: {
      search: { type: "string", description: "Search by token name or ticker" },
      sorting_field: {
        type: "string",
        enum: ["market_cap", "volume_24h", "volume_1h", "created_at", "last_traded_at", "dex_status_updated_at"],
        description: "Sort field (default: market_cap)",
      },
      limit: { type: "integer", description: "Max results (default: 100)" },
      offset: { type: "integer", description: "Pagination offset" },
      telegram_id: { type: "integer", description: "Filter by creator Telegram ID" },
      is_audio: { type: "boolean", description: "Filter for audio tokens only" },
      is_full: { type: "boolean", description: "Filter for fully bonded tokens" },
    },
  },

  execute: async (params) => {
    try {
      const result = await gasFetch("/tokens/list", {
        params: {
          search: params.search,
          sorting_field: params.sorting_field,
          limit: params.limit,
          offset: params.offset,
          telegram_id: params.telegram_id,
          is_audio: params.is_audio,
          is_full: params.is_full,
        },
      });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
};

// ---------------------------------------------------------------------------
// Tool 7: gas_user_tokens
// List all tokens created by a specific user.
// ---------------------------------------------------------------------------

const gasUserTokens = {
  name: "gas_user_tokens",
  description: "List all tokens created by a specific user.",

  parameters: {
    type: "object",
    properties: {
      telegram_id: { type: "integer", description: "Telegram user ID" },
      limit: { type: "integer", description: "Max results (default: 100)" },
      offset: { type: "integer", description: "Pagination offset" },
    },
    required: ["telegram_id"],
  },

  execute: async (params) => {
    try {
      const result = await gasFetch("/tokens/user-list", {
        params: {
          telegram_id: params.telegram_id,
          limit: params.limit,
          offset: params.offset,
        },
      });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
};

// ---------------------------------------------------------------------------
// Tool 8: gas_token_stats
// Trading statistics for a token.
// ---------------------------------------------------------------------------

const gasTokenStats = {
  name: "gas_token_stats",
  description:
    "Get trading statistics for a token: volume, number of trades, and other metrics.",

  parameters: {
    type: "object",
    properties: {
      token_address: { type: "string", description: "Token contract address" },
    },
    required: ["token_address"],
  },

  execute: async (params) => {
    try {
      const result = await gasFetch("/transactions/token-stats", {
        params: { token_address: params.token_address },
      });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
};

// ---------------------------------------------------------------------------
// Export -- Teleton picks up everything in this array.
// ---------------------------------------------------------------------------

export const tools = [
  gasLogin,
  gasUploadImage,
  gasCreateToken,
  gasUpdateToken,
  gasTokenInfo,
  gasTokenSearch,
  gasUserTokens,
  gasTokenStats,
];
