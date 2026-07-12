import { randomBytes } from "node:crypto";
import { ACTIVE_FACTORY, GAS_NANO, SETTLEMENT } from "./constants.js";
import { buildBuy, buildClaimCreatorFee, buildClaimPartnerFee, buildDeployCustomizedMeme, buildDeployMeme, buildSellTokens, normalizeAddress } from "./abi.js";
import { formatUnits, nanoToTonNumber, parseUnits } from "./amounts.js";
import { UranusError } from "./errors.js";
import { normalizeMetadataUri } from "./http.js";

// The 100 most recent successful mainnet claims sampled on 2026-07-11 all had
// sender == stored partner == explicit payout. Partner authorization is proven;
// permissionless third-party triggering is not, so that path stays fail-closed.
const THIRD_PARTY_PARTNER_CLAIM_PROVEN = false;

function queryId() {
  return randomBytes(8).readBigUInt64BE();
}

function txFields(result) {
  const txRef = result?.hash ?? result?.txRef ?? null;
  return { tx_ref: txRef, explorer: txRef ? `https://tonviewer.com/transaction/${txRef}` : null };
}

function affiliateConfig(config, kind) {
  const id = config[`${kind}Id`];
  const fee = Number(config[`${kind}FeeBps`] ?? 0);
  if (id == null || id === "") {
    if (fee !== 0) throw new UranusError("INVALID_CONFIG", `${kind}FeeBps requires ${kind}Id`);
    return null;
  }
  if (!Number.isInteger(fee) || fee < 0 || fee > 10_000) throw new UranusError("INVALID_CONFIG", `${kind}FeeBps must be between 0 and 10000`);
  return kind === "partner" ? { partnerId: id, partnerFeeBps: fee } : { referrerId: id, referrerFeeBps: fee };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createActions(sdk, deps, options = {}) {
  const attempts = options.attempts ?? SETTLEMENT.ATTEMPTS;
  const intervalMs = options.intervalMs ?? SETTLEMENT.INTERVAL_MS;
  const pause = options.sleep ?? sleep;
  const config = deps.config;
  const partnerConfig = affiliateConfig(config, "partner");
  const referrerConfig = affiliateConfig(config, "referrer");

  function wallet() {
    const value = sdk.ton.getAddress();
    if (!value) throw new UranusError("WALLET_NOT_INITIALIZED", "Teleton wallet is not initialized");
    return normalizeAddress(value);
  }

  async function requireTon(requiredNano) {
    const balance = await sdk.ton.getBalance();
    if (!balance) throw new UranusError("UPSTREAM_UNAVAILABLE", "Unable to read the Teleton wallet balance");
    if (BigInt(balance.balanceNano) < requiredNano + GAS_NANO.ACTION_HEADROOM) {
      throw new UranusError("INSUFFICIENT_TON", `Wallet needs at least ${formatUnits(requiredNano + GAS_NANO.ACTION_HEADROOM)} TON`);
    }
  }

  function enforceSpend(amountNano) {
    const cap = parseUnits(String(config.maxActionTon), 9, "maxActionTon");
    if (amountNano > cap) throw new UranusError("BALANCE_EXCEEDED", `Action exceeds configured ${config.maxActionTon} TON cap`);
  }

  async function financialInfo(address) {
    const info = await deps.state.memeInfo(address);
    if (!info.verified) throw new UranusError("UNVERIFIED_CONTRACT", "Meme contract code hash is not a supported Uranus deployment");
    if (!info.writable_curve && !info.migrated) throw new UranusError("UNSUPPORTED_VERSION", "This Uranus version is read-only");
    return info;
  }

  async function poll(check) {
    for (let i = 0; i < attempts; i += 1) {
      if (i > 0 || intervalMs > 0) await pause(intervalMs);
      try {
        const value = await check();
        if (value) return value;
      } catch (error) {
        sdk.log?.debug?.(`uranus: settlement poll ${i + 1} failed: ${String(error?.message ?? error)}`);
      }
    }
    return null;
  }

  async function buy(params) {
    const owner = wallet();
    const info = await financialInfo(params.meme_address);
    const amountNano = parseUnits(params.amount_ton, 9, "amount_ton");
    enforceSpend(amountNano);
    if (info.migrated) {
      await requireTon(amountNano + GAS_NANO.BUY);
      const result = await sdk.ton.dex.swapDeDust({ fromAsset: "ton", toAsset: info.address, amount: Number(params.amount_ton), slippage: (params.slippage_bps ?? config.defaultSlippageBps) / 10_000 });
      return { status: "confirmed", route: "dedust", ...txFields(result), expected_output: result.expectedOutput, minimum_output: result.minOutput };
    }
    const quote = await deps.quote({ meme_address: info.address, direction: "buy", amount: params.amount_ton, slippage_bps: params.slippage_bps });
    const before = await deps.state.walletInfo(info.address, owner);
    await requireTon(amountNano + GAS_NANO.BUY);
    const id = queryId();
    const body = buildBuy({ queryId: id, amount: amountNano, minimalAmountOut: BigInt(quote.minimum_output_raw), excessesTo: owner, partnerConfig, referrerConfig });
    const sent = await sdk.ton.send(info.address, nanoToTonNumber(amountNano + GAS_NANO.BUY), { body, bounce: true });
    const after = await poll(async () => {
      const value = await deps.state.walletInfo(info.address, owner);
      return value._rawBalance > before._rawBalance ? value : null;
    });
    return {
      status: after ? "confirmed" : "submitted_unsettled",
      route: "uranus_curve",
      query_id: id.toString(),
      ...txFields(sent),
      expected_output: quote.expected_output,
      minimum_output: quote.minimum_output,
      actual_token_delta: after ? formatUnits(after._rawBalance - before._rawBalance) : null,
    };
  }

  async function sell(params) {
    const owner = wallet();
    const info = await financialInfo(params.meme_address);
    const amountNano = parseUnits(params.amount_tokens, info.decimals, "amount_tokens");
    if (info.migrated) {
      const holdings = await deps.state.walletInfo(info.address, owner);
      if (!holdings.verified || amountNano > holdings._rawBalance) {
        throw new UranusError("INSUFFICIENT_JETTON", "Sell amount exceeds the verified Meme Wallet balance");
      }
      await requireTon(GAS_NANO.SELL);
      const result = await sdk.ton.dex.swapDeDust({ fromAsset: info.address, toAsset: "ton", amount: Number(params.amount_tokens), slippage: (params.slippage_bps ?? config.defaultSlippageBps) / 10_000 });
      return { status: "confirmed", route: "dedust", ...txFields(result), expected_output: result.expectedOutput, minimum_output: result.minOutput };
    }
    const before = await deps.state.walletInfo(info.address, owner);
    if (!before.verified) throw new UranusError("WALLET_NOT_INITIALIZED", "Uranus Meme Wallet is not active or failed owner/master verification");
    if (amountNano > before._rawBalance) throw new UranusError("INSUFFICIENT_JETTON", "Sell amount exceeds the Meme Wallet balance");
    const quote = await deps.quote({ meme_address: info.address, direction: "sell", amount: params.amount_tokens, slippage_bps: params.slippage_bps });
    await requireTon(GAS_NANO.SELL);
    const id = queryId();
    const body = buildSellTokens({ queryId: id, amount: amountNano, minimalAmountOut: BigInt(quote.minimum_output_raw), excessesTo: owner, partnerConfig, referrerConfig });
    const sent = await sdk.ton.send(before.wallet_address, nanoToTonNumber(GAS_NANO.SELL), { body, bounce: true });
    const after = await poll(async () => {
      const value = await deps.state.walletInfo(info.address, owner);
      return value._rawBalance < before._rawBalance ? value : null;
    });
    return {
      status: after ? "confirmed" : "submitted_unsettled",
      route: "uranus_curve",
      query_id: id.toString(),
      ...txFields(sent),
      expected_output: quote.expected_output,
      minimum_output: quote.minimum_output,
      actual_token_delta: after ? formatUnits(before._rawBalance - after._rawBalance, info.decimals) : null,
    };
  }

  async function confirmLaunch(id, creator) {
    return poll(async () => {
      const launches = await deps.history.recentLaunches({ limit: 50, factory_version: "v3.1" });
      const launch = launches.find((value) => value.query_id === id.toString());
      if (!launch || normalizeAddress(launch.creator_address) !== creator) return null;
      const identity = await deps.state.inspectContract(launch.meme_address);
      return identity.verified && identity.version === "v3.1" ? launch : null;
    });
  }

  async function launchPreset(params) {
    const creator = wallet();
    if (!Number.isInteger(params.preset_id) || params.preset_id < 3 || params.preset_id > 9) throw new UranusError("PRESET_NOT_FOUND", "preset_id must be between 3 and 9");
    normalizeMetadataUri(params.metadata_uri);
    const initialBuy = parseUnits(params.initial_buy_ton ?? "0", 9, "initial_buy_ton", { allowZero: true });
    enforceSpend(initialBuy);
    await requireTon(initialBuy + GAS_NANO.DEPLOY);
    const id = queryId();
    const body = buildDeployMeme({ queryId: id, presetId: params.preset_id, metadataUri: params.metadata_uri, initialBuy, partnerConfig, referrerConfig });
    const sent = await sdk.ton.send(ACTIVE_FACTORY, nanoToTonNumber(initialBuy + GAS_NANO.DEPLOY), { body, bounce: true });
    const launch = await confirmLaunch(id, creator);
    return { status: launch ? "confirmed" : "submitted_unsettled", query_id: id.toString(), ...txFields(sent), meme_address: launch?.meme_address ?? null };
  }

  async function launchCustom(params) {
    const creator = wallet();
    const integer = (value, min, max, code, field) => {
      if (!Number.isInteger(value) || value < min || value > max) throw new UranusError(code, `${field} must be between ${min} and ${max}`);
      return value;
    };
    integer(params.total_supply_preset_id, 0, 2, "SUPPLY_PRESET_NOT_FOUND", "total_supply_preset_id");
    integer(params.base_fee_preset_id, 0, 7, "FEE_PRESET_NOT_FOUND", "base_fee_preset_id");
    integer(params.pool_base_fee_preset_id, 0, 7, "FEE_PRESET_NOT_FOUND", "pool_base_fee_preset_id");
    integer(params.on_sell_supply_percent, 60, 80, "SELL_SUPPLY_OUT_OF_RANGE", "on_sell_supply_percent");
    integer(params.partner_fee_bps, 0, 6000, "PARTNER_FEE_OUT_OF_RANGE", "partner_fee_bps");
    integer(params.pool_partner_fee_bps, 0, 4000, "POOL_PARTNER_FEE_OUT_OF_RANGE", "pool_partner_fee_bps");
    normalizeMetadataUri(params.metadata_uri);
    const raise = parseUnits(params.raising_funds_ton, 9, "raising_funds_ton");
    if (raise < 800n * 1_000_000_000n || raise > 1_000_000n * 1_000_000_000n) throw new UranusError("RAISE_OUT_OF_RANGE", "Raise target is outside 800–1,000,000 TON");
    const initialBuy = parseUnits(params.initial_buy_ton ?? "0", 9, "initial_buy_ton", { allowZero: true });
    enforceSpend(initialBuy);
    await requireTon(initialBuy + GAS_NANO.DEPLOY);
    const id = queryId();
    const body = buildDeployCustomizedMeme({
      queryId: id,
      totalSupplyPresetId: params.total_supply_preset_id,
      baseFeePresetId: params.base_fee_preset_id,
      raisingFunds: raise,
      onSellSupplyPercent: params.on_sell_supply_percent,
      partnerAddress: params.partner_address ?? creator,
      partnerFeeBps: params.partner_fee_bps,
      poolPartnerFeeBps: params.pool_partner_fee_bps,
      poolBaseFeePresetId: params.pool_base_fee_preset_id,
      poolLiquidityOwnerAddress: params.pool_liquidity_owner_address ?? null,
      metadataUri: params.metadata_uri,
      initialBuy,
      partnerConfig,
      referrerConfig,
    });
    const sent = await sdk.ton.send(ACTIVE_FACTORY, nanoToTonNumber(initialBuy + GAS_NANO.DEPLOY), { body, bounce: true });
    const launch = await confirmLaunch(id, creator);
    return { status: launch ? "confirmed" : "submitted_unsettled", query_id: id.toString(), ...txFields(sent), meme_address: launch?.meme_address ?? null };
  }

  async function claimCreatorFee({ meme_address }) {
    const owner = wallet();
    const info = await financialInfo(meme_address);
    if (normalizeAddress(info.creator_address) !== owner) throw new UranusError("SENDER_UNAUTHORIZED", "Teleton wallet is not the Meme creator");
    const before = BigInt(info.creator_fee_nano ?? 0);
    if (before <= 0n) throw new UranusError("BALANCE_EXCEEDED", "No creator fee is currently claimable");
    await requireTon(GAS_NANO.CLAIM_CREATOR);
    const id = queryId();
    const sent = await sdk.ton.send(info.address, nanoToTonNumber(GAS_NANO.CLAIM_CREATOR), { body: buildClaimCreatorFee({ queryId: id, to: owner, excessesTo: owner }), bounce: true });
    const after = await poll(async () => {
      const value = await deps.state.memeInfo(info.address);
      return BigInt(value.creator_fee_nano ?? before) < before ? value : null;
    });
    return { status: after ? "confirmed" : "submitted_unsettled", query_id: id.toString(), ...txFields(sent), fee_before_ton: formatUnits(before), fee_after_ton: after?.creator_fee_ton ?? null };
  }

  async function claimPartnerFee({ meme_address }) {
    const owner = wallet();
    const info = await financialInfo(meme_address);
    if (!info.partner_address) throw new UranusError("INVALID_RESPONSE", "Meme does not expose partner state");
    const partner = normalizeAddress(info.partner_address);
    if (partner !== owner && !config.allowThirdPartyPartnerClaim) throw new UranusError("SENDER_UNAUTHORIZED", "Teleton wallet is not the stored Uranus partner");
    if (partner !== owner && !THIRD_PARTY_PARTNER_CLAIM_PROVEN) {
      throw new UranusError("PARTNER_CLAIM_AUTH_UNVERIFIED", "Third-party partner claim authorization is not proven on-chain");
    }
    const before = BigInt(info.partner_fee_nano ?? 0);
    if (before <= 0n) throw new UranusError("BALANCE_EXCEEDED", "No partner fee is currently claimable");
    await requireTon(GAS_NANO.CLAIM_PARTNER);
    const id = queryId();
    const sent = await sdk.ton.send(info.address, nanoToTonNumber(GAS_NANO.CLAIM_PARTNER), { body: buildClaimPartnerFee({ queryId: id, to: partner, excessesTo: partner }), bounce: true });
    const after = await poll(async () => {
      const value = await deps.state.memeInfo(info.address);
      return BigInt(value.partner_fee_nano ?? before) < before ? value : null;
    });
    return { status: after ? "confirmed" : "submitted_unsettled", query_id: id.toString(), ...txFields(sent), payout_address: partner, fee_before_ton: formatUnits(before), fee_after_ton: after?.partner_fee_ton ?? null };
  }

  return { buy, sell, launchPreset, launchCustom, claimCreatorFee, claimPartnerFee };
}
