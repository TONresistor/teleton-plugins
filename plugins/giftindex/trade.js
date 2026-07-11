/**
 * GiftIndex order book trading functions
 *
 * Builds and sends transactions for placing ask/bid orders and cancelling
 * orders on the GHOLD/USDT and FLOOR/USDT order book contracts.
 *
 * NOTE on op code naming: the on-chain contract uses inverted names --
 * what the contract calls "ask" is actually the buy-with-USDT flow, and
 * what it calls "bid" is the sell-index-tokens flow.  Our function names
 * are user-friendly: placeAskOrder = sell tokens, placeBidOrder = buy tokens.
 *
 * Price scaling: 10^4 (price=10000 means $1.0000 USDT).
 *
 * Dependency provided by teleton runtime: @ton/core
 */

import { realpathSync } from "fs";
import { createRequire } from "module";

// ---------------------------------------------------------------------------
// TON dependencies (CJS packages -- use createRequire for ESM compat)
// ---------------------------------------------------------------------------

const require = createRequire(realpathSync(process.argv[1]));
const { beginCell, Address } = require("@ton/core");

// ---------------------------------------------------------------------------
// SDK logger
// ---------------------------------------------------------------------------

let _log = { info() {}, warn() {}, error() {} };
let _ton = null;

/** Initialize trade module with SDK logger. */
export function initTrade(sdk) {
  _log = sdk.log;
  _ton = sdk.ton;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** GHOLD jetton master (Gift Holders Index) -- 9 decimals */
const GHOLD_MASTER = "0:c833790c1bee2d8021f3a71afb1c7a173b6f7ab9ce4add2022eaa7bf342209dc";

/** FLOOR jetton master (Gifts Floor Index) -- 9 decimals */
const FLOOR_MASTER = "0:e5180905b4cfd0848dc8dcec8c8801b8a71fb9854342b7c604c7a35c7edb6b97";

/** USDT jetton master -- 6 decimals */
const USDT_MASTER = "0:b113a994b5024a16719f69139328eb759596c38a25f59028b146fecdc3621dfe";

/** Resolve the index token master from order book name */
function getIndexMaster(orderBook) {
  if (orderBook.includes("EQCLF") || orderBook.toUpperCase().includes("FLOOR")) return FLOOR_MASTER;
  return GHOLD_MASTER;
}

/** Standard jetton transfer op */
const JETTON_TRANSFER_OP = 0x0f8a7ea5;

/**
 * Sell index tokens forward_payload op.
 * (Contract calls this "bid", but from user perspective this is an ask/sell.)
 */
const ASK_OP = 0x00bf4385;

/**
 * Buy index tokens with USDT forward_payload op.
 * (Contract calls this "ask", but from user perspective this is a bid/buy.)
 */
const BID_OP = 0x00845746;

/** Cancel order op */
const CANCEL_OP = 0x3567;

function requireTon() {
  if (!_ton) throw new Error("GiftIndex SDK is not initialized");
  return _ton;
}

// ---------------------------------------------------------------------------
// Pure cell builders
// ---------------------------------------------------------------------------

/**
 * Build the forward_payload cell for ask/bid orders.
 *
 * @param {number} op     Order op code (ASK_OP or BID_OP)
 * @param {number} price  Price scaled by 10^4 (e.g. 10000 = $1.0000)
 * @returns {Cell}
 */
export function buildForwardPayload(op, price) {
  return beginCell()
    .storeUint(op, 32)
    .storeUint(1, 16)
    .storeUint(price, 32)
    .endCell();
}

/**
 * Build a TEP-74 jetton_transfer message body.
 *
 * Uses addr_none for response_destination (matching the on-chain frontend
 * pattern -- excess TON is not returned to sender).
 *
 * @param {bigint} queryId         Query ID for the transfer
 * @param {bigint} amount          Jetton amount in base units
 * @param {Address} destination    Where the jettons go (order book address)
 * @param {Cell} forwardPayload    The forward_payload cell (ask/bid payload)
 * @returns {Cell}
 */
export function buildJettonTransferBody(queryId, amount, destination, forwardPayload) {
  return beginCell()
    .storeUint(JETTON_TRANSFER_OP, 32)
    .storeUint(queryId, 64)
    .storeCoins(amount)
    .storeAddress(destination)
    .storeUint(0, 2)                  // response_destination = addr_none
    .storeUint(0, 1)                  // no custom_payload
    .storeCoins(100000000n)           // forward_ton_amount
    .storeBit(true)                   // forward_payload present as ref
    .storeRef(forwardPayload)
    .endCell();
}

/**
 * Build the cancel order message body.
 *
 * Cancel ref cell format: uint16(priority) + uint4(orderType) + address
 *   orderType: 1 = cancel bid (sell orders), 2 = cancel ask (buy orders)
 *
 * @param {bigint} queryId        Query ID (timestamp-based)
 * @param {number} priority       Priority of the order to cancel (default 1)
 * @param {number} orderType      1 = cancel sell order, 2 = cancel buy order
 * @param {string} traderAddress  Trader's wallet address (raw or friendly)
 * @returns {Cell}
 */
export function buildCancelBody(queryId, priority, orderType, traderAddress) {
  const refCell = beginCell()
    .storeUint(priority, 16)
    .storeUint(orderType, 4)
    .storeAddress(Address.parse(traderAddress))
    .endCell();

  return beginCell()
    .storeUint(CANCEL_OP, 32)
    .storeUint(queryId, 64)
    .storeRef(refCell)
    .endCell();
}

// ---------------------------------------------------------------------------
// Transaction senders
// ---------------------------------------------------------------------------

/**
 * Place an ASK order -- sell index tokens (GHOLD or FLOOR) on the order book.
 *
 * Sends a jetton_transfer of index tokens to the order book contract with a
 * forward_payload encoding the ask price.  The on-chain contract confusingly
 * calls this a "bid" op (0x00BF4385).
 *
 * @param {string} orderBook       Order book contract address
 * @param {bigint|string} amount   Token amount in base units (9 decimals)
 * @param {number} price           Ask price scaled by 10^4
 * @returns {Promise<{seqno: number, walletAddress: string, jettonWalletAddress: string}>}
 */
export async function placeAskOrder(orderBook, amount, price) {
  const ton = requireTon();
  const ownerAddress = ton.getAddress();
  if (!ownerAddress) throw new Error("Agent wallet is not initialized");

  // Resolve the user's index token jetton wallet (GHOLD or FLOOR depending on OB)
  const indexMaster = getIndexMaster(orderBook);
  const jettonWallet = await ton.getJettonWalletAddress(ownerAddress, indexMaster);
  if (!jettonWallet) throw new Error("Could not resolve index token wallet");

  const forwardPayload = buildForwardPayload(ASK_OP, price);
  const body = buildJettonTransferBody(
    0n,
    BigInt(amount),
    Address.parse(orderBook),
    forwardPayload,
  );

  const sent = await ton.send(jettonWallet, 0.15, { body, bounce: true, sendMode: 3 });
  _log.info(`ASK order: seqno=${sent.seqno}, ob=${orderBook}, price=${price}`);

  return {
    seqno: sent.seqno,
    walletAddress: ownerAddress,
    jettonWalletAddress: jettonWallet,
  };
}

/**
 * Place a BID order -- buy index tokens by sending USDT to the order book.
 *
 * Sends a jetton_transfer of USDT to the order book contract with a
 * forward_payload encoding the bid price.  The on-chain contract confusingly
 * calls this an "ask" op (0x00845746).
 *
 * @param {string} orderBook       Order book contract address
 * @param {bigint|string} amount   USDT amount in base units (6 decimals)
 * @param {number} price           Bid price scaled by 10^4
 * @returns {Promise<{seqno: number, walletAddress: string, jettonWalletAddress: string}>}
 */
export async function placeBidOrder(orderBook, amount, price) {
  const ton = requireTon();
  const ownerAddress = ton.getAddress();
  if (!ownerAddress) throw new Error("Agent wallet is not initialized");

  // Resolve the user's USDT jetton wallet
  const usdtJettonWallet = await ton.getJettonWalletAddress(ownerAddress, USDT_MASTER);
  if (!usdtJettonWallet) throw new Error("Could not resolve USDT wallet");

  const forwardPayload = buildForwardPayload(BID_OP, price);
  const body = buildJettonTransferBody(
    0n,
    BigInt(amount),
    Address.parse(orderBook),
    forwardPayload,
  );

  const sent = await ton.send(usdtJettonWallet, 0.15, { body, bounce: true, sendMode: 3 });
  _log.info(`BID order: seqno=${sent.seqno}, ob=${orderBook}, price=${price}`);

  return {
    seqno: sent.seqno,
    walletAddress: ownerAddress,
    jettonWalletAddress: usdtJettonWallet,
  };
}

/**
 * Cancel an order on the order book.
 *
 * Sends a direct message to the order book contract with the cancel op,
 * query ID, and order details (priority, type, trader address) in a ref cell.
 *
 * @param {string} orderBook    Order book contract address
 * @param {bigint} queryId      Timestamp / query ID of the order to cancel
 * @param {number} priority     Priority of the order (uint16)
 * @param {number} orderType    1 = cancel bid (sell orders), 2 = cancel ask (buy orders)
 * @returns {Promise<{seqno: number, walletAddress: string}>}
 */
export async function cancelOrder(orderBook, queryId, priority, orderType) {
  const ton = requireTon();
  const ownerAddress = ton.getAddress();
  if (!ownerAddress) throw new Error("Agent wallet is not initialized");

  const body = buildCancelBody(BigInt(queryId), priority, orderType, ownerAddress);

  const sent = await ton.send(orderBook, 0.1, { body, bounce: true, sendMode: 3 });
  _log.info(`CANCEL order: seqno=${sent.seqno}, ob=${orderBook}, type=${orderType}`);

  return {
    seqno: sent.seqno,
    walletAddress: ownerAddress,
  };
}

// ---------------------------------------------------------------------------
// Post-trade verification
// ---------------------------------------------------------------------------

/**
 * Rule 7: Poll the wallet seqno until it advances past expectedSeqno,
 * confirming the transaction was accepted on-chain.
 *
 * @param {number} expectedSeqno - the seqno used when sending the tx
 * @param {number} [maxWaitMs=25000] - maximum wait time in milliseconds
 * @param {number} [intervalMs=3000] - polling interval
 * @returns {{ confirmed: boolean, newSeqno?: number, elapsed: number }}
 */
export async function verifySeqnoAdvanced(expectedSeqno, maxWaitMs = 25000, intervalMs = 3000) {
  const ton = requireTon();
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    await new Promise((r) => setTimeout(r, intervalMs));
    try {
      const current = await ton.getSeqno();
      if (current > expectedSeqno) {
        return { confirmed: true, newSeqno: current, elapsed: Date.now() - start };
      }
    } catch {
      // Network blip — keep polling
    }
  }

  return { confirmed: false, elapsed: Date.now() - start };
}

// ---------------------------------------------------------------------------
// Exported constants for use by index.js
// ---------------------------------------------------------------------------

export { GHOLD_MASTER, FLOOR_MASTER, USDT_MASTER, ASK_OP, BID_OP, CANCEL_OP };
