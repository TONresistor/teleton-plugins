import { Address, Cell } from "@ton/core";
import { FACTORIES, OPCODES } from "./constants.js";
import { decodeDeployCustomizedMeme, decodeDeployMeme, decodeInitMeme, decodeTradeEvent, normalizeAddress } from "./abi.js";
import { formatUnits } from "./amounts.js";

function transactions(payload) {
  return Array.isArray(payload?.transactions) ? payload.transactions : [];
}

function bodyCell(message) {
  const body = message?.message_content?.body ?? message?.body;
  if (typeof body !== "string" || !body) return null;
  try {
    return Cell.fromBase64(body);
  } catch {
    return null;
  }
}

function opcode(message) {
  const value = message?.opcode;
  if (typeof value === "number") return value >>> 0;
  if (typeof value === "string" && /^0x[0-9a-f]+$/i.test(value)) return Number.parseInt(value.slice(2), 16) >>> 0;
  const body = bodyCell(message);
  if (!body || body.bits.length < 32) return null;
  return body.beginParse().preloadUint(32) >>> 0;
}

function txHashHex(value) {
  if (!value) return null;
  if (/^[0-9a-f]{64}$/i.test(value)) return value.toLowerCase();
  try {
    const hex = Buffer.from(value, "base64").toString("hex");
    return hex.length === 64 ? hex : value;
  } catch {
    return value;
  }
}

function msgAddress(value) {
  if (!value) return null;
  try {
    return Address.parse(value).toString();
  } catch {
    return null;
  }
}

function decodeDeploy(message) {
  const body = bodyCell(message);
  if (!body) return null;
  if (opcode(message) === OPCODES.DEPLOY_MEME) return decodeDeployMeme(body);
  if (opcode(message) === OPCODES.DEPLOY_CUSTOMIZED_MEME) return decodeDeployCustomizedMeme(body);
  return null;
}

export function createHistory(sdk, http) {
  async function recentLaunches({ limit = 10, factory_version = "v3.1" } = {}) {
    const versions = factory_version === "all" ? ["v3.1", "v3.0", "v2"] : [factory_version];
    const launches = [];
    const seen = new Set();
    for (const version of versions) {
      const factory = FACTORIES[version];
      if (!factory) continue;
      const payload = await http.transactions(factory, Math.min(100, limit * 4));
      for (const tx of transactions(payload)) {
        try {
          const deploy = decodeDeploy(tx.in_msg);
          if (!deploy) continue;
          const initMessage = (tx.out_msgs ?? []).find((message) => opcode(message) === OPCODES.INIT_MEME);
          const initBody = bodyCell(initMessage);
          if (!initMessage?.destination || !initBody) continue;
          const init = decodeInitMeme(initBody);
          if (init.queryId !== deploy.queryId) continue;
          const memeAddress = normalizeAddress(initMessage.destination);
          const raw = Address.parse(memeAddress).toRawString();
          if (seen.has(raw)) continue;
          seen.add(raw);
          const hash = txHashHex(tx.hash);
          launches.push({
            meme_address: memeAddress,
            factory_version: version,
            factory_address: normalizeAddress(factory),
            kind: deploy.kind,
            query_id: deploy.queryId.toString(),
            creator_address: msgAddress(tx.in_msg?.source),
            initial_buy_nano: deploy.initialBuy.toString(),
            initial_buy_ton: formatUnits(deploy.initialBuy),
            metadata_uri: deploy.metadataUri,
            preset_id: deploy.presetId ?? null,
            transaction_hash: hash,
            explorer: hash ? `https://tonviewer.com/transaction/${hash}` : null,
            timestamp: Number(tx.now ?? tx.in_msg?.created_at ?? 0),
          });
        } catch (error) {
          sdk.log?.debug?.(`uranus: skipped malformed factory transaction: ${String(error?.message ?? error)}`);
        }
      }
    }
    launches.sort((a, b) => b.timestamp - a.timestamp);
    return launches.slice(0, limit);
  }

  async function recentTrades({ meme_address, limit = 10 }) {
    const meme = normalizeAddress(meme_address);
    const payload = await http.transactions(meme, Math.min(100, limit * 4));
    const records = [];
    for (const tx of transactions(payload)) {
      for (const message of tx.out_msgs ?? []) {
        try {
          const body = bodyCell(message);
          if (!body) continue;
          const event = decodeTradeEvent(body);
          if (!event) continue;
          const hash = txHashHex(tx.hash);
          records.push({
            kind: event.kind,
            trader_address: event.traderAddress.toString(),
            amount_in_raw: event.amountIn.toString(),
            amount_in: formatUnits(event.amountIn),
            amount_out_raw: event.amountOut.toString(),
            amount_out: formatUnits(event.amountOut),
            fees: Object.fromEntries(Object.entries(event.fees).map(([key, value]) => [key, { raw: value.toString(), ton: formatUnits(value) }])),
            current_supply_raw: event.currentSupply.toString(),
            raised_funds_nano: event.raisedFunds.toString(),
            graduated: event.isGraduated ?? null,
            transaction_hash: hash,
            explorer: hash ? `https://tonviewer.com/transaction/${hash}` : null,
            timestamp: Number(tx.now ?? message.created_at ?? 0),
          });
        } catch (error) {
          sdk.log?.debug?.(`uranus: skipped malformed trade event: ${String(error?.message ?? error)}`);
        }
      }
    }
    records.sort((a, b) => a.timestamp - b.timestamp);
    return records.slice(-limit);
  }

  return { recentLaunches, recentTrades };
}

export const historyInternals = { bodyCell, opcode, txHashHex };
