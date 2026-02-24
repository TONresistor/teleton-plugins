/**
 * Webdom marketplace action tools — on-chain interactions for buying, selling,
 * auctioning, bidding, offering, and cancelling domain deals.
 */

import { createRequire } from "node:module";
import { realpathSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

import {
  WEBDOM_MARKETPLACE,
  OP,
} from "../lib/constants.js";

// ---------------------------------------------------------------------------
// TON dependencies (CJS — use createRequire for ESM compat)
// ---------------------------------------------------------------------------

const _require = createRequire(realpathSync(process.argv[1]));
const { Address, beginCell, toNano, SendMode } = _require("@ton/core");
const { WalletContractV5R1, TonClient, internal } = _require("@ton/ton");
const { mnemonicToPrivateKey } = _require("@ton/crypto");

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WALLET_FILE = join(homedir(), ".teleton", "wallet.json");

// ---------------------------------------------------------------------------
// RPC endpoint resolution (same logic as core endpoint.ts)
// ---------------------------------------------------------------------------

const ORBS_TOPOLOGY = "https://ton.access.orbs.network/mngr/nodes?npm_version=2.3.3";
const TONCENTER_FALLBACK = "https://toncenter.com/api/v2/jsonRPC";

async function getAllEndpoints() {
  const endpoints = [];
  try {
    const res = await fetch(ORBS_TOPOLOGY, { signal: AbortSignal.timeout(5000) });
    const nodes = await res.json();
    const healthy = nodes.filter(
      (n) => n.Healthy === "1" && n.Weight > 0 && n.Mngr?.health?.["v2-mainnet"]
    );
    // pick 2 random orbs nodes for redundancy
    const shuffled = healthy.sort(() => Math.random() - 0.5);
    for (const node of shuffled.slice(0, 2)) {
      endpoints.push(`https://ton.access.orbs.network/${node.NodeId}/1/mainnet/toncenter-api-v2/jsonRPC`);
    }
  } catch {
    _log?.warn("[webdom] orbs topology fetch failed");
  }
  endpoints.push(TONCENTER_FALLBACK);
  return endpoints;
}
const MARKETPLACE = Address.parse(WEBDOM_MARKETPLACE);

const GAS_PURCHASE = toNano("1");     // nft_sale_v2 requires full_price + 1 TON
const GAS_BID      = toNano("0.07");
const GAS_CANCEL   = toNano("0.05");
const FORWARD_NFT  = toNano("0.3");
const OP_MASK = 0x0fffffff;

// NFT transfer op (TEP-62)
const NFT_TRANSFER_OP = 0x5fcc3d14;

// nft_sale_v2 ops
const OP_BUY    = 2;
const OP_CANCEL = 3;

// ---------------------------------------------------------------------------
// Wallet helper
// ---------------------------------------------------------------------------

let _log = null;

function loadWalletKeyPair() {
  let walletData;
  try {
    walletData = JSON.parse(readFileSync(WALLET_FILE, "utf-8"));
  } catch (err) {
    _log?.error("[webdom] wallet read failed:", err.message);
    throw new Error("Agent wallet not found at " + WALLET_FILE);
  }
  if (!walletData.mnemonic || !Array.isArray(walletData.mnemonic)) {
    throw new Error("Invalid wallet file: missing mnemonic array");
  }
  return walletData.mnemonic;
}

async function getSaleData(saleAddr) {
  const endpoints = await getAllEndpoints();
  let lastErr;
  for (const ep of endpoints) {
    try {
      const client = new TonClient({ endpoint: ep });
      const res = await client.runMethod(saleAddr, "get_sale_data");
      // nft_sale_v2 returns: (is_complete, created_at, marketplace_address,
      //   nft_address, nft_owner_address, full_price, marketplace_fee_address,
      //   marketplace_fee, royalty_address, royalty_amount)
      const isComplete = res.stack.readNumber();
      res.stack.readNumber(); // created_at
      res.stack.readAddress(); // marketplace_address
      const nftAddress = res.stack.readAddress();
      const nftOwner = res.stack.readAddress();
      const fullPrice = res.stack.readBigNumber();
      return { isComplete, nftAddress, nftOwner, fullPrice };
    } catch (err) {
      lastErr = err;
    }
  }
  throw new Error("Could not read sale data: " + lastErr?.message);
}

async function sendTransaction(to, value, body) {
  _log?.info("[webdom] sendTransaction to:", to.toString(), "value:", value.toString());

  const mnemonic = loadWalletKeyPair();
  const keyPair = await mnemonicToPrivateKey(mnemonic);
  const wallet = WalletContractV5R1.create({ workchain: 0, publicKey: keyPair.publicKey });
  _log?.info("[webdom] wallet:", wallet.address.toString({ bounceable: true }));

  const endpoints = await getAllEndpoints();
  let lastErr;

  for (const ep of endpoints) {
    try {
      _log?.info("[webdom] trying endpoint:", ep);
      const client = new TonClient({ endpoint: ep });
      const contract = client.open(wallet);

      const seqno = await contract.getSeqno();
      _log?.info("[webdom] seqno:", seqno);

      // toncenter rate limit without API key — need ~3s between requests
      if (ep.includes("toncenter.com")) await new Promise((r) => setTimeout(r, 3000));

      await contract.sendTransfer({
        seqno,
        secretKey: keyPair.secretKey,
        sendMode: SendMode.PAY_GAS_SEPARATELY | SendMode.IGNORE_ERRORS,
        messages: [
          internal({ to, value, body, bounce: true }),
        ],
      });

      _log?.info("[webdom] transaction sent via", ep, "seqno:", seqno);
      return {
        tx_seqno: seqno,
        wallet_address: wallet.address.toString({ bounceable: true }),
      };
    } catch (err) {
      _log?.warn("[webdom] endpoint failed:", ep, err.message);
      lastErr = err;
      // wait 1s before trying next endpoint
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  throw new Error("All RPC endpoints failed: " + lastErr?.message);
}

// ---------------------------------------------------------------------------
// Address validation helper
// ---------------------------------------------------------------------------

function parseAddress(raw, label) {
  try {
    return Address.parse(raw);
  } catch {
    throw new Error(`Invalid ${label} address: ${raw}`);
  }
}

// ---------------------------------------------------------------------------
// NFT transfer helper (TEP-62)
// ---------------------------------------------------------------------------

function buildNftTransferBody(newOwner, responseAddr, forwardAmount, forwardPayload) {
  return beginCell()
    .storeUint(NFT_TRANSFER_OP, 32)   // op: nft_transfer
    .storeUint(0, 64)                  // query_id
    .storeAddress(newOwner)            // new_owner
    .storeAddress(responseAddr)        // response_destination
    .storeBit(false)                   // no custom_payload
    .storeCoins(forwardAmount)         // forward_amount
    .storeMaybeRef(forwardPayload)     // forward_payload as ref
    .endCell();
}

// ---------------------------------------------------------------------------
// Action tools
// ---------------------------------------------------------------------------

export const actionTools = (sdk) => {
  _log = sdk.log;

  return [

  // ── 1. webdom_buy_domain ────────────────────────────────────────────────
  {
    name: "webdom_buy_domain",
    description:
      "Purchase a .ton domain or .t.me username listed at a fixed price on webdom. " +
      "Requires the sale contract address (from domain listing) and the price in TON. " +
      "Verifies the on-chain price before sending. The transaction sends price + 1 TON gas.",
    category: "action",
    scope: "dm-only",
    parameters: {
      type: "object",
      properties: {
        sale_address: {
          type: "string",
          description:
            "The sale contract address (starts with EQ or UQ). Get this from webdom_domain_info sale_address field.",
        },
        price_ton: {
          type: "number",
          description: "Domain price in TON (e.g. 5.5). Must match the listed price.",
        },
      },
      required: ["sale_address", "price_ton"],
      additionalProperties: false,
    },
    execute: async (params) => {
      try {
        const saleAddr = parseAddress(params.sale_address, "sale_address");
        if (!Number.isFinite(params.price_ton) || params.price_ton <= 0) {
          return { success: false, error: "price_ton must be a positive number" };
        }

        // Verify sale contract on-chain before sending funds
        _log?.info("[webdom] reading get_sale_data for", params.sale_address);
        const saleData = await getSaleData(saleAddr);

        if (saleData.isComplete !== 0) {
          return { success: false, error: "Sale is already completed or cancelled" };
        }

        const onChainPrice = saleData.fullPrice;
        const userPrice = toNano(String(params.price_ton));

        // Warn if user price doesn't match on-chain price (allow small rounding)
        if (userPrice < onChainPrice) {
          const actualTon = Number(onChainPrice) / 1e9;
          return {
            success: false,
            error: `On-chain price is ${actualTon} TON but you specified ${params.price_ton} TON. Use the on-chain price.`,
          };
        }

        // nft_sale_v2: value must be >= full_price + 1 TON (min_gas_amount)
        const value = onChainPrice + GAS_PURCHASE;

        // nft_sale_v2 buy op: op=2, query_id=0
        const body = beginCell()
          .storeUint(OP_BUY, 32)
          .storeUint(0, 64)
          .endCell();

        _log?.info("[webdom] buying domain, price:", onChainPrice.toString(), "total:", value.toString());
        const result = await sendTransaction(saleAddr, value, body);

        const priceTon = Number(onChainPrice) / 1e9;
        return {
          success: true,
          data: {
            ...result,
            on_chain_price_ton: priceTon,
            message: `Purchase transaction sent: ${priceTon} TON + 1 TON gas to sale contract ${params.sale_address}. NFT will be transferred to your wallet on success.`,
          },
        };
      } catch (err) {
        _log?.error("[webdom] buy_domain failed:", err.message, err.stack);
        return { success: false, error: err.message };
      }
    },
  },

  // ── 2. webdom_list_for_sale ─────────────────────────────────────────────
  {
    name: "webdom_list_for_sale",
    description:
      "List a .ton domain or .t.me username for sale at a fixed price on webdom marketplace. " +
      "Transfers the domain NFT to the marketplace which deploys a sale contract. " +
      "You must own the domain to list it.",
    category: "action",
    scope: "dm-only",
    parameters: {
      type: "object",
      properties: {
        domain_address: {
          type: "string",
          description: "The domain NFT contract address (starts with EQ or UQ).",
        },
        price_ton: {
          type: "number",
          description: "Sale price in TON (e.g. 10.5).",
        },
        duration_days: {
          type: "integer",
          description: "How long the listing stays active, in days (default 30).",
        },
      },
      required: ["domain_address", "price_ton"],
      additionalProperties: false,
    },
    execute: async (params) => {
      try {
        const domainAddr = parseAddress(params.domain_address, "domain_address");
        if (!Number.isFinite(params.price_ton) || params.price_ton <= 0) {
          return { success: false, error: "price_ton must be a positive number" };
        }

        const durationDays = params.duration_days || 30;
        const validUntil = Math.floor(Date.now() / 1000) + durationDays * 86400;

        // Build deploy payload for TonSimpleSale
        const deployPayload = beginCell()
          .storeUint(OP.TON_SIMPLE_SALE & OP_MASK, 28)
          .storeCoins(toNano(String(params.price_ton)))
          .storeUint(validUntil, 32)
          .endCell();

        // Need wallet address for response_destination in NFT transfer
        const mnemonic = loadWalletKeyPair();
        const keyPair = await mnemonicToPrivateKey(mnemonic);
        const wallet = WalletContractV5R1.create({ workchain: 0, publicKey: keyPair.publicKey });
        const senderAddr = wallet.address;

        // Build NFT transfer body
        const body = buildNftTransferBody(MARKETPLACE, senderAddr, FORWARD_NFT, deployPayload);

        const result = await sendTransaction(domainAddr, FORWARD_NFT + toNano("0.05"), body);

        return {
          success: true,
          data: {
            ...result,
            message: `Domain ${params.domain_address} listed for sale at ${params.price_ton} TON for ${durationDays} days. Marketplace will deploy a sale contract.`,
          },
        };
      } catch (err) {
        _log?.error("[webdom] list_for_sale failed:", err.message, err.stack);
        return { success: false, error: err.message };
      }
    },
  },

  // ── 3. webdom_create_auction ────────────────────────────────────────────
  {
    name: "webdom_create_auction",
    description:
      "Create an auction for a .ton domain or .t.me username on webdom marketplace. " +
      "Transfers the domain NFT to the marketplace which deploys an auction contract. " +
      "You must own the domain to auction it.",
    category: "action",
    scope: "dm-only",
    parameters: {
      type: "object",
      properties: {
        domain_address: {
          type: "string",
          description: "The domain NFT contract address (starts with EQ or UQ).",
        },
        min_bid_ton: {
          type: "number",
          description: "Minimum starting bid in TON (e.g. 1.0).",
        },
        duration_hours: {
          type: "integer",
          description: "Auction duration in hours (default 24).",
        },
      },
      required: ["domain_address", "min_bid_ton"],
      additionalProperties: false,
    },
    execute: async (params) => {
      try {
        const domainAddr = parseAddress(params.domain_address, "domain_address");
        if (!Number.isFinite(params.min_bid_ton) || params.min_bid_ton <= 0) {
          return { success: false, error: "min_bid_ton must be a positive number" };
        }

        const durationHours = params.duration_hours || 24;
        const durationSeconds = durationHours * 3600;

        // Build deploy payload for TonSimpleAuction
        const deployPayload = beginCell()
          .storeUint(OP.TON_SIMPLE_AUCTION & OP_MASK, 28)
          .storeCoins(toNano(String(params.min_bid_ton)))
          .storeUint(durationSeconds, 32)
          .endCell();

        // Need wallet address for response_destination in NFT transfer
        const mnemonic = loadWalletKeyPair();
        const keyPair = await mnemonicToPrivateKey(mnemonic);
        const wallet = WalletContractV5R1.create({ workchain: 0, publicKey: keyPair.publicKey });
        const senderAddr = wallet.address;

        const body = buildNftTransferBody(MARKETPLACE, senderAddr, FORWARD_NFT, deployPayload);

        const result = await sendTransaction(domainAddr, FORWARD_NFT + toNano("0.05"), body);

        return {
          success: true,
          data: {
            ...result,
            message: `Auction created for ${params.domain_address} with minimum bid ${params.min_bid_ton} TON, duration ${durationHours} hours.`,
          },
        };
      } catch (err) {
        _log?.error("[webdom] create_auction failed:", err.message, err.stack);
        return { success: false, error: err.message };
      }
    },
  },

  // ── 4. webdom_place_bid ─────────────────────────────────────────────────
  {
    name: "webdom_place_bid",
    description:
      "Place a bid on an active domain auction on webdom. " +
      "Sends bid amount + 0.07 TON gas to the auction contract. " +
      "Your bid must be higher than the current highest bid.",
    category: "action",
    scope: "dm-only",
    parameters: {
      type: "object",
      properties: {
        auction_address: {
          type: "string",
          description:
            "The auction contract address (starts with EQ or UQ). Get this from webdom_domain_info sale_address field.",
        },
        bid_ton: {
          type: "number",
          description: "Bid amount in TON (e.g. 3.0). Must exceed current highest bid.",
        },
      },
      required: ["auction_address", "bid_ton"],
      additionalProperties: false,
    },
    execute: async (params) => {
      try {
        const auctionAddr = parseAddress(params.auction_address, "auction_address");
        if (!Number.isFinite(params.bid_ton) || params.bid_ton <= 0) {
          return { success: false, error: "bid_ton must be positive" };
        }

        const value = toNano(String(params.bid_ton)) + GAS_BID;
        const body = beginCell().endCell();
        const result = await sendTransaction(auctionAddr, value, body);

        return {
          success: true,
          data: {
            ...result,
            message: `Bid of ${params.bid_ton} TON placed on auction ${params.auction_address}. Previous highest bidder will be refunded automatically.`,
          },
        };
      } catch (err) {
        _log?.error("[webdom]", this?.name || "action", "failed:", err.message, err.stack);
        return { success: false, error: err.message };
      }
    },
  },

  // ── 5. webdom_cancel_deal ───────────────────────────────────────────────
  {
    name: "webdom_cancel_deal",
    description:
      "Cancel an active sale, auction, or offer on webdom marketplace. " +
      "For sales and auctions, you must be the seller. For offers, you must be the buyer. " +
      "Auctions can only be cancelled if there are no bids yet.",
    category: "action",
    scope: "dm-only",
    parameters: {
      type: "object",
      properties: {
        deal_address: {
          type: "string",
          description: "The deal contract address to cancel (sale, auction, or offer contract).",
        },
        deal_type: {
          type: "string",
          enum: ["sale", "auction", "offer"],
          description: "Type of deal to cancel.",
        },
      },
      required: ["deal_address", "deal_type"],
      additionalProperties: false,
    },
    execute: async (params) => {
      try {
        const dealAddr = parseAddress(params.deal_address, "deal_address");

        // nft_sale_v2 cancel: op=3, query_id=0
        const body = beginCell()
          .storeUint(OP_CANCEL, 32)
          .storeUint(0, 64)
          .endCell();

        const result = await sendTransaction(dealAddr, GAS_CANCEL, body);

        return {
          success: true,
          data: {
            ...result,
            message: `Cancellation sent for ${params.deal_type} at ${params.deal_address}. Domain/funds will be returned to your wallet.`,
          },
        };
      } catch (err) {
        _log?.error("[webdom]", this?.name || "action", "failed:", err.message, err.stack);
        return { success: false, error: err.message };
      }
    },
  },

  // ── 7. webdom_dns_bid ─────────────────────────────────────────────────
  {
    name: "webdom_dns_bid",
    description:
      "Place a bid on a native TON DNS auction (initial domain registration or expired domain re-auction). " +
      "This is different from webdom marketplace auctions — it interacts directly with the TON DNS system. " +
      "You can provide either the domain name (e.g. 'teleton.ton') or the domain NFT address. " +
      "The domain NFT address is resolved automatically via TONAPI if only the name is given. " +
      "Minimum prices by length: 4 chars=100 TON, 5=50, 6=40, 7=30, 8=20, 9=10, 10=5, 11+=1 TON. " +
      "Bids must exceed the current highest bid (typically by at least 5%).",
    category: "action",
    scope: "dm-only",
    parameters: {
      type: "object",
      properties: {
        domain_name: {
          type: "string",
          description:
            'The .ton domain name (e.g. "teleton.ton" or "teleton"). The .ton suffix is optional.',
        },
        domain_nft_address: {
          type: "string",
          description:
            "The domain NFT contract address (starts with EQ or UQ). If provided, skips TONAPI resolution.",
        },
        bid_ton: {
          type: "number",
          description: "Bid amount in TON. Must exceed current highest bid.",
        },
      },
      required: ["bid_ton"],
      additionalProperties: false,
    },
    execute: async (params) => {
      try {
        if (!Number.isFinite(params.bid_ton) || params.bid_ton <= 0) {
          return { success: false, error: "bid_ton must be positive" };
        }
        if (!params.domain_name && !params.domain_nft_address) {
          return { success: false, error: "Provide either domain_name or domain_nft_address" };
        }

        let nftAddress;

        if (params.domain_nft_address) {
          // Use provided address directly
          nftAddress = parseAddress(params.domain_nft_address, "domain_nft_address");
        } else {
          // Resolve domain name via TONAPI
          let name = params.domain_name.replace(/\.ton$/i, "");
          const url = `https://tonapi.io/v2/dns/${encodeURIComponent(name)}.ton`;
          const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
          if (!res.ok) {
            const text = await res.text().catch(() => "");
            return {
              success: false,
              error: `Could not resolve domain "${name}.ton" via TONAPI: ${res.status} ${text.slice(0, 200)}`,
            };
          }
          const data = await res.json();
          const rawAddr = data.address || data.raw_address;
          if (!rawAddr) {
            return { success: false, error: `Domain "${name}.ton" not found on TONAPI` };
          }
          nftAddress = Address.parse(rawAddr);
        }

        // Send bid = TON directly to the domain NFT address
        const value = toNano(String(params.bid_ton));
        const body = beginCell().endCell();
        const result = await sendTransaction(nftAddress, value, body);

        const domainLabel = params.domain_name
          ? params.domain_name.replace(/\.ton$/i, "") + ".ton"
          : nftAddress.toString();

        return {
          success: true,
          data: {
            ...result,
            domain: domainLabel,
            nft_address: nftAddress.toString(),
            bid_ton: params.bid_ton,
            message: `DNS auction bid of ${params.bid_ton} TON sent to ${domainLabel} (${nftAddress.toString()}). If outbid, your TON will be refunded automatically.`,
          },
        };
      } catch (err) {
        _log?.error("[webdom]", this?.name || "action", "failed:", err.message, err.stack);
        return { success: false, error: err.message };
      }
    },
  },
];  // end return
};  // end actionTools(sdk)
