import { createHash } from "node:crypto";
import { Address, beginCell, Dictionary } from "@ton/core";
import { MEME_CODE_HASHES, WRITABLE_MEME_VERSIONS } from "./constants.js";
import { formatUnits, percentageString } from "./amounts.js";
import { UranusError, exitError } from "./errors.js";
import { normalizeAddress } from "./abi.js";

function item(stack, index, type) {
  const value = stack[index];
  if (!value || (type && value.type !== type)) throw new UranusError("INVALID_RESPONSE", `Unexpected getter stack item ${index}`);
  return value;
}

function int(stack, index) {
  return item(stack, index, "int").value;
}

function bool(stack, index) {
  return int(stack, index) !== 0n;
}

function addressFromItem(stack, index) {
  const value = item(stack, index);
  if (!["cell", "slice"].includes(value.type)) throw new UranusError("INVALID_RESPONSE", `Expected address at stack item ${index}`);
  return value.cell.beginParse().loadAddress().toString();
}

function maybeAddressFromItem(stack, index) {
  const value = item(stack, index);
  if (!["cell", "slice"].includes(value.type)) throw new UranusError("INVALID_RESPONSE", `Expected address at stack item ${index}`);
  return value.cell.beginParse().loadMaybeAddress()?.toString() ?? null;
}

function cell(stack, index) {
  const value = item(stack, index);
  if (!["cell", "slice"].includes(value.type)) throw new UranusError("INVALID_RESPONSE", `Expected cell at stack item ${index}`);
  return value.cell;
}

function requireExit(result, method) {
  if (!result || !Array.isArray(result.stack)) throw new UranusError("INVALID_RESPONSE", `${method} returned no stack`);
  if (result.exitCode !== 0 && result.exitCode !== 1) throw exitError(result.exitCode);
  return result.stack;
}

async function optionalGetter(sdk, address, method, parser) {
  try {
    const result = await sdk.ton.runGetMethod(address, method);
    return parser(requireExit(result, method));
  } catch (error) {
    sdk.log?.debug?.(`uranus: optional ${method} unavailable: ${String(error?.message ?? error)}`);
    return null;
  }
}

function base64HashToHex(value) {
  if (!value) return null;
  if (/^[0-9a-f]{64}$/i.test(value)) return value.toLowerCase();
  try {
    const hex = Buffer.from(String(value), "base64").toString("hex");
    return hex.length === 64 ? hex : null;
  } catch {
    return null;
  }
}

function findAccount(payload, address) {
  const list = payload?.account_states ?? payload?.accounts ?? payload?.result ?? [];
  if (!Array.isArray(list)) return null;
  const normalized = Address.parse(address).toRawString();
  return list.find((entry) => {
    try {
      return Address.parse(entry.address ?? entry.account ?? "").toRawString() === normalized;
    } catch {
      return false;
    }
  }) ?? null;
}

function detectVersion(codeHash) {
  return Object.entries(MEME_CODE_HASHES).find(([, hash]) => hash === codeHash)?.[0] ?? null;
}

function parseMemeData(stack) {
  if (stack.length < 13) throw new UranusError("INVALID_RESPONSE", "get_meme_data returned an incomplete stack");
  return {
    initialized: bool(stack, 0),
    migrated: bool(stack, 1),
    controllerAddress: addressFromItem(stack, 2),
    creatorAddress: addressFromItem(stack, 3),
    creatorFee: int(stack, 4),
    seed: int(stack, 5),
    isGraduated: bool(stack, 6),
    alpha: int(stack, 7),
    beta: int(stack, 8),
    onSellSupply: int(stack, 9),
    tradeFeeBps: Number(int(stack, 10)),
    raisedFunds: int(stack, 11),
    currentSupply: int(stack, 12),
  };
}

function parseJettonData(stack) {
  if (stack.length < 5) throw new UranusError("INVALID_RESPONSE", "get_jetton_data returned an incomplete stack");
  return {
    totalSupply: int(stack, 0),
    mintable: bool(stack, 1),
    adminAddress: maybeAddressFromItem(stack, 2),
    metadataCell: cell(stack, 3),
    walletCode: cell(stack, 4),
  };
}

