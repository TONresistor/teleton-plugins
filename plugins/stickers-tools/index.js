/**
 * Stickers Tools plugin -- Telegram sticker market data from stickers.tools
 *
 * Provides real-time stats, floor prices, sales history, charts, burns, and search
 * for Telegram sticker collections on TON blockchain.
 * All data comes from the public Stickers Tools API (no auth required).
 */

const API_BASE = "https://stickers.tools/api/v1";

async function stickerFetch(path, params = {}) {
  const url = new URL(`${API_BASE}/${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null)
      url.searchParams.set(key, String(value));
  }
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Sticker API returned non-JSON (${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok)
    throw new Error(data?.error || `Sticker API error: ${res.status} ${res.statusText}`);
  return data;
}

export const tools = (sdk) => {

// ---------------------------------------------------------------------------
// Tool 1: sticker_search — ALWAYS use this first to find valid IDs
// ---------------------------------------------------------------------------

const stickerSearch = {
  name: "sticker_search",
  description:
    "Search Telegram Sticker NFTs (NOT gifts) by name. Use this FIRST to find valid collection_id and sticker_id before calling other sticker_ tools. " +
    "Returns collection_id, sticker_id, name, collection_name, preview_url, summary_url. " +
    "Example: q='Duck' returns {collection_id:'1', sticker_id:'41', name:'Duck', collection_name:'DOGS OG'}. " +
    "Use sticker_ tools for sticker NFTs. For Telegram gifts use gift_ tools instead",
  category: "data-bearing",

  parameters: {
    type: "object",
    properties: {
      q: {
        type: "string",
        description: "Search query in ENGLISH, min 2 characters. All sticker names are in English. Examples: 'Duck', 'Skull', 'Flame', 'DOGS', 'Pilot'",
      },
      limit: {
        type: "integer",
        description: "Max results, 1-100 (default: 20)",
      },
    },
    required: ["q"],
  },

  execute: async (params) => {
    try {
      const result = await stickerFetch("stickers/search", { q: params.q, limit: params.limit });
      return { success: true, data: result };
    } catch (err) {
      sdk.log.error("sticker_search:", err.message);
      return { success: false, error: String(err.message || err).slice(0, 500) };
    }
  },
};

// ---------------------------------------------------------------------------
// Tool 2: sticker_summary — complete info in one call
// ---------------------------------------------------------------------------

const stickerSummary = {
  name: "sticker_summary",
  description:
    "Get complete Telegram Sticker NFT info in one call: stats, floor prices by platform, recent trades. NOT for gifts. " +
    "REQUIRES valid collection_id and sticker_id — use sticker_search first to find them. " +
    "IDs are numeric strings like '1', '41'. Example: collection_id='1', sticker_id='41' for Duck from DOGS OG",
  category: "data-bearing",

  parameters: {
    type: "object",
    properties: {
      collection_id: {
        type: "string",
        description: "Numeric collection ID (e.g. '1' for DOGS OG). Get from sticker_search",
      },
      sticker_id: {
        type: "string",
        description: "Numeric sticker ID (e.g. '41' for Duck). Get from sticker_search",
      },
      trades_limit: {
        type: "integer",
        description: "Number of recent trades to include, 1-50 (default: 10)",
      },
    },
    required: ["collection_id", "sticker_id"],
  },

  execute: async (params) => {
    try {
      const result = await stickerFetch(
        `stickers/${encodeURIComponent(params.collection_id)}/${encodeURIComponent(params.sticker_id)}/summary`,
        { trades_limit: params.trades_limit }
      );
      return { success: true, data: result };
    } catch (err) {
      sdk.log.error("sticker_summary:", err.message);
      return { success: false, error: String(err.message || err).slice(0, 500) };
    }
  },
};

// ---------------------------------------------------------------------------
// Tool 3: sticker_stats — market overview
// ---------------------------------------------------------------------------

const stickerStats = {
  name: "sticker_stats",
  description:
    "Get Telegram Sticker NFT market statistics (NOT gifts): supply, trades, volumes, market cap, fees. " +
    "IMPORTANT: Always pass exclude='collections' to avoid a huge 1MB response. " +
    "For per-collection data, use sticker_summary or sticker_search instead",
  category: "data-bearing",

  parameters: {
    type: "object",
    properties: {
      include: {
        type: "string",
        description: "Sections to include (comma-separated): overview, collections, supply, trades, init_price, volume, price, mcap, floor, fees, 24h, 7d, 30d. Use 'overview' for compact response",
      },
      exclude: {
        type: "string",
        description: "Sections to exclude (comma-separated). Use 'collections' to skip per-collection data and reduce response size",
      },
      currencies: {
        type: "string",
        description: "Filter currency: usd, ton, or both (default: both)",
      },
      issuers: {
        type: "string",
        description: "Filter by issuer: 'Goodies' or 'Sticker Pack'",
      },
    },
  },

  execute: async (params) => {
    try {
      const result = await stickerFetch("market/stats", {
        include: params.include,
        exclude: params.exclude,
        currencies: params.currencies,
        issuers: params.issuers,
      });
      return { success: true, data: result };
    } catch (err) {
      sdk.log.error("sticker_stats:", err.message);
      return { success: false, error: String(err.message || err).slice(0, 500) };
    }
  },
};

// ---------------------------------------------------------------------------
// Tool 4: sticker_floor
// ---------------------------------------------------------------------------

const stickerFloor = {
  name: "sticker_floor",
  description:
    "Get floor prices by platform (Fragment, Getgems, etc.) for a specific sticker. " +
    "REQUIRES valid IDs — use sticker_search first. IDs are numeric strings like '1', '41'",
  category: "data-bearing",

  parameters: {
    type: "object",
    properties: {
      collection_id: {
        type: "string",
        description: "Numeric collection ID. Get from sticker_search",
      },
      sticker_id: {
        type: "string",
        description: "Numeric sticker ID. Get from sticker_search",
      },
    },
    required: ["collection_id", "sticker_id"],
  },

  execute: async (params) => {
    try {
      const result = await stickerFetch(
        `stickers/${encodeURIComponent(params.collection_id)}/${encodeURIComponent(params.sticker_id)}/floor`
      );
      return { success: true, data: result };
    } catch (err) {
      sdk.log.error("sticker_floor:", err.message);
      return { success: false, error: String(err.message || err).slice(0, 500) };
    }
  },
};

// ---------------------------------------------------------------------------
// Tool 5: sticker_metadata
// ---------------------------------------------------------------------------

const stickerMetadata = {
  name: "sticker_metadata",
  description:
    "Get metadata for a specific sticker (name, image, rarity). " +
    "REQUIRES valid IDs — use sticker_search first",
  category: "data-bearing",

  parameters: {
    type: "object",
    properties: {
      collection_id: {
        type: "string",
        description: "Numeric collection ID. Get from sticker_search",
      },
      sticker_id: {
        type: "string",
        description: "Numeric sticker ID. Get from sticker_search",
      },
    },
    required: ["collection_id", "sticker_id"],
  },

  execute: async (params) => {
    try {
      const result = await stickerFetch(
        `stickers/${encodeURIComponent(params.collection_id)}/${encodeURIComponent(params.sticker_id)}/metadata`
      );
      return { success: true, data: result };
    } catch (err) {
      sdk.log.error("sticker_metadata:", err.message);
      return { success: false, error: String(err.message || err).slice(0, 500) };
    }
  },
};

// ---------------------------------------------------------------------------
// Tool 6: sticker_history
// ---------------------------------------------------------------------------

const stickerHistory = {
  name: "sticker_history",
  description:
    "Get recent sticker sales history with prices, buyers, sellers, platforms. " +
    "Call without params for latest sales. Filter by collections (use numeric IDs from sticker_search). " +
    "Sort by amount_usd DESC to find most expensive sales",
  category: "data-bearing",

  parameters: {
    type: "object",
    properties: {
      limit: { type: "integer", description: "Number of records (default: 50)" },
      offset: { type: "integer", description: "Pagination offset (max 5000)" },
      sort: { type: "string", description: "Sort by: block_time, amount_usd, amount_ton, sticker_number" },
      order: { type: "string", description: "ASC or DESC (default: DESC)" },
      sticker_number: { type: "string", description: "Filter by sticker number" },
      use_regex: { type: "string", description: "Enable regex for sticker_number filter" },
      collections: { type: "string", description: "Filter by collection IDs (comma-separated). Get IDs from sticker_search" },
      packs: { type: "string", description: "Filter by pack IDs (format: collectionId-stickerId, comma-separated)" },
      issuers: { type: "string", description: "Filter by issuer: 'Goodies' or 'Sticker Pack'" },
    },
  },

  execute: async (params) => {
    try {
      const result = await stickerFetch("market/history", {
        limit: params.limit,
        offset: params.offset,
        sort: params.sort,
        order: params.order,
        sticker_number: params.sticker_number,
        use_regex: params.use_regex,
        collections: params.collections,
        packs: params.packs,
        issuers: params.issuers,
      });
      return { success: true, data: result };
    } catch (err) {
      sdk.log.error("sticker_history:", err.message);
      return { success: false, error: String(err.message || err).slice(0, 500) };
    }
  },
};

// ---------------------------------------------------------------------------
// Tool 7: sticker_digest
// ---------------------------------------------------------------------------

const stickerDigest = {
  name: "sticker_digest",
  description:
    "Get Sticker NFT market digest (NOT gifts): top movers, biggest burns, price changes. " +
    "Good for quick sticker market overview without needing IDs",
  category: "data-bearing",

  parameters: {
    type: "object",
    properties: {
      period: { type: "string", description: "Period: '4h', '24h', '7d'. Use '24h' for daily, '7d' for weekly digest" },
      limit: { type: "integer", description: "Number of top items to return (default: 10)" },
      hours: { type: "integer", description: "Custom period in hours. Only works when period is not set" },
      days: { type: "integer", description: "Custom period in days. Only works when period is not set" },
      from: { type: "string", description: "Custom range start (YYYY-MM-DD HH:MM:SS). Use with 'to'" },
      to: { type: "string", description: "Custom range end (YYYY-MM-DD HH:MM:SS). Use with 'from'" },
    },
  },

  execute: async (params) => {
    try {
      const result = await stickerFetch("market/digest", {
        period: params.period,
        limit: params.limit,
        hours: params.hours,
        days: params.days,
        from: params.from,
        to: params.to,
      });
      return { success: true, data: result };
    } catch (err) {
      sdk.log.error("sticker_digest:", err.message);
      return { success: false, error: String(err.message || err).slice(0, 500) };
    }
  },
};

// ---------------------------------------------------------------------------
// Tool 8: sticker_chart_marketcap
// ---------------------------------------------------------------------------

const stickerChartMarketcap = {
  name: "sticker_chart_marketcap",
  description: "Get daily market cap chart data for all stickers",
  category: "data-bearing",

  parameters: {
    type: "object",
    properties: {
      issuers: { type: "string", description: "Filter: 'Goodies' or 'Sticker Pack'" },
    },
  },

  execute: async (params) => {
    try {
      const result = await stickerFetch("charts/marketcap", { issuers: params.issuers });
      return { success: true, data: result };
    } catch (err) {
      sdk.log.error("sticker_chart_marketcap:", err.message);
      return { success: false, error: String(err.message || err).slice(0, 500) };
    }
  },
};

// ---------------------------------------------------------------------------
// Tool 9: sticker_chart_volume
// ---------------------------------------------------------------------------

const stickerChartVolume = {
  name: "sticker_chart_volume",
  description: "Get daily trading volume chart data grouped by platform",
  category: "data-bearing",

  parameters: {
    type: "object",
    properties: {
      issuers: { type: "string", description: "Filter: 'Goodies' or 'Sticker Pack'" },
    },
  },

  execute: async (params) => {
    try {
      const result = await stickerFetch("charts/volume", { issuers: params.issuers });
      return { success: true, data: result };
    } catch (err) {
      sdk.log.error("sticker_chart_volume:", err.message);
      return { success: false, error: String(err.message || err).slice(0, 500) };
    }
  },
};

// ---------------------------------------------------------------------------
// Tool 10: sticker_chart_collection_mcap
// ---------------------------------------------------------------------------

const stickerChartCollectionMcap = {
  name: "sticker_chart_collection_mcap",
  description:
    "Get daily chart for a collection: market cap, volumes, sales, burns. " +
    "REQUIRES valid collection_id — use sticker_search to find it",
  category: "data-bearing",

  parameters: {
    type: "object",
    properties: {
      collection_id: {
        type: "string",
        description: "Numeric collection ID (e.g. '1'). Get from sticker_search",
      },
    },
    required: ["collection_id"],
  },

  execute: async (params) => {
    try {
      const result = await stickerFetch(
        `charts/collections/${encodeURIComponent(params.collection_id)}/mcap`
      );
      return { success: true, data: result };
    } catch (err) {
      sdk.log.error("sticker_chart_collection_mcap:", err.message);
      return { success: false, error: String(err.message || err).slice(0, 500) };
    }
  },
};

// ---------------------------------------------------------------------------
// Tool 11: sticker_chart_sales
// ---------------------------------------------------------------------------

const stickerChartSales = {
  name: "sticker_chart_sales",
  description:
    "Get daily sales chart for a sticker. Use sticker_id='all' for entire collection. " +
    "REQUIRES valid IDs — use sticker_search first",
  category: "data-bearing",

  parameters: {
    type: "object",
    properties: {
      collection_id: { type: "string", description: "Numeric collection ID. Get from sticker_search" },
      sticker_id: { type: "string", description: "Numeric sticker ID or 'all' for entire collection" },
    },
    required: ["collection_id", "sticker_id"],
  },

  execute: async (params) => {
    try {
      const result = await stickerFetch(
        `charts/stickers/${encodeURIComponent(params.collection_id)}/${encodeURIComponent(params.sticker_id)}/sales`
      );
      return { success: true, data: result };
    } catch (err) {
      sdk.log.error("sticker_chart_sales:", err.message);
      return { success: false, error: String(err.message || err).slice(0, 500) };
    }
  },
};

// ---------------------------------------------------------------------------
// Tool 12: sticker_burn_history
// ---------------------------------------------------------------------------

const stickerBurnHistory = {
  name: "sticker_burn_history",
  description: "Get sticker burn history — who burned what and when. Call without params for latest burns. Filter by collections using numeric IDs from sticker_search",
  category: "data-bearing",

  parameters: {
    type: "object",
    properties: {
      limit: { type: "integer", description: "Number of records (default: 50)" },
      offset: { type: "integer", description: "Pagination offset (max 5000)" },
      sort: { type: "string", description: "Sort by: burn_time, floor_price_ton, floor_price_usd, sticker_number, amount_ton, amount_usd" },
      order: { type: "string", description: "ASC or DESC (default: DESC)" },
      sticker_number: { type: "string", description: "Filter by sticker number" },
      use_regex: { type: "string", description: "Enable regex for sticker_number" },
      collections: { type: "string", description: "Filter by collection IDs (comma-separated)" },
      packs: { type: "string", description: "Filter by pack IDs (comma-separated)" },
    },
  },

  execute: async (params) => {
    try {
      const result = await stickerFetch("burn/history", {
        limit: params.limit,
        offset: params.offset,
        sort: params.sort,
        order: params.order,
        stickerNumber: params.stickerNumber,
        useRegex: params.useRegex,
        collections: params.collections,
        packs: params.packs,
      });
      return { success: true, data: result };
    } catch (err) {
      sdk.log.error("sticker_burn_history:", err.message);
      return { success: false, error: String(err.message || err).slice(0, 500) };
    }
  },
};

// ---------------------------------------------------------------------------
// Tool 13: sticker_burn_stats
// ---------------------------------------------------------------------------

const stickerBurnStats = {
  name: "sticker_burn_stats",
  description: "Get burn statistics summary: total burns, unique burners, avg prices, 24h/7d counts. No parameters needed",
  category: "data-bearing",

  parameters: { type: "object", properties: {} },

  execute: async () => {
    try {
      const result = await stickerFetch("burn/stats");
      return { success: true, data: result };
    } catch (err) {
      sdk.log.error("sticker_burn_stats:", err.message);
      return { success: false, error: String(err.message || err).slice(0, 500) };
    }
  },
};

// ---------------------------------------------------------------------------
// Tool 14: sticker_burn_user
// ---------------------------------------------------------------------------

const stickerBurnUser = {
  name: "sticker_burn_user",
  description: "Get burns by a specific user wallet address",
  category: "data-bearing",

  parameters: {
    type: "object",
    properties: {
      burned_by: { type: "string", description: "TON wallet address of the burner" },
      limit: { type: "integer", description: "Number of records (default: 50)" },
      offset: { type: "integer", description: "Pagination offset" },
    },
    required: ["burned_by"],
  },

  execute: async (params) => {
    try {
      const result = await stickerFetch(
        `burn/user/${encodeURIComponent(params.burned_by)}`,
        { limit: params.limit, offset: params.offset }
      );
      return { success: true, data: result };
    } catch (err) {
      sdk.log.error("sticker_burn_user:", err.message);
      return { success: false, error: String(err.message || err).slice(0, 500) };
    }
  },
};

// ---------------------------------------------------------------------------
// Tool 15: sticker_burn_collections
// ---------------------------------------------------------------------------

const stickerBurnCollections = {
  name: "sticker_burn_collections",
  description: "Get burn statistics grouped by collection. No parameters needed",
  category: "data-bearing",

  parameters: { type: "object", properties: {} },

  execute: async () => {
    try {
      const result = await stickerFetch("burn/collections");
      return { success: true, data: result };
    } catch (err) {
      sdk.log.error("sticker_burn_collections:", err.message);
      return { success: false, error: String(err.message || err).slice(0, 500) };
    }
  },
};

// ---------------------------------------------------------------------------
// Tool 16: sticker_chart_burns
// ---------------------------------------------------------------------------

const stickerChartBurns = {
  name: "sticker_chart_burns",
  description:
    "Get burn chart in 4-hour intervals for a sticker. Use sticker_id='all' for entire collection. " +
    "REQUIRES valid IDs — use sticker_search first",
  category: "data-bearing",

  parameters: {
    type: "object",
    properties: {
      collection_id: { type: "string", description: "Numeric collection ID. Get from sticker_search" },
      sticker_id: { type: "string", description: "Numeric sticker ID or 'all' for entire collection" },
    },
    required: ["collection_id", "sticker_id"],
  },

  execute: async (params) => {
    try {
      const result = await stickerFetch(
        `charts/stickers/${encodeURIComponent(params.collection_id)}/${encodeURIComponent(params.sticker_id)}/burns`
      );
      return { success: true, data: result };
    } catch (err) {
      sdk.log.error("sticker_chart_burns:", err.message);
      return { success: false, error: String(err.message || err).slice(0, 500) };
    }
  },
};

// ---------------------------------------------------------------------------
// Tool 17: sticker_burn_statistics
// ---------------------------------------------------------------------------

const stickerBurnStatistics = {
  name: "sticker_burn_statistics",
  description: "Get detailed burn rankings: top packs, collections, and burners by count and value. No parameters needed. " +
    "NOTE: Response contains numeric IDs. To resolve names, call sticker_search with collection names or use sticker_metadata",
  category: "data-bearing",

  parameters: { type: "object", properties: {} },

  execute: async () => {
    try {
      const result = await stickerFetch("burn/statistics");
      return { success: true, data: result };
    } catch (err) {
      sdk.log.error("sticker_burn_statistics:", err.message);
      return { success: false, error: String(err.message || err).slice(0, 500) };
    }
  },
};

// ---------------------------------------------------------------------------
// Tool 18: sticker_metadata_all
// ---------------------------------------------------------------------------

const stickerMetadataAll = {
  name: "sticker_metadata_all",
  description: "Get metadata for ALL collections. WARNING: very large response (~1MB). Prefer sticker_search for finding specific stickers",
  category: "data-bearing",

  parameters: { type: "object", properties: {} },

  execute: async () => {
    try {
      const result = await stickerFetch("market/metadata");
      return { success: true, data: result };
    } catch (err) {
      sdk.log.error("sticker_metadata_all:", err.message);
      return { success: false, error: String(err.message || err).slice(0, 500) };
    }
  },
};

// ---------------------------------------------------------------------------
// Return tools array
// ---------------------------------------------------------------------------

return [
  stickerSearch,
  stickerSummary,
  stickerStats,
  stickerFloor,
  stickerMetadata,
  stickerHistory,
  stickerDigest,
  stickerChartMarketcap,
  stickerChartVolume,
  stickerChartCollectionMcap,
  stickerChartSales,
  stickerBurnHistory,
  stickerBurnStats,
  stickerBurnUser,
  stickerBurnCollections,
  stickerChartBurns,
  stickerBurnStatistics,
  stickerMetadataAll,
];

}; // end tools(sdk)
