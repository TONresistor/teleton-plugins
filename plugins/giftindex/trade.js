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
 * Dependencies (provided by teleton runtime):
 *   @ton/core, @ton/ton, @ton/crypto, @orbs-network/ton-access
 */

import { readFileSync, realpathSync } from "fs";
import { createRequire } from "module";
import { homedir } from "os";
import { join } from "path";

// ---------------------------------------------------------------------------
// TON dependencies (CJS packages -- use createRequire for ESM compat)
// ---------------------------------------------------------------------------

const require = createRequire(realpathSync(process.argv[1]));

const { beginCell, Address, SendMode } = require("@ton/core");
const { WalletContractV5R1, TonClient, toNano, internal } = require("@ton/ton");
const { mnemonicToPrivateKey } = require("@ton/crypto");

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

const WALLET_FILE = join(homedir(), ".teleton", "wallet.json");

// ---------------------------------------------------------------------------
// Wallet + client setup (same pattern as gaspump/deploy.js)
// ---------------------------------------------------------------------------

async function getWalletAndClient() {
  let walletData;
  try {
    walletData = JSON.parse(readFileSync(WALLET_FILE, "utf-8"));
  } catch {
    throw new Error("Agent wallet not found at " + WALLET_FILE);
  }
  if (!walletData.mnemonic || !Array.isArray(walletData.mnemonic)) {
    throw new Error("Invalid wallet file: missing mnemonic");
  }

  const keyPair = await mnemonicToPrivateKey(walletData.mnemonic);
  const wallet = WalletContractV5R1.create({
    workchain: 0,
    publicKey: keyPair.publicKey,
  });

  let endpoint;
  try {
    const { getHttpEndpoint } = require("@orbs-network/ton-access");
    endpoint = await getHttpEndpoint({ network: "mainnet" });
  } catch {
    endpoint = "https://toncenter.com/api/v2/jsonRPC";
  }

  const client = new TonClient({ endpoint });
  const contract = client.open(wallet);

  return { wallet, keyPair, client, contract };
}

/**
 * Resolve the jetton wallet address for a given owner on a jetton master.
 *
 * @param {object} client   TonClient instance
 * @param {string} jettonMaster  Jetton master contract address (raw or friendly)
 * @param {string} ownerAddress  Owner wallet address
 * @returns {Promise<Address>}
 */
async function resolveJettonWallet(client, jettonMaster, ownerAddress) {
  const result = await client.runMethod(
    Address.parse(jettonMaster),
    "get_wallet_address",
    [{ type: "slice", cell: beginCell().storeAddress(Address.parse(ownerAddress)).endCell() }],
  );
  return result.stack.readAddress();
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
    .storeCoins(toNano("0.1"))        // forward_ton_amount
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
 * @param {object} bridge          Teleton bridge (context.bridge)
 * @param {string} orderBook       Order book contract address
 * @param {bigint|string} amount   Token amount in base units (9 decimals)
 * @param {number} price           Ask price scaled by 10^4
 * @returns {Promise<{seqno: number, walletAddress: string, jettonWalletAddress: string}>}
 */
export async function placeAskOrder(bridge, orderBook, amount, price) {
  const { wallet, keyPair, client, contract } = await getWalletAndClient();
  const ownerAddress = wallet.address.toString();

  // Resolve the user's index token jetton wallet (GHOLD or FLOOR depending on OB)
  const indexMaster = getIndexMaster(orderBook);
  const jettonWallet = await resolveJettonWallet(client, indexMaster, ownerAddress);

  const forwardPayload = buildForwardPayload(ASK_OP, price);
  const body = buildJettonTransferBody(
    0n,
    BigInt(amount),
    Address.parse(orderBook),
    forwardPayload,
  );

  const seqno = await contract.getSeqno();
  await contract.sendTransfer({
    seqno,
    secretKey: keyPair.secretKey,
    sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
    messages: [
      internal({
        to: jettonWallet,
        value: toNano("0.15"),
        body,
        bounce: true,
      }),
    ],
  });

  return {
    seqno,
    walletAddress: ownerAddress,
    jettonWalletAddress: jettonWallet.toString(),
  };
}

/**
 * Place a BID order -- buy index tokens by sending USDT to the order book.
 *
 * Sends a jetton_transfer of USDT to the order book contract with a
 * forward_payload encoding the bid price.  The on-chain contract confusingly
 * calls this an "ask" op (0x00845746).
 *
 * @param {object} bridge          Teleton bridge (context.bridge)
 * @param {string} orderBook       Order book contract address
 * @param {bigint|string} amount   USDT amount in base units (6 decimals)
 * @param {number} price           Bid price scaled by 10^4
 * @returns {Promise<{seqno: number, walletAddress: string, jettonWalletAddress: string}>}
 */
export async function placeBidOrder(bridge, orderBook, amount, price) {
  const { wallet, keyPair, client, contract } = await getWalletAndClient();
  const ownerAddress = wallet.address.toString();

  // Resolve the user's USDT jetton wallet
  const usdtJettonWallet = await resolveJettonWallet(client, USDT_MASTER, ownerAddress);

  const forwardPayload = buildForwardPayload(BID_OP, price);
  const body = buildJettonTransferBody(
    0n,
    BigInt(amount),
    Address.parse(orderBook),
    forwardPayload,
  );

  const seqno = await contract.getSeqno();
  await contract.sendTransfer({
    seqno,
    secretKey: keyPair.secretKey,
    sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
    messages: [
      internal({
        to: usdtJettonWallet,
        value: toNano("0.15"),
        body,
        bounce: true,
      }),
    ],
  });

  return {
    seqno,
    walletAddress: ownerAddress,
    jettonWalletAddress: usdtJettonWallet.toString(),
  };
}

/**
 * Cancel an order on the order book.
 *
 * Sends a direct message to the order book contract with the cancel op,
 * query ID, and order details (priority, type, trader address) in a ref cell.
 *
 * @param {object} bridge       Teleton bridge (context.bridge)
 * @param {string} orderBook    Order book contract address
 * @param {bigint} queryId      Timestamp / query ID of the order to cancel
 * @param {number} priority     Priority of the order (uint16)
 * @param {number} orderType    1 = cancel bid (sell orders), 2 = cancel ask (buy orders)
 * @returns {Promise<{seqno: number, walletAddress: string}>}
 */
export async function cancelOrder(bridge, orderBook, queryId, priority, orderType) {
  const { wallet, keyPair, contract } = await getWalletAndClient();
  const ownerAddress = wallet.address.toString();

  const body = buildCancelBody(BigInt(queryId), priority, orderType, ownerAddress);

  const seqno = await contract.getSeqno();
  await contract.sendTransfer({
    seqno,
    secretKey: keyPair.secretKey,
    sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
    messages: [
      internal({
        to: Address.parse(orderBook),
        value: toNano("0.1"),
        body,
        bounce: true,
      }),
    ],
  });

  return {
    seqno,
    walletAddress: ownerAddress,
  };
}

// ---------------------------------------------------------------------------
// Exported constants for use by index.js
// ---------------------------------------------------------------------------

export { GHOLD_MASTER, FLOOR_MASTER, USDT_MASTER, ASK_OP, BID_OP, CANCEL_OP };
