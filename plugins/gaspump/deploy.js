/**
 * GasPump v9 contract builder and deployer
 *
 * Builds state init, computes token address, and sends deploy transactions
 * using the agent's TON wallet at ~/.teleton/wallet.json.
 *
 * Dependencies (provided by teleton runtime):
 *   @ton/core, @ton/ton, @ton/crypto, @orbs-network/ton-access
 */

import { createHash } from "crypto";
import { readFileSync, realpathSync } from "fs";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { dirname, join } from "path";
import { homedir } from "os";

// ---------------------------------------------------------------------------
// TON dependencies (CJS packages — use createRequire for ESM compat)
// ---------------------------------------------------------------------------

// Resolve @ton/* packages from teleton's own node_modules.
const require = createRequire(realpathSync(process.argv[1]));

const { Cell, Address, beginCell, Dictionary, contractAddress, SendMode } = require("@ton/core");
const { WalletContractV5R1, TonClient, toNano, internal } = require("@ton/ton");
const { mnemonicToPrivateKey } = require("@ton/crypto");

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));

const CODE_V9 = Cell.fromBoc(
  Buffer.from(readFileSync(join(__dirname, "v9_code.boc.b64"), "utf-8").trim(), "base64"),
)[0];

const WALLET_CODE_V9 = Cell.fromBoc(
  Buffer.from(readFileSync(join(__dirname, "v9_wallet_code.boc.b64"), "utf-8").trim(), "base64"),
)[0];

const ADMIN = Address.parse("EQARmGWyt9u3zZPY8K4vUrqjNzEAHQGAZaI8XFibgUzYcy7B");
const BONDING_CURVE_BUY_OP = 0x6CD3E4B0;
const DESC_SUFFIX = " (launched on \u26FD\uFE0F GasPump)";
const WALLET_FILE = join(homedir(), ".teleton", "wallet.json");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sha256(str) {
  return createHash("sha256").update(str).digest();
}

/** Build a snake-format cell (chains refs for data > 127 bytes) */
function buildSnakeCell(data) {
  const MAX = 127;
  if (data.length <= MAX) {
    return beginCell().storeBuffer(data).endCell();
  }
  const chunks = [];
  for (let i = 0; i < data.length; i += MAX) {
    chunks.push(data.subarray(i, Math.min(i + MAX, data.length)));
  }
  let cell = beginCell().storeBuffer(chunks[chunks.length - 1]).endCell();
  for (let i = chunks.length - 2; i >= 0; i--) {
    cell = beginCell().storeBuffer(chunks[i]).storeRef(cell).endCell();
  }
  return cell;
}

/** Build TEP-64 onchain content cell (0x00 prefix + dict) */
function buildContentCell(name, symbol, imageUrl, description, dexType) {
  const dict = Dictionary.empty(Dictionary.Keys.Buffer(32), Dictionary.Values.Cell());
  const fields = { name, symbol, image: imageUrl, description, dexType };
  for (const [key, value] of Object.entries(fields)) {
    const buf = Buffer.concat([Buffer.from([0x00]), Buffer.from(value, "utf-8")]);
    dict.set(sha256(key), buildSnakeCell(buf));
  }
  return beginCell().storeUint(0, 8).storeDict(dict).endCell();
}

// ---------------------------------------------------------------------------
// Shared wallet + client setup
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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Read the agent's wallet address from ~/.teleton/wallet.json */
export function getAgentWalletAddress() {
  const data = JSON.parse(readFileSync(WALLET_FILE, "utf-8"));
  return data.address;
}

/**
 * Build GasPump v9 state init and compute the contract address.
 *
 * @param {string} ownerAddress  Deployer's TON wallet (friendly or raw)
 * @param {number} nonce         Salt for unique address (0, 1, 2, ...)
 * @param {string} name          Token name
 * @param {string} ticker        Token ticker (unwrapped symbol)
 * @param {string} imageUrl      Hosted image URL
 * @param {string} description   Raw description (suffix appended automatically)
 * @param {string} dexType       "dedust" or "stonfi"
 * @returns {{ stateInit: {code: Cell, data: Cell}, address: Address }}
 */
export function buildGaspumpStateInit(ownerAddress, nonce, name, ticker, imageUrl, description, dexType) {
  const owner = Address.parse(ownerAddress);
  const fullDesc = description + DESC_SUFFIX;

  const wrappedContent = buildContentCell(name, "gas" + ticker, imageUrl, fullDesc, dexType);
  const unwrappedContent = buildContentCell(name, ticker, imageUrl, fullDesc, dexType);

  const data = beginCell()
    .storeBit(false)
    .storeAddress(owner)
    .storeInt(nonce, 257)
    .storeAddress(ADMIN)
    .storeRef(WALLET_CODE_V9)
    .storeRef(wrappedContent)
    .storeRef(unwrappedContent)
    .endCell();

  const stateInit = { code: CODE_V9, data };
  const address = contractAddress(0, stateInit);
  return { stateInit, address };
}

