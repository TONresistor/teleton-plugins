/**
 * Getgems plugin -- NFT marketplace on TON
 *
 * Browse collections, view NFTs, check traits/offers/history,
 * and buy or list NFTs on the Getgems marketplace.
 * Trading tools sign transactions from the agent wallet at ~/.teleton/wallet.json.
 */

import { createRequire } from "node:module";
import { readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// ---------------------------------------------------------------------------
// CJS dependencies (resolve from teleton runtime)
// ---------------------------------------------------------------------------

const _require = createRequire(realpathSync(process.argv[1]));

const { Address, SendMode, Cell } = _require("@ton/core");
const { WalletContractV5R1, TonClient, internal } = _require("@ton/ton");
const { mnemonicToPrivateKey } = _require("@ton/crypto");

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API_BASE = "https://api.getgems.io/public-api/v1/";
const WALLET_FILE = join(homedir(), ".teleton", "wallet.json");

// ---------------------------------------------------------------------------
// API key
// ---------------------------------------------------------------------------

function getApiKey(context) {
  const key = context?.config?.getgems_api_key;
  if (key) return key;
  if (process.env.GETGEMS_API_KEY) return process.env.GETGEMS_API_KEY;
  try {
    return readFileSync(join(homedir(), ".teleton", "getgems.key"), "utf-8").trim();
  } catch {}
  throw new Error(
    "Getgems API key not found. Set getgems_api_key in ~/.teleton/config.yaml, GETGEMS_API_KEY env var, or create ~/.teleton/getgems.key"
  );
}

// ---------------------------------------------------------------------------
// Shared API helper
// ---------------------------------------------------------------------------

async function gemsApi(path, context, params = {}) {
  const apiKey = getApiKey(context);
  const url = new URL(path, API_BASE);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) {
      if (Array.isArray(v)) {
        v.forEach((item) => url.searchParams.append(k + "[]", item));
      } else {
        url.searchParams.set(k, String(v));
      }
    }
  }
  const res = await fetch(url, {
    headers: { Authorization: apiKey },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Getgems API ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function gemsPost(path, context, body = {}) {
  const apiKey = getApiKey(context);
  const url = new URL(path, API_BASE);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Getgems API ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Price conversion
// ---------------------------------------------------------------------------

function fromNano(nano) {
  if (!nano) return null;
  return (Number(nano) / 1e9).toString();
}

// ---------------------------------------------------------------------------
// Wallet helper
// ---------------------------------------------------------------------------

async function getWalletAndClient() {
  let walletData;
  try {
    walletData = JSON.parse(readFileSync(WALLET_FILE, "utf-8"));
  } catch {
    throw new Error("Agent wallet not found at " + WALLET_FILE);
  }
  if (!walletData.mnemonic || !Array.isArray(walletData.mnemonic)) {
    throw new Error("Invalid wallet file: missing mnemonic array");
  }

  const keyPair = await mnemonicToPrivateKey(walletData.mnemonic);
  const wallet = WalletContractV5R1.create({
    workchain: 0,
    publicKey: keyPair.publicKey,
  });

  let endpoint;
  try {
    const { getHttpEndpoint } = _require("@orbs-network/ton-access");
    endpoint = await getHttpEndpoint({ network: "mainnet" });
  } catch {
    endpoint = "https://toncenter.com/api/v2/jsonRPC";
  }

  const client = new TonClient({ endpoint });
  const contract = client.open(wallet);
  return { wallet, keyPair, client, contract };
}

async function sendGetgemsTransaction(txResponse) {
  const { wallet, keyPair, contract } = await getWalletAndClient();
  const seqno = await contract.getSeqno();

  const messages = txResponse.list.map((item) => {
    const msg = {
      to: Address.parse(item.to),
      value: BigInt(item.amount),
      bounce: true,
    };
    if (item.payload) {
      msg.body = Cell.fromBoc(Buffer.from(item.payload, "base64"))[0];
    }
    if (item.stateInit) {
      msg.init = Cell.fromBoc(Buffer.from(item.stateInit, "base64"))[0];
    }
    return internal(msg);
  });

  await contract.sendTransfer({
    seqno,
    secretKey: keyPair.secretKey,
    sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
    messages,
  });

  return { wallet_address: wallet.address.toString(), seqno };
}

// ---------------------------------------------------------------------------
// Tool 1: getgems_top_collections
// ---------------------------------------------------------------------------

const topCollections = {
  name: "getgems_top_collections",
  description:
    "Get top NFT collections on Getgems ranked by trading volume. Filter by time period (day/week/month/all).",

  parameters: {
    type: "object",
    properties: {
      kind: {
        type: "string",
        enum: ["day", "week", "month", "all"],
        description: "Time period for volume ranking (default: day)",
      },
      limit: {
        type: "integer",
        description: "Number of results (1-100, default: 10)",
        minimum: 1,
        maximum: 100,
      },
    },
  },

  execute: async (params, context) => {
    try {
      const kind = params.kind ?? "day";
      const limit = params.limit ?? 10;
      const data = await gemsApi("collections/top", context, { kind, limit });

      const items = (Array.isArray(data) ? data : []).map((item) => ({
        rank: item.place,
        name: item.collection?.name ?? null,
        address: item.collection?.address ?? null,
        volume_ton: fromNano(item.value),
        floor_price_ton: fromNano(item.floorPrice),
        change_percent: item.diffPercent ?? null,
      }));

      return { success: true, data: { collections: items, count: items.length, period: kind } };
    } catch (err) {
      return { success: false, error: String(err.message || err).slice(0, 500) };
    }
  },
};

// ---------------------------------------------------------------------------
// Tool 2: getgems_collection_info
// ---------------------------------------------------------------------------

const collectionInfo = {
  name: "getgems_collection_info",
  description:
    "Get detailed info about an NFT collection on Getgems including social links, royalty, floor price, and description.",

  parameters: {
    type: "object",
    properties: {
      address: {
        type: "string",
        description: "Collection contract address",
      },
    },
    required: ["address"],
  },

  execute: async (params, context) => {
    try {
      const data = await gemsApi(
        `collection/basic-info/${encodeURIComponent(params.address)}`,
        context
      );
      return { success: true, data };
    } catch (err) {
      return { success: false, error: String(err.message || err).slice(0, 500) };
    }
  },
};

// ---------------------------------------------------------------------------
// Tool 3: getgems_collection_stats
// ---------------------------------------------------------------------------

const collectionStats = {
  name: "getgems_collection_stats",
  description:
    "Get collection statistics: floor price, total volume sold, item count, and number of unique holders.",

  parameters: {
    type: "object",
    properties: {
      address: {
        type: "string",
        description: "Collection contract address",
      },
    },
    required: ["address"],
  },

  execute: async (params, context) => {
    try {
      const data = await gemsApi(
        `collection/stats/${encodeURIComponent(params.address)}`,
        context
      );
      return {
        success: true,
        data: {
          floor_price_ton: fromNano(data.floorPriceNano ?? data.floorPrice),
          items_count: data.itemsCount ?? null,
          total_volume_ton: fromNano(data.totalVolumeSoldNano ?? data.totalVolumeSold),
          holders: data.holders ?? null,
        },
      };
    } catch (err) {
      return { success: false, error: String(err.message || err).slice(0, 500) };
    }
  },
};

// ---------------------------------------------------------------------------
// Tool 4: getgems_collection_attributes
// ---------------------------------------------------------------------------

const collectionAttributes = {
  name: "getgems_collection_attributes",
  description:
    "Get all traits and rarity data for a collection, including floor price per trait value.",

  parameters: {
    type: "object",
    properties: {
      address: {
        type: "string",
        description: "Collection contract address",
      },
    },
    required: ["address"],
  },

  execute: async (params, context) => {
    try {
      const data = await gemsApi(
        `collection/attributes/${encodeURIComponent(params.address)}`,
        context
      );

      const attributes = (Array.isArray(data) ? data : []).map((attr) => ({
        trait_type: attr.traitType,
        values: (attr.values ?? []).map((v) => ({
          value: v.value,
          count: v.count,
          min_price_ton: fromNano(v.minPriceNano ?? v.minPrice),
        })),
      }));

      return { success: true, data: { attributes, count: attributes.length } };
    } catch (err) {
      return { success: false, error: String(err.message || err).slice(0, 500) };
    }
  },
};

// ---------------------------------------------------------------------------
// Tool 5: getgems_collection_history
// ---------------------------------------------------------------------------

const collectionHistory = {
  name: "getgems_collection_history",
  description:
    "Get activity history for a collection: sales, transfers, mints, listings, auctions, burns. Supports filtering by event type and cursor pagination.",

  parameters: {
    type: "object",
    properties: {
      address: {
        type: "string",
        description: "Collection contract address",
      },
      types: {
        type: "array",
        items: {
          type: "string",
          enum: [
            "mint",
            "transfer",
            "sold",
            "cancelSale",
            "putUpForSale",
            "putUpForAuction",
            "cancelAuction",
            "burn",
          ],
        },
        description: "Filter by event types (e.g. [\"sold\", \"transfer\"])",
      },
      limit: {
        type: "integer",
        description: "Number of results (1-100, default: 20)",
        minimum: 1,
        maximum: 100,
      },
      after: {
        type: "string",
        description: "Cursor for pagination (from previous response)",
      },
    },
    required: ["address"],
  },

  execute: async (params, context) => {
    try {
      const queryParams = {
        limit: params.limit ?? 20,
        after: params.after,
      };
      if (Array.isArray(params.types) && params.types.length > 0) {
        queryParams.types = params.types;
      }
      const data = await gemsApi(
        `collection/history/${encodeURIComponent(params.address)}`,
        context,
        queryParams
      );
      return { success: true, data };
    } catch (err) {
      return { success: false, error: String(err.message || err).slice(0, 500) };
    }
  },
};

// ---------------------------------------------------------------------------
// Tool 6: getgems_nft_info
// ---------------------------------------------------------------------------

const nftInfo = {
  name: "getgems_nft_info",
  description:
    "Get full details for a specific NFT: owner, sale status, price, attributes, image, and collection. Shows if the NFT is listed for sale or at auction.",

  parameters: {
    type: "object",
    properties: {
      address: {
        type: "string",
        description: "NFT item contract address",
      },
    },
    required: ["address"],
  },

  execute: async (params, context) => {
    try {
      const data = await gemsApi(
        `nft/${encodeURIComponent(params.address)}`,
        context
      );

      const result = {
        address: data.address,
        name: data.name ?? null,
        description: data.description ?? null,
        collection_address: data.collectionAddress ?? null,
        owner: data.actualOwnerAddress ?? data.ownerAddress ?? null,
        image: data.image ?? null,
        attributes: data.attributes ?? [],
        warning: data.warning ?? null,
      };

      if (data.sale) {
        if (data.sale.fullPrice) {
          result.sale = {
            type: "fixed_price",
            price_ton: fromNano(data.sale.fullPrice),
            currency: data.sale.currency ?? "TON",
            marketplace: data.sale.marketplace ?? null,
            sale_address: data.sale.saleAddress ?? null,
            version: data.sale.version ?? null,
          };
        } else if (data.sale.maxBid !== undefined || data.sale.currentBid !== undefined) {
          result.sale = {
            type: "auction",
            current_bid_ton: fromNano(data.sale.currentBid),
            min_bid_ton: fromNano(data.sale.minBid),
            max_bid_ton: fromNano(data.sale.maxBid),
            bids_count: data.sale.bidsCount ?? 0,
            end_time: data.sale.endTime ?? null,
          };
        } else {
          result.sale = data.sale;
        }
      } else {
        result.sale = null;
      }

      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: String(err.message || err).slice(0, 500) };
    }
  },
};

// ---------------------------------------------------------------------------
// Tool 7: getgems_nft_history
// ---------------------------------------------------------------------------

const nftHistory = {
  name: "getgems_nft_history",
  description:
    "Get trade and transfer history for a specific NFT. Supports filtering by event type and cursor pagination.",

  parameters: {
    type: "object",
    properties: {
      address: {
        type: "string",
        description: "NFT item contract address",
      },
      types: {
        type: "array",
        items: {
          type: "string",
          enum: [
            "mint",
            "transfer",
            "sold",
            "cancelSale",
            "putUpForSale",
            "putUpForAuction",
            "cancelAuction",
            "burn",
          ],
        },
        description: "Filter by event types",
      },
      limit: {
        type: "integer",
        description: "Number of results (1-100, default: 20)",
        minimum: 1,
        maximum: 100,
      },
      after: {
        type: "string",
        description: "Cursor for pagination",
      },
    },
    required: ["address"],
  },

  execute: async (params, context) => {
    try {
      const queryParams = {
        limit: params.limit ?? 20,
        after: params.after,
      };
      if (Array.isArray(params.types) && params.types.length > 0) {
        queryParams.types = params.types;
      }
      const data = await gemsApi(
        `nft/history/${encodeURIComponent(params.address)}`,
        context,
        queryParams
      );
      return { success: true, data };
    } catch (err) {
      return { success: false, error: String(err.message || err).slice(0, 500) };
    }
  },
};

// ---------------------------------------------------------------------------
// Tool 8: getgems_nfts_on_sale
// ---------------------------------------------------------------------------

const nftsOnSale = {
  name: "getgems_nfts_on_sale",
  description:
    "Get NFTs currently listed for sale in a collection. Returns sale price, owner, and NFT details with cursor pagination.",

  parameters: {
    type: "object",
    properties: {
      address: {
        type: "string",
        description: "Collection contract address",
      },
      limit: {
        type: "integer",
        description: "Number of results (1-100, default: 20)",
        minimum: 1,
        maximum: 100,
      },
      after: {
        type: "string",
        description: "Cursor for pagination",
      },
    },
    required: ["address"],
  },

  execute: async (params, context) => {
    try {
      const data = await gemsApi(
        `nfts/on-sale/${encodeURIComponent(params.address)}`,
        context,
        { limit: params.limit ?? 20, after: params.after }
      );
      return { success: true, data };
    } catch (err) {
      return { success: false, error: String(err.message || err).slice(0, 500) };
    }
  },
};

// ---------------------------------------------------------------------------
// Tool 9: getgems_nft_offers
// ---------------------------------------------------------------------------

const nftOffers = {
  name: "getgems_nft_offers",
  description:
    "Get active buy offers on a specific NFT, including offer price, royalty fees, and expiration time.",

  parameters: {
    type: "object",
    properties: {
      address: {
        type: "string",
        description: "NFT item contract address",
      },
      limit: {
        type: "integer",
        description: "Number of results (1-100, default: 20)",
        minimum: 1,
        maximum: 100,
      },
    },
    required: ["address"],
  },

  execute: async (params, context) => {
    try {
      const data = await gemsApi(
        `offers/nft/${encodeURIComponent(params.address)}`,
        context,
        { limit: params.limit ?? 20 }
      );

      const offers = (Array.isArray(data) ? data : []).map((o) => ({
        offer_address: o.offerAddress ?? null,
        price_ton: fromNano(o.fullPrice),
        profit_ton: fromNano(o.profitPrice),
        royalty_ton: fromNano(o.royaltyPrice),
        fee_ton: fromNano(o.feePrice),
        currency: o.currency ?? "TON",
        expires_at: o.finishAt ?? null,
        is_collection_offer: o.isCollectionOffer ?? false,
        nft_address: o.nftAddress ?? null,
        collection_address: o.collectionAddress ?? null,
      }));

      return { success: true, data: { offers, count: offers.length } };
    } catch (err) {
      return { success: false, error: String(err.message || err).slice(0, 500) };
    }
  },
};

// ---------------------------------------------------------------------------
// Tool 10: getgems_owner_nfts
// ---------------------------------------------------------------------------

const ownerNfts = {
  name: "getgems_owner_nfts",
  description:
    "Get all NFTs owned by a wallet address on Getgems. Returns NFT details with cursor pagination.",

  parameters: {
    type: "object",
    properties: {
      address: {
        type: "string",
        description: "Owner wallet address",
      },
      limit: {
        type: "integer",
        description: "Number of results (1-100, default: 20)",
        minimum: 1,
        maximum: 100,
      },
      after: {
        type: "string",
        description: "Cursor for pagination",
      },
    },
    required: ["address"],
  },

  execute: async (params, context) => {
    try {
      const data = await gemsApi(
        `nfts/owner/${encodeURIComponent(params.address)}`,
        context,
        { limit: params.limit ?? 20, after: params.after }
      );
      return { success: true, data };
    } catch (err) {
      return { success: false, error: String(err.message || err).slice(0, 500) };
    }
  },
};

// ---------------------------------------------------------------------------
// Tool 11: getgems_user_trading
// ---------------------------------------------------------------------------

const userTrading = {
  name: "getgems_user_trading",
  description:
    "Get trading statistics for a user: number of trades, total volume, and current balance on Getgems.",

  parameters: {
    type: "object",
    properties: {
      address: {
        type: "string",
        description: "User wallet address",
      },
    },
    required: ["address"],
  },

  execute: async (params, context) => {
    try {
      const data = await gemsApi(
        `user-trading-info/${encodeURIComponent(params.address)}`,
        context
      );
      return {
        success: true,
        data: {
          trading_count: data.tradingCount ?? null,
          trading_volume_ton: fromNano(data.tradingVolume),
          balance_ton: fromNano(data.balance),
        },
      };
    } catch (err) {
      return { success: false, error: String(err.message || err).slice(0, 500) };
    }
  },
};

// ---------------------------------------------------------------------------
// Tool 12: getgems_gift_collections
// ---------------------------------------------------------------------------

const giftCollections = {
  name: "getgems_gift_collections",
  description:
    "List Telegram Gift NFT collections on Getgems. Returns collection details with cursor pagination.",

  parameters: {
    type: "object",
    properties: {
      limit: {
        type: "integer",
        description: "Number of results (1-100, default: 20)",
        minimum: 1,
        maximum: 100,
      },
      after: {
        type: "string",
        description: "Cursor for pagination",
      },
    },
  },

  execute: async (params, context) => {
    try {
      const data = await gemsApi("gifts/collections", context, {
        limit: params.limit ?? 20,
        after: params.after,
      });
      return { success: true, data };
    } catch (err) {
      return { success: false, error: String(err.message || err).slice(0, 500) };
    }
  },
};

// ---------------------------------------------------------------------------
// Tool 13: getgems_buy_nft
// ---------------------------------------------------------------------------

const buyNft = {
  name: "getgems_buy_nft",
  description:
    "Buy an NFT listed for fixed-price sale on Getgems. Signs and sends the purchase transaction from the agent wallet. The NFT must currently be listed for sale.",

  parameters: {
    type: "object",
    properties: {
      address: {
        type: "string",
        description: "NFT item contract address to buy",
      },
    },
    required: ["address"],
  },

  execute: async (params, context) => {
    const steps = [];
    try {
      // Step 1: Get NFT info and sale version
      const nft = await gemsApi(
        `nft/${encodeURIComponent(params.address)}`,
        context
      );
      steps.push("fetched NFT info");

      if (!nft.sale || !nft.sale.fullPrice) {
        throw new Error("NFT is not listed for fixed-price sale");
      }

      const version = nft.sale.version;
      if (!version) {
        throw new Error("Sale version not found on NFT sale object");
      }

      const priceTon = fromNano(nft.sale.fullPrice);
      steps.push(`sale price: ${priceTon} TON, version: ${version}`);

      // Step 2: Get buy transaction from Getgems
      const tx = await gemsPost(
        `nfts/buy-fix-price/${encodeURIComponent(params.address)}`,
        context,
        { version }
      );
      steps.push(`got transaction: ${tx.list?.length ?? 0} messages`);

      if (!tx.list || tx.list.length === 0) {
        throw new Error("Getgems returned empty transaction list");
      }

      // Step 3: Sign and send
      const result = await sendGetgemsTransaction(tx);
      steps.push("transaction sent");

      return {
        success: true,
        data: {
          nft_address: params.address,
          nft_name: nft.name ?? null,
          price_ton: priceTon,
          wallet_address: result.wallet_address,
          seqno: result.seqno,
          messages_sent: tx.list.length,
          steps,
          message: "Buy transaction sent. Allow ~30 seconds for on-chain confirmation.",
        },
      };
    } catch (err) {
      return { success: false, error: String(err.message || err).slice(0, 500), steps };
    }
  },
};

// ---------------------------------------------------------------------------
// Tool 14: getgems_list_nft
// ---------------------------------------------------------------------------

const listNft = {
  name: "getgems_list_nft",
  description:
    "List an NFT for fixed-price sale on Getgems. Sets the sale price and signs the listing transaction from the agent wallet. The agent must own the NFT.",

  parameters: {
    type: "object",
    properties: {
      address: {
        type: "string",
        description: "NFT item contract address to list",
      },
      price: {
        type: "string",
        description: "Sale price in TON (e.g. \"5.5\" for 5.5 TON)",
      },
      currency: {
        type: "string",
        description: "Currency for the listing (default: TON)",
      },
    },
    required: ["address", "price"],
  },

  execute: async (params, context) => {
    const steps = [];
    try {
      const priceTon = Number(params.price);
      if (isNaN(priceTon) || priceTon <= 0) {
        throw new Error("price must be a positive number in TON");
      }

      // Get wallet address for ownerAddress field
      const { wallet } = await getWalletAndClient();
      const ownerAddress = wallet.address.toString();
      steps.push("resolved wallet: " + ownerAddress);

      // Convert to nanoTON string
      const fullPrice = BigInt(Math.round(priceTon * 1e9)).toString();
      steps.push(`price: ${params.price} TON = ${fullPrice} nanoTON`);

      // POST to put-on-sale
      const tx = await gemsPost(
        `nfts/put-on-sale-fix-price/${encodeURIComponent(params.address)}`,
        context,
        {
          ownerAddress,
          fullPrice,
          currency: params.currency ?? "TON",
        }
      );
      steps.push(`got transaction: ${tx.list?.length ?? 0} messages`);

      if (!tx.list || tx.list.length === 0) {
        throw new Error("Getgems returned empty transaction list");
      }

      // Sign and send
      const result = await sendGetgemsTransaction(tx);
      steps.push("transaction sent");

      return {
        success: true,
        data: {
          nft_address: params.address,
          price_ton: params.price,
          currency: params.currency ?? "TON",
          wallet_address: result.wallet_address,
          seqno: result.seqno,
          messages_sent: tx.list.length,
          steps,
          message: "Listing transaction sent. Allow ~30 seconds for on-chain confirmation.",
        },
      };
    } catch (err) {
      return { success: false, error: String(err.message || err).slice(0, 500), steps };
    }
  },
};

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const tools = [
  topCollections,
  collectionInfo,
  collectionStats,
  collectionAttributes,
  collectionHistory,
  nftInfo,
  nftHistory,
  nftsOnSale,
  nftOffers,
  ownerNfts,
  userTrading,
  giftCollections,
  buyNft,
  listNft,
];