function parsePartnerData(stack) {
  if (stack.length < 4) throw new UranusError("INVALID_RESPONSE", "get_partner_data returned an incomplete stack");
  return {
    partnerFee: int(stack, 0),
    partnerFeeBps: Number(int(stack, 1)),
    partnerAddress: addressFromItem(stack, 2),
    poolPartnerFeeBps: Number(int(stack, 3)),
  };
}

function parseBondingCurveData(stack) {
  if (stack.length < 10) throw new UranusError("INVALID_RESPONSE", "get_bonding_curve_data returned an incomplete stack");
  return {
    isGraduated: bool(stack, 0),
    maxSupply: int(stack, 1),
    currentSupply: int(stack, 2),
    bondingCurveSupply: int(stack, 3),
    liquiditySupply: int(stack, 4),
    raisingFunds: int(stack, 5),
    migrationFee: int(stack, 6),
    raisedFunds: int(stack, 7),
    alpha: int(stack, 8),
    beta: int(stack, 9),
  };
}

function extractMetadataUri(account, jettonInfo) {
  const candidates = [
    account?.metadata?.token_info?.[0]?.extra?.uri,
    account?.metadata?.jetton?.content?.uri,
    jettonInfo?.uri,
  ];
  return candidates.find((value) => typeof value === "string" && value.length > 0) ?? null;
}

function metadataKey(name) {
  return BigInt(`0x${createHash("sha256").update(name).digest("hex")}`);
}

function snakeValue(value) {
  const slice = value.beginParse();
  try {
    if (slice.remainingBits >= 8) slice.skip(8);
    return slice.loadStringTail();
  } catch {
    return value.beginParse().loadStringTail();
  }
}

function parseContentCell(metadataCell) {
  if (!metadataCell) return {};
  try {
    const slice = metadataCell.beginParse();
    if (slice.remainingBits < 8) return {};
    const prefix = slice.loadUint(8);
    if (prefix === 1) return { uri: slice.loadStringTail() || null };
    if (prefix !== 0) return {};
    const dict = slice.loadDict(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell());
    const read = (name) => {
      const value = dict.get(metadataKey(name));
      if (!value) return null;
      try { return snakeValue(value); } catch { return null; }
    };
    return { name: read("name"), symbol: read("symbol"), description: read("description"), image: read("image"), decimals: read("decimals"), uri: read("uri") };
  } catch {
    return {};
  }
}

function curveTarget(meme) {
  if (!meme || meme.alpha <= 0n || meme.beta <= 0n || meme.onSellSupply < 0n || meme.onSellSupply >= meme.alpha) return null;
  return (meme.beta * meme.onSellSupply) / (meme.alpha - meme.onSellSupply);
}

function sanitizeMetadata(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const text = (key, max = 4096) => typeof value[key] === "string" ? value[key].slice(0, max) : null;
  return Object.fromEntries(Object.entries({ name: text("name", 256), symbol: text("symbol", 64), description: text("description"), image: text("image", 1024), decimals: text("decimals", 16) }).filter(([, value]) => value !== null));
}