/** Build the BondingCurveBuy deploy body (34 bits) */
export function buildDeployBody(doBuy = true) {
  return beginCell()
    .storeUint(BONDING_CURVE_BUY_OP, 32)
    .storeBit(doBuy)
    .storeBit(false) // hasLimit
    .endCell();
}

/**
 * Sign and send the deploy transaction from the agent's wallet.
 *
 * @param {Address} tokenAddress  Computed token contract address
 * @param {{code: Cell, data: Cell}} stateInit  State init cells
 * @param {Cell}   body           Deploy message body (BondingCurveBuy)
 * @param {string} buyTon         TON amount to send (e.g. "5")
 * @returns {Promise<{seqno: number, walletAddress: string}>}
 */
export async function sendDeploy(tokenAddress, stateInit, body, buyTon) {
  const { wallet, keyPair, contract } = await getWalletAndClient();
  const seqno = await contract.getSeqno();

  await contract.sendTransfer({
    seqno,
    secretKey: keyPair.secretKey,
    sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
    messages: [
      internal({
        to: tokenAddress,
        value: toNano(buyTon),
        init: stateInit,
        body,
        bounce: false,
      }),
    ],
  });

  return {
    seqno,
    walletAddress: wallet.address.toString(),
  };
}

/**
 * Buy tokens on a GasPump bonding curve.
 *
 * @param {string} tokenAddress  Token contract address (friendly or raw)
 * @param {string} buyTon        TON amount to spend (e.g. "2")
 * @returns {Promise<{seqno: number, walletAddress: string}>}
 */
export async function sendBuy(tokenAddress, buyTon) {
  const { wallet, keyPair, contract } = await getWalletAndClient();
  const seqno = await contract.getSeqno();

  const body = beginCell()
    .storeUint(BONDING_CURVE_BUY_OP, 32)
    .storeBit(true)
    .storeBit(false)
    .endCell();

  await contract.sendTransfer({
    seqno,
    secretKey: keyPair.secretKey,
    sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
    messages: [
      internal({
        to: Address.parse(tokenAddress),
        value: toNano(buyTon),
        body,
        bounce: true,
      }),
    ],
  });

  return {
    seqno,
    walletAddress: wallet.address.toString(),
  };
}

/**
 * Resolve the jetton wallet address for a given owner on a token master.
 *
 * @param {string} tokenMasterAddress  Jetton master contract address
 * @param {string} ownerAddress        Owner wallet address
 * @returns {Promise<Address>}
 */
export async function getJettonWalletAddress(tokenMasterAddress, ownerAddress) {
  const { client } = await getWalletAndClient();
  const result = await client.runMethod(
    Address.parse(tokenMasterAddress),
    "get_wallet_address",
    [{ type: "slice", cell: beginCell().storeAddress(Address.parse(ownerAddress)).endCell() }],
  );
  return result.stack.readAddress();
}

/**
 * Sell tokens back to the GasPump bonding curve via TEP-74 jetton transfer.
 *
 * @param {string} tokenAddress   Token master contract address
 * @param {bigint|string} jettonAmount  Amount of jettons to sell (in base units)
 * @returns {Promise<{seqno: number, walletAddress: string, jettonWalletAddress: string}>}
 */
export async function sendSell(tokenAddress, jettonAmount) {
  const { wallet, keyPair, contract } = await getWalletAndClient();
  const seqno = await contract.getSeqno();

  const jettonWallet = await getJettonWalletAddress(tokenAddress, wallet.address.toString());

  const body = beginCell()
    .storeUint(0x0f8a7ea5, 32)                   // transfer op
    .storeUint(0, 64)                              // query_id
    .storeCoins(jettonAmount)                      // amount to sell
    .storeAddress(Address.parse(tokenAddress))     // destination = bonding curve
    .storeAddress(wallet.address)                  // response_destination = agent wallet
    .storeBit(false)                               // no custom_payload
    .storeCoins(toNano("0.1"))                     // forward_ton_amount
    .storeBit(false)                               // no forward_payload
    .endCell();

  await contract.sendTransfer({
    seqno,
    secretKey: keyPair.secretKey,
    sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
    messages: [
      internal({
        to: jettonWallet,
        value: toNano("0.3"),
        body,
        bounce: true,
      }),
    ],
  });

  return {
    seqno,
    walletAddress: wallet.address.toString(),
    jettonWalletAddress: jettonWallet.toString(),
  };
}
