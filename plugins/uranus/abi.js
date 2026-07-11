import { Address, beginCell } from "@ton/core";
import { OPCODES } from "./constants.js";
import { UranusError } from "./errors.js";
import { parseUint } from "./amounts.js";

function address(value, field = "address") {
  try {
    return value instanceof Address ? value : Address.parse(String(value));
  } catch {
    throw new UranusError("INVALID_ADDRESS", `${field} is not a valid TON address`);
  }
}

function storeInlineAffiliate(builder, config, kind) {
  if (!config) return builder.storeBit(false);
  const idField = kind === "partner" ? "partnerId" : "referrerId";
  const feeField = kind === "partner" ? "partnerFeeBps" : "referrerFeeBps";
  builder.storeBit(true).storeUint(parseUint(config[idField], 256, idField), 256).storeUint(parseUint(config[feeField], 16, feeField), 16);
  return builder;
}

function affiliateCell(config, kind) {
  if (!config) return null;
  const idField = kind === "partner" ? "partnerId" : "referrerId";
  const feeField = kind === "partner" ? "partnerFeeBps" : "referrerFeeBps";
  return beginCell()
    .storeUint(parseUint(config[idField], 256, idField), 256)
    .storeUint(parseUint(config[feeField], 16, feeField), 16)
    .endCell();
}

export function buildDeployMeme(args) {
  const builder = beginCell()
    .storeUint(OPCODES.DEPLOY_MEME, 32)
    .storeUint(parseUint(args.queryId, 64, "queryId"), 64)
    .storeUint(parseUint(args.presetId, 4, "presetId"), 4)
    .storeStringRefTail(args.metadataUri)
    .storeCoins(BigInt(args.initialBuy));
  storeInlineAffiliate(builder, args.partnerConfig, "partner");
  storeInlineAffiliate(builder, args.referrerConfig, "referrer");
  return builder.endCell();
}

export function buildDeployCustomizedMeme(args) {
  return beginCell()
    .storeUint(OPCODES.DEPLOY_CUSTOMIZED_MEME, 32)
    .storeUint(parseUint(args.queryId, 64, "queryId"), 64)
    .storeUint(parseUint(args.totalSupplyPresetId, 4, "totalSupplyPresetId"), 4)
    .storeUint(parseUint(args.baseFeePresetId, 4, "baseFeePresetId"), 4)
    .storeCoins(BigInt(args.raisingFunds))
    .storeUint(parseUint(args.onSellSupplyPercent, 8, "onSellSupplyPercent"), 8)
    .storeAddress(address(args.partnerAddress, "partnerAddress"))
    .storeUint(parseUint(args.partnerFeeBps, 16, "partnerFeeBps"), 16)
    .storeUint(parseUint(args.poolPartnerFeeBps, 16, "poolPartnerFeeBps"), 16)
    .storeUint(parseUint(args.poolBaseFeePresetId, 16, "poolBaseFeePresetId"), 16)
    .storeAddress(args.poolLiquidityOwnerAddress ? address(args.poolLiquidityOwnerAddress, "poolLiquidityOwnerAddress") : null)
    .storeStringRefTail(args.metadataUri)
    .storeCoins(BigInt(args.initialBuy))
    .storeMaybeRef(affiliateCell(args.partnerConfig, "partner"))
    .storeMaybeRef(affiliateCell(args.referrerConfig, "referrer"))
    .endCell();
}

export function buildBuy(args) {
  return beginCell()
    .storeUint(OPCODES.BUY, 32)
    .storeUint(parseUint(args.queryId, 64, "queryId"), 64)
    .storeCoins(BigInt(args.amount))
    .storeCoins(BigInt(args.minimalAmountOut))
    .storeAddress(address(args.excessesTo, "excessesTo"))
    .storeMaybeRef(affiliateCell(args.partnerConfig, "partner"))
    .storeMaybeRef(affiliateCell(args.referrerConfig, "referrer"))
    .endCell();
}

export function decodeBuy(cell) {
  const slice = cell.beginParse();
  requireOpcode(slice, OPCODES.BUY, "Buy");
  return {
    queryId: slice.loadUintBig(64),
    amount: slice.loadCoins(),
    minimalAmountOut: slice.loadCoins(),
    excessesTo: slice.loadAddress(),
    partnerConfig: loadAffiliateRef(slice, "partner"),
    referrerConfig: loadAffiliateRef(slice, "referrer"),
  };
}

export function buildSellTokens(args) {
  return beginCell()
    .storeUint(OPCODES.SELL_TOKENS, 32)
    .storeUint(parseUint(args.queryId, 64, "queryId"), 64)
    .storeCoins(BigInt(args.amount))
    .storeCoins(BigInt(args.minimalAmountOut))
    .storeAddress(args.excessesTo ? address(args.excessesTo, "excessesTo") : null)
    .storeMaybeRef(affiliateCell(args.partnerConfig, "partner"))
    .storeMaybeRef(affiliateCell(args.referrerConfig, "referrer"))
    .endCell();
}

