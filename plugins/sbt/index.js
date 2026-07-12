/**
 * TON SBT plugin — deploy and mint Soulbound Tokens (TEP-85)
 *
 * Uses @ton/core for cell building and Teleton's SDK transaction broker.
 *
 * Dependency provided by teleton runtime: @ton/core
 */

import { createHash } from "crypto";
import { readFileSync, realpathSync } from "fs";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { dirname, join } from "path";

// ---------------------------------------------------------------------------
// TON dependencies (CJS packages — use createRequire for ESM compat)
// ---------------------------------------------------------------------------

const require = createRequire(realpathSync(process.argv[1]));
const { Cell, Address, beginCell, Dictionary, contractAddress, TupleReader } = require("@ton/core");

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));

const SBT_ITEM_CODE = Cell.fromBoc(
  Buffer.from(readFileSync(join(__dirname, "sbt_item_code.boc.b64"), "utf-8").trim(), "base64"),
)[0];

const COLLECTION_CODE = Cell.fromBoc(
  Buffer.from(readFileSync(join(__dirname, "nft_collection_code.boc.b64"), "utf-8").trim(), "base64"),
)[0];

// ---------------------------------------------------------------------------
// On-chain content helpers (TEP-64)
// ---------------------------------------------------------------------------

function sha256(str) {
  return createHash("sha256").update(str).digest();
}

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

function buildContentDict(fields) {
  const dict = Dictionary.empty(Dictionary.Keys.Buffer(32), Dictionary.Values.Cell());
  for (const [key, value] of Object.entries(fields)) {
    if (value == null) continue;
    const buf = Buffer.concat([Buffer.from([0x00]), Buffer.from(String(value), "utf-8")]);
    dict.set(sha256(key), buildSnakeCell(buf));
  }
  return beginCell().storeUint(0, 8).storeDict(dict).endCell();
}

function readSnakeCell(cell) {
  let result = Buffer.alloc(0);
  let cs = cell.beginParse();
  while (true) {
    const bits = cs.remainingBits;
    if (bits > 0) result = Buffer.concat([result, cs.loadBuffer(bits / 8)]);
    if (cs.remainingRefs > 0) cs = cs.loadRef().beginParse();
    else break;
  }
  return result;
}