export function createState(sdk, http) {
  async function inspectContract(memeAddress) {
    const address = normalizeAddress(memeAddress);
    const payload = await http.accountState(address);
    const account = findAccount(payload, address);
    const status = account?.status ?? account?.account_status ?? "unknown";
    const codeHash = base64HashToHex(account?.code_hash ?? account?.codeHash);
    const version = detectVersion(codeHash);
    return { address, account, payload, accountStatus: status, codeHash, version, verified: Boolean(version) && status === "active" };
  }

  async function memeInfo(memeAddress) {
    const identity = await inspectContract(memeAddress);
    // Keep RPC getters sequential. Public endpoints commonly rate-limit bursts of
    // parallel runMethod calls, while every getter is independently optional.
    const meme = await optionalGetter(sdk, identity.address, "get_meme_data", parseMemeData);
    const jetton = await optionalGetter(sdk, identity.address, "get_jetton_data", parseJettonData);
    const bonding = await optionalGetter(sdk, identity.address, "get_bonding_curve_data", parseBondingCurveData);
    const partner = await optionalGetter(sdk, identity.address, "get_partner_data", parsePartnerData);
    const jettonInfo = await sdk.ton.getJettonInfo(identity.address).catch(() => null);
    const raw = Address.parse(identity.address).toRawString();
    const indexedMetadata = identity.payload?.metadata?.[raw]
      ?? identity.payload?.metadata?.[raw.toUpperCase()]
      ?? identity.payload?.metadata?.[identity.account?.address];
    const contentMetadata = parseContentCell(jetton?.metadataCell);
    const onchainMetadata = sanitizeMetadata(contentMetadata);
    const uri = contentMetadata.uri ?? extractMetadataUri({ ...identity.account, metadata: indexedMetadata }, jettonInfo);
    let metadata = onchainMetadata;
    let metadataError = null;
    if (uri) {
      try {
        metadata = { ...sanitizeMetadata(await http.metadata(uri)), ...onchainMetadata };
      } catch (error) {
        metadataError = String(error?.message ?? error).slice(0, 500);
      }
    }
    const decimals = Number(metadata.decimals ?? jettonInfo?.decimals ?? 9);
    const safeDecimals = Number.isInteger(decimals) && decimals >= 0 && decimals <= 18 ? decimals : 9;
    const graduated = meme?.isGraduated ?? bonding?.isGraduated ?? false;
    const migrated = meme?.migrated ?? false;
    const lifecycle = migrated ? "migrated" : graduated ? "migration_pending" : meme?.initialized ? "on_curve" : meme?.initialized === false ? "uninitialized" : "unknown";
    const curveTargetFunds = curveTarget(meme);
    const fallbackMigrationFee = 50n * 1_000_000_000n;
    const targetFunds = bonding?.raisingFunds
      ?? (curveTargetFunds !== null && curveTargetFunds > fallbackMigrationFee ? curveTargetFunds - fallbackMigrationFee : null);
    const migrationFee = bonding?.migrationFee ?? fallbackMigrationFee;
    const raisedFunds = bonding?.raisedFunds ?? meme?.raisedFunds ?? null;
    return {
      address: identity.address,
      version: identity.version,
      code_hash: identity.codeHash,
      verified: identity.verified,
      account_status: identity.accountStatus,
      writable_curve: Boolean(identity.version && WRITABLE_MEME_VERSIONS.has(identity.version)),
      lifecycle,
      name: metadata.name ?? jettonInfo?.name ?? null,
      symbol: metadata.symbol ?? jettonInfo?.symbol ?? null,
      description: metadata.description ?? jettonInfo?.description ?? null,
      image: metadata.image ?? jettonInfo?.image ?? null,
      metadata_uri: uri,
      metadata_error: metadataError,
      decimals: safeDecimals,
      total_supply: jetton?.totalSupply?.toString() ?? jettonInfo?.totalSupply ?? null,
      max_supply: bonding?.maxSupply?.toString() ?? jetton?.totalSupply?.toString() ?? null,
      current_supply: bonding?.currentSupply?.toString() ?? meme?.currentSupply?.toString() ?? null,
      bonding_supply: bonding?.bondingCurveSupply?.toString() ?? meme?.onSellSupply?.toString() ?? null,
      liquidity_supply: bonding?.liquiditySupply?.toString() ?? (jetton && meme ? (jetton.totalSupply - meme.onSellSupply).toString() : null),
      controller_address: meme?.controllerAddress ?? null,
      creator_address: meme?.creatorAddress ?? null,
      initialized: meme?.initialized ?? null,
      graduated: meme?.isGraduated ?? bonding?.isGraduated ?? null,
      migrated: meme?.migrated ?? null,
      alpha: meme?.alpha?.toString() ?? bonding?.alpha?.toString() ?? null,
      beta: meme?.beta?.toString() ?? bonding?.beta?.toString() ?? null,
      raised_funds_nano: raisedFunds?.toString() ?? null,
      raised_funds_ton: raisedFunds !== null ? formatUnits(raisedFunds) : null,
      target_funds_nano: targetFunds?.toString() ?? null,
      target_funds_ton: targetFunds !== null ? formatUnits(targetFunds) : null,
      migration_fee_nano: migrationFee.toString(),
      migration_fee_ton: formatUnits(migrationFee),
      trade_fee_bps: meme?.tradeFeeBps ?? null,
      creator_fee_nano: meme?.creatorFee?.toString() ?? null,
      creator_fee_ton: meme ? formatUnits(meme.creatorFee) : null,
      partner_address: partner?.partnerAddress ?? null,
      partner_fee_nano: partner?.partnerFee?.toString() ?? null,
      partner_fee_ton: partner ? formatUnits(partner.partnerFee) : null,
      partner_fee_bps: partner?.partnerFeeBps ?? null,
      pool_partner_fee_bps: partner?.poolPartnerFeeBps ?? null,
      progress_percent: targetFunds !== null && raisedFunds !== null ? percentageString(raisedFunds, targetFunds) : null,
      bonding_curve_data: bonding ? Object.fromEntries(Object.entries(bonding).map(([key, value]) => [key, typeof value === "bigint" ? value.toString() : value])) : null,
      state_timestamp: new Date().toISOString(),
      _raw: { meme, jetton, partner },
    };
  }

  async function walletInfo(memeAddress, ownerAddress) {
    const meme = normalizeAddress(memeAddress);
    const owner = normalizeAddress(ownerAddress ?? sdk.ton.getAddress());
    const derived = await sdk.ton.getJettonWalletAddress(owner, meme);
    if (!derived) throw new UranusError("UPSTREAM_UNAVAILABLE", "Unable to derive the Uranus Meme Wallet address");
    const walletAddress = normalizeAddress(derived);
    let walletData = null;
    try {
      const result = await sdk.ton.runGetMethod(walletAddress, "get_wallet_data");
      const stack = requireExit(result, "get_wallet_data");
      walletData = {
        balance: int(stack, 0),
        owner: addressFromItem(stack, 1),
        master: addressFromItem(stack, 2),
      };
    } catch (error) {
      sdk.log?.debug?.(`uranus: wallet ${walletAddress} is not active: ${String(error?.message ?? error)}`);
    }
    const masterMatches = !walletData || normalizeAddress(walletData.master) === meme;
    const ownerMatches = !walletData || normalizeAddress(walletData.owner) === owner;
    return {
      wallet_address: walletAddress,
      owner_address: owner,
      master_address: meme,
      balance_raw: walletData?.balance?.toString() ?? "0",
      balance: formatUnits(walletData?.balance ?? 0n, 9),
      deployed: Boolean(walletData),
      verified: Boolean(walletData && masterMatches && ownerMatches),
      _rawBalance: walletData?.balance ?? 0n,
    };
  }

  async function portfolio({ include_zero = false, limit = 50 } = {}) {
    const balances = await sdk.ton.getJettonBalances();
    const output = [];
    for (const balance of balances.slice(0, Math.min(100, limit * 3))) {
      if (!include_zero && BigInt(balance.balance) === 0n) continue;
      try {
        const identity = await inspectContract(balance.jettonAddress);
        if (!identity.verified) continue;
        output.push({
          meme_address: identity.address,
          version: identity.version,
          wallet_address: balance.walletAddress,
          balance_raw: balance.balance,
          balance: balance.balanceFormatted,
          symbol: balance.symbol,
          name: balance.name,
          decimals: balance.decimals,
        });
        if (output.length >= limit) break;
      } catch (error) {
        sdk.log?.debug?.(`uranus: skipped portfolio candidate: ${String(error?.message ?? error)}`);
      }
    }
    return { owner_address: normalizeAddress(sdk.ton.getAddress()), holdings: output };
  }

  function walletAddressStack(ownerAddress) {
    return [{ type: "slice", cell: beginCell().storeAddress(Address.parse(ownerAddress)).endCell() }];
  }

  return { inspectContract, memeInfo, walletInfo, portfolio, walletAddressStack };
}