export function decodeSellTokens(cell) {
  const slice = cell.beginParse();
  requireOpcode(slice, OPCODES.SELL_TOKENS, "SellTokens");
  return {
    queryId: slice.loadUintBig(64),
    amount: slice.loadCoins(),
    minimalAmountOut: slice.loadCoins(),
    excessesTo: slice.loadMaybeAddress(),
    partnerConfig: loadAffiliateRef(slice, "partner"),
    referrerConfig: loadAffiliateRef(slice, "referrer"),
  };
}

function buildClaim(opcode, args) {
  return beginCell()
    .storeUint(opcode, 32)
    .storeUint(parseUint(args.queryId, 64, "queryId"), 64)
    .storeAddress(args.to ? address(args.to, "to") : null)
    .storeAddress(args.excessesTo ? address(args.excessesTo, "excessesTo") : null)
    .endCell();
}

export const buildClaimCreatorFee = (args) => buildClaim(OPCODES.CLAIM_CREATOR_FEE, args);
export const buildClaimPartnerFee = (args) => buildClaim(OPCODES.CLAIM_PARTNER_FEE, args);

function requireOpcode(slice, expected, name) {
  if (slice.remainingBits < 32 || slice.loadUint(32) !== expected) throw new UranusError("INVALID_RESPONSE", `Not a ${name} body`);
}

function loadInlineAffiliate(slice, kind) {
  if (!slice.loadBoolean()) return null;
  return kind === "partner"
    ? { partnerId: slice.loadUintBig(256), partnerFeeBps: slice.loadUint(16) }
    : { referrerId: slice.loadUintBig(256), referrerFeeBps: slice.loadUint(16) };
}

export function decodeInitMeme(cell) {
  const slice = cell.beginParse();
  requireOpcode(slice, OPCODES.INIT_MEME, "InitMeme");
  return {
    queryId: slice.loadUintBig(64),
    initialBuy: slice.loadCoins(),
    partnerConfig: loadInlineAffiliate(slice, "partner"),
    referrerConfig: loadInlineAffiliate(slice, "referrer"),
  };
}

export function decodeDeployMeme(cell) {
  const slice = cell.beginParse();
  requireOpcode(slice, OPCODES.DEPLOY_MEME, "DeployMeme");
  return {
    kind: "preset",
    queryId: slice.loadUintBig(64),
    presetId: slice.loadUint(4),
    metadataUri: slice.loadStringRefTail(),
    initialBuy: slice.loadCoins(),
    partnerConfig: loadInlineAffiliate(slice, "partner"),
    referrerConfig: loadInlineAffiliate(slice, "referrer"),
  };
}

function loadAffiliateRef(slice, kind) {
  const ref = slice.loadMaybeRef();
  if (!ref) return null;
  const data = ref.beginParse();
  return kind === "partner"
    ? { partnerId: data.loadUintBig(256), partnerFeeBps: data.loadUint(16) }
    : { referrerId: data.loadUintBig(256), referrerFeeBps: data.loadUint(16) };
}

export function decodeDeployCustomizedMeme(cell) {
  const slice = cell.beginParse();
  requireOpcode(slice, OPCODES.DEPLOY_CUSTOMIZED_MEME, "DeployCustomizedMeme");
  return {
    kind: "custom",
    queryId: slice.loadUintBig(64),
    totalSupplyPresetId: slice.loadUint(4),
    baseFeePresetId: slice.loadUint(4),
    raisingFunds: slice.loadCoins(),
    onSellSupplyPercent: slice.loadUint(8),
    partnerAddress: slice.loadAddress(),
    partnerFeeBps: slice.loadUint(16),
    poolPartnerFeeBps: slice.loadUint(16),
    poolBaseFeePresetId: slice.loadUint(16),
    poolLiquidityOwnerAddress: slice.loadMaybeAddress(),
    metadataUri: slice.loadStringRefTail(),
    initialBuy: slice.loadCoins(),
    partnerConfig: loadAffiliateRef(slice, "partner"),
    referrerConfig: loadAffiliateRef(slice, "referrer"),
  };
}

function loadTradeFees(slice) {
  return {
    creatorFee: slice.loadCoins(),
    protocolFee: slice.loadCoins(),
    partnerFee: slice.loadCoins(),
    referrerFee: slice.loadCoins(),
  };
}

export function decodeTradeEvent(cell) {
  const slice = cell.beginParse();
  if (slice.remainingBits < 32) return null;
  const opcode = slice.preloadUint(32);
  if (opcode !== OPCODES.BUY_EVENT && opcode !== OPCODES.SELL_EVENT) return null;
  slice.loadUint(32);
  const event = {
    kind: opcode === OPCODES.BUY_EVENT ? "buy" : "sell",
    traderAddress: slice.loadAddress(),
    amountIn: slice.loadCoins(),
    amountOut: slice.loadCoins(),
    fees: loadTradeFees(slice),
    currentSupply: slice.loadCoins(),
    raisedFunds: slice.loadCoins(),
  };
  if (opcode === OPCODES.BUY_EVENT) event.isGraduated = slice.loadBoolean();
  return event;
}

export function decodeClaim(cell, expectedOpcode) {
  const slice = cell.beginParse();
  requireOpcode(slice, expectedOpcode, "claim");
  return {
    queryId: slice.loadUintBig(64),
    to: slice.loadMaybeAddress(),
    excessesTo: slice.loadMaybeAddress(),
  };
}

export function normalizeAddress(value) {
  return address(value).toString();
}
