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
const MARKETPLACE = Address.parse(WEBDOM_MARKETPLACE);

const GAS_PURCHASE = toNano("0.07");
const GAS_BID      = toNano("0.07");
const GAS_CANCEL   = toNano("0.05");
const FORWARD_NFT  = toNano("0.3");
const DEPLOY_OFFER = toNano("0.05");

const OP_MASK = 0x0fffffff;

// NFT transfer op (TEP-62)
const NFT_TRANSFER_OP = 0x5fcc3d14;

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

  const client = new TonClient({ endpoint: "https://toncenter.com/api/v2/jsonRPC" });
  const contract = client.open(wallet);

  return { wallet, keyPair, client, contract };
}

async function sendTransaction(to, value, body) {
  const { wallet, keyPair, contract } = await getWalletAndClient();
  const seqno = await contract.getSeqno();

  await contract.sendTransfer({
    seqno,
    secretKey: keyPair.secretKey,
    sendMode: SendMode.PAY_GAS_SEPARATELY | SendMode.IGNORE_ERRORS,
    messages: [
      internal({ to, value, body, bounce: true }),
    ],
  });

  return {
    tx_seqno: seqno,
    wallet_address: wallet.address.toString({ bounceable: true }),
  };
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

export const actionTools = [

  // ── 1. webdom_buy_domain ────────────────────────────────────────────────
  {
    name: "webdom_buy_domain",
    description:
      "Purchase a .ton domain or .t.me username listed at a fixed price on webdom. " +
      "Requires the sale contract address (from domain listing) and the price in TON. " +
      "The transaction sends price + 0.07 TON gas to the sale contract.",
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
        if (params.price_ton <= 0) {
          return { success: false, error: "price_ton must be positive" };
        }

        const value = toNano(String(params.price_ton)) + GAS_PURCHASE;
        const result = await sendTransaction(saleAddr, value, null);

        return {
          success: true,
          data: {
            ...result,
            message: `Purchase transaction sent for ${params.price_ton} TON + 0.07 TON gas to sale contract ${params.sale_address}. Check wallet for confirmation.`,
          },
        };
      } catch (err) {
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
        if (params.price_ton <= 0) {
          return { success: false, error: "price_ton must be positive" };
        }

        const durationDays = params.duration_days || 30;
        const validUntil = Math.floor(Date.now() / 1000) + durationDays * 86400;

        // Build deploy payload for TonSimpleSale
        const deployPayload = beginCell()
          .storeUint(OP.TON_SIMPLE_SALE & OP_MASK, 28)
          .storeCoins(toNano(String(params.price_ton)))
          .storeUint(validUntil, 32)
          .endCell();

        // Get wallet for signing and response address
        const { wallet, keyPair, contract } = await getWalletAndClient();
        const senderAddr = wallet.address;

        // Build NFT transfer body
        const body = buildNftTransferBody(MARKETPLACE, senderAddr, FORWARD_NFT, deployPayload);

        const seqno = await contract.getSeqno();
        await contract.sendTransfer({
          seqno,
          secretKey: keyPair.secretKey,
          sendMode: SendMode.PAY_GAS_SEPARATELY | SendMode.IGNORE_ERRORS,
          messages: [
            internal({
              to: domainAddr,
              value: FORWARD_NFT + toNano("0.05"), // forward amount + gas
              body,
              bounce: true,
            }),
          ],
        });

        return {
          success: true,
          data: {
            tx_seqno: seqno,
            wallet_address: senderAddr.toString({ bounceable: true }),
            message: `Domain ${params.domain_address} listed for sale at ${params.price_ton} TON for ${durationDays} days. Marketplace will deploy a sale contract.`,
          },
        };
      } catch (err) {
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
        if (params.min_bid_ton <= 0) {
          return { success: false, error: "min_bid_ton must be positive" };
        }

        const durationHours = params.duration_hours || 24;
        const durationSeconds = durationHours * 3600;

        // Build deploy payload for TonSimpleAuction
        const deployPayload = beginCell()
          .storeUint(OP.TON_SIMPLE_AUCTION & OP_MASK, 28)
          .storeCoins(toNano(String(params.min_bid_ton)))
          .storeUint(durationSeconds, 32)
          .endCell();

        const { wallet, keyPair, contract } = await getWalletAndClient();
        const senderAddr = wallet.address;

        const body = buildNftTransferBody(MARKETPLACE, senderAddr, FORWARD_NFT, deployPayload);

        const seqno = await contract.getSeqno();
        await contract.sendTransfer({
          seqno,
          secretKey: keyPair.secretKey,
          sendMode: SendMode.PAY_GAS_SEPARATELY | SendMode.IGNORE_ERRORS,
          messages: [
            internal({
              to: domainAddr,
              value: FORWARD_NFT + toNano("0.05"),
              body,
              bounce: true,
            }),
          ],
        });

        return {
          success: true,
          data: {
            tx_seqno: seqno,
            wallet_address: senderAddr.toString({ bounceable: true }),
            message: `Auction created for ${params.domain_address} with minimum bid ${params.min_bid_ton} TON, duration ${durationHours} hours.`,
          },
        };
      } catch (err) {
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
        if (params.bid_ton <= 0) {
          return { success: false, error: "bid_ton must be positive" };
        }

        const value = toNano(String(params.bid_ton)) + GAS_BID;
        const result = await sendTransaction(auctionAddr, value, null);

        return {
          success: true,
          data: {
            ...result,
            message: `Bid of ${params.bid_ton} TON placed on auction ${params.auction_address}. Previous highest bidder will be refunded automatically.`,
          },
        };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
  },

  // ── 5. webdom_make_offer ────────────────────────────────────────────────
  {
    name: "webdom_make_offer",
    description:
      "Make a purchase offer on a .ton domain or .t.me username on webdom. " +
      "Sends TON to the marketplace which deploys an offer contract with locked funds. " +
      "The domain owner can accept or the offer expires after the valid period.",
    category: "action",
    scope: "dm-only",
    parameters: {
      type: "object",
      properties: {
        domain_address: {
          type: "string",
          description: "The domain NFT contract address to make an offer on.",
        },
        offer_ton: {
          type: "number",
          description: "Offer amount in TON (e.g. 5.0). This amount will be locked in the offer contract.",
        },
        valid_days: {
          type: "integer",
          description: "How many days the offer remains valid (default 7).",
        },
      },
      required: ["domain_address", "offer_ton"],
      additionalProperties: false,
    },
    execute: async (params) => {
      try {
        const domainAddr = parseAddress(params.domain_address, "domain_address");
        if (params.offer_ton <= 0) {
          return { success: false, error: "offer_ton must be positive" };
        }

        const validDays = params.valid_days || 7;
        const validUntil = Math.floor(Date.now() / 1000) + validDays * 86400;

        // Build offer deploy payload
        const body = beginCell()
          .storeUint(OP.TON_SIMPLE_OFFER & OP_MASK, 28)
          .storeAddress(domainAddr)
          .storeCoins(toNano(String(params.offer_ton)))
          .storeUint(validUntil, 32)
          .endCell();

        // Total value = offer + deploy fee + gas
        const value = toNano(String(params.offer_ton)) + DEPLOY_OFFER + GAS_PURCHASE;
        const result = await sendTransaction(MARKETPLACE, value, body);

        return {
          success: true,
          data: {
            ...result,
            message: `Offer of ${params.offer_ton} TON submitted for domain ${params.domain_address}, valid for ${validDays} days. Funds locked in offer contract.`,
          },
        };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
  },

  // ── 6. webdom_cancel_deal ───────────────────────────────────────────────
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

        // Cancel body: simple text comment "cancel"
        const body = beginCell()
          .storeUint(0, 32)
          .storeStringTail("cancel")
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
        if (params.bid_ton <= 0) {
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
        const result = await sendTransaction(nftAddress, value, null);

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
        return { success: false, error: err.message };
      }
    },
  },
];