function extractCollectionImage(metaCell) {
  try {
    const cs = metaCell.beginParse();
    if (cs.loadUint(8) !== 0) return null;
    const dict = cs.loadDict(Dictionary.Keys.Buffer(32), Dictionary.Values.Cell());
    const imageCell = dict.get(sha256("image"));
    if (!imageCell) return null;
    return readSnakeCell(imageCell).subarray(1).toString("utf-8");
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TOOLS
// ═══════════════════════════════════════════════════════════════════════════

// ── Export -- SDK wrapper ────────────────────────────────────────────────

export const manifest = {
  name: "sbt",
  version: "2.0.0",
  sdkVersion: "^2.0.0",
  description: "Deploy and mint Soulbound Tokens (TEP-85) on TON — non-transferable NFTs permanently bound to their owners.",
};

export const tools = (sdk) => {

// ── 1. sbt_deploy_collection ─────────────────────────────────────────────

const sbtDeployCollection = {
  name: "sbt_deploy_collection",
  description:
    "Deploy a new SBT (Soulbound Token) collection on TON. Creates the collection contract from the agent's wallet. Returns the collection address for minting items. Cost: ~0.05 TON.",
  category: "action",
  scope: "admin-only",
  parameters: {
    type: "object",
    required: ["name", "description", "image"],
    properties: {
      name: { type: "string", description: "Collection name" },
      description: { type: "string", description: "Collection description" },
      image: { type: "string", description: "URL to collection image" },
    },
  },
  execute: async (params) => {
    try {
      const walletAddress = sdk.ton.getAddress();
      if (!walletAddress) throw new Error("Agent wallet is not initialized");
      const wallet = Address.parse(walletAddress);

      const collectionMetaCell = buildContentDict({
        name: params.name,
        description: params.description,
        image: params.image,
      });

      const contentCell = beginCell()
        .storeRef(collectionMetaCell)
        .storeRef(beginCell().endCell())
        .endCell();

      const royaltyCell = beginCell()
        .storeUint(0, 16)
        .storeUint(1000, 16)
        .storeAddress(wallet)
        .endCell();

      const data = beginCell()
        .storeAddress(wallet)
        .storeUint(0, 64)
        .storeRef(contentCell)
        .storeRef(SBT_ITEM_CODE)
        .storeRef(royaltyCell)
        .endCell();

      const stateInit = { code: COLLECTION_CODE, data };
      const address = contractAddress(0, stateInit);

      sdk.log.info("sbt_deploy_collection: deploying collection", params.name, "from wallet", walletAddress);

      const sent = await sdk.ton.send(address.toString(), 0.05, {
        stateInit,
        bounce: false,
        sendMode: 3,
      });

      sdk.log.info("sbt_deploy_collection: deployed at", address.toString());

      return {
        success: true,
        data: {
          collection_address: address.toString(),
          seqno: sent.seqno,
          hash: sent.hash,
          wallet_address: walletAddress,
          explorer: "https://tonviewer.com/" + address.toString(),
        },
      };
    } catch (err) {
      sdk.log.error("sbt_deploy_collection:", err.message);
      return { success: false, error: String(err.message || err).slice(0, 500) };
    }
  },
};

// ── 2. sbt_mint ──────────────────────────────────────────────────────────

const sbtMint = {
  name: "sbt_mint",
  description:
    "Mint a new SBT (Soulbound Token) item in an existing collection. The SBT is non-transferable and permanently bound to the owner. Optionally set an authority address that can revoke it. Cost: ~0.1 TON.",
  category: "action",
  scope: "admin-only",
  parameters: {
    type: "object",
    required: ["collection_address", "owner_address", "name"],
    properties: {
      collection_address: { type: "string", description: "Address of SBT collection to mint from" },
      owner_address: { type: "string", description: "Who receives the SBT (permanent owner)" },
      name: { type: "string", description: "SBT item name" },
      description: { type: "string", description: "SBT item description" },
      image: { type: "string", description: "URL to SBT item image (defaults to collection image)" },
      authority_address: { type: "string", description: "Who can revoke the SBT (defaults to agent wallet)" },
    },
  },
  execute: async (params) => {
    try {
      const walletAddress = sdk.ton.getAddress();
      if (!walletAddress) throw new Error("Agent wallet is not initialized");
      const wallet = Address.parse(walletAddress);

      const collectionAddr = Address.parse(params.collection_address);
      const result = await sdk.ton.runGetMethod(collectionAddr.toString(), "get_collection_data");
      const stack = new TupleReader(result.stack);
      const nextItemIndex = stack.readBigNumber();
      const collectionContent = stack.readCell();

      let image = params.image;
      if (!image) {
        image = extractCollectionImage(collectionContent);
      }

      const individualContentCell = buildContentDict({
        name: params.name,
        description: params.description,
        image,
      });

      const authority = params.authority_address
        ? Address.parse(params.authority_address)
        : wallet;

      const itemPayloadCell = beginCell()
        .storeAddress(Address.parse(params.owner_address))
        .storeRef(individualContentCell)
        .storeAddress(authority)
        .endCell();

      sdk.log.info("sbt_mint: minting item #" + nextItemIndex.toString(), "to", params.owner_address, "in collection", params.collection_address);

      const mintBody = beginCell()
        .storeUint(1, 32)
        .storeUint(0, 64)
        .storeUint(nextItemIndex, 64)
        .storeCoins(50000000n)
        .storeRef(itemPayloadCell)
        .endCell();

      const sent = await sdk.ton.send(collectionAddr.toString(), 0.1, {
        body: mintBody,
        bounce: true,
        sendMode: 3,
      });

      sdk.log.info("sbt_mint: minted item #" + nextItemIndex.toString(), "seqno", sent.seqno);

      return {
        success: true,
        data: {
          item_index: nextItemIndex.toString(),
          collection_address: params.collection_address,
          owner: params.owner_address,
          authority: authority.toString(),
          image: image || null,
          seqno: sent.seqno,
          hash: sent.hash,
          wallet_address: walletAddress,
        },
      };
    } catch (err) {
      sdk.log.error("sbt_mint:", err.message);
      return { success: false, error: String(err.message || err).slice(0, 500) };
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// Return tools array
// ═══════════════════════════════════════════════════════════════════════════

return [sbtDeployCollection, sbtMint];

}; // end tools(sdk)
