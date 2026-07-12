import { formatUnits, parseUnits } from "./amounts.js";
import { UranusError } from "./errors.js";

const BPS = 10_000n;

export function supplyAtRaise(alpha, beta, raise) {
  if (alpha <= 0n || beta <= 0n || raise < 0n) throw new UranusError("CURVE_PARAMS_MALFORMED", "Invalid bonding-curve parameters");
  return (alpha * raise) / (beta + raise);
}

export function raiseAtSupply(alpha, beta, supply) {
  if (alpha <= 0n || beta <= 0n || supply < 0n || supply >= alpha) throw new UranusError("CURVE_PARAMS_MALFORMED", "Supply is outside the bonding curve");
  return (beta * supply) / (alpha - supply);
}

function assertTradable(state) {
  if (!state.initialized) throw new UranusError("NOT_INITIALIZED", "Contract is not initialized");
  if (state.migrated) throw new UranusError("ALREADY_GRADUATED", "Migrated tokens must use DeDust");
  if (state.isGraduated) throw new UranusError("MIGRATION_PENDING", "Token graduated but its DeDust migration is not complete");
  if (state.currentSupply >= state.alpha) throw new UranusError("CURVE_PARAMS_MALFORMED", "Curve supply reached its asymptote");
}

export function estimateBuyOut(state, tonIn) {
  assertTradable(state);
  if (tonIn <= 0n) throw new UranusError("INVALID_AMOUNT", "Buy amount must be positive");
  const output = supplyAtRaise(state.alpha, state.beta, state.raisedFunds + tonIn) - state.currentSupply;
  return output > 0n ? output : 0n;
}

export function estimateSellOut(state, tokensIn) {
  assertTradable(state);
  if (tokensIn <= 0n) throw new UranusError("INVALID_AMOUNT", "Sell amount must be positive");
  if (tokensIn > state.currentSupply) throw new UranusError("BALANCE_EXCEEDED", "Sell amount exceeds current curve supply");
  const gross = state.raisedFunds - raiseAtSupply(state.alpha, state.beta, state.currentSupply - tokensIn);
  return gross > 0n ? (gross * BPS) / (BPS + BigInt(state.tradeFeeBps)) : 0n;
}

export function applySlippage(output, slippageBps) {
  if (!Number.isInteger(slippageBps) || slippageBps < 1 || slippageBps > 5000) {
    throw new UranusError("INVALID_SLIPPAGE", "slippage_bps must be between 1 and 5000");
  }
  return (output * (BPS - BigInt(slippageBps))) / BPS;
}

export function quoteCurve(state, direction, amount, slippageBps) {
  if (direction !== "buy" && direction !== "sell") throw new UranusError("INVALID_DIRECTION", "direction must be buy or sell");
  const expected = direction === "buy" ? estimateBuyOut(state, amount) : estimateSellOut(state, amount);
  const minimum = applySlippage(expected, slippageBps);
  if (expected <= 0n || minimum <= 0n) throw new UranusError("SLIPPAGE_EXCEEDED", "Quote output is too small for safe execution");
  const fee = direction === "sell" ? (expected * BigInt(state.tradeFeeBps)) / BPS : 0n;
  return { expected, minimum, fee };
}

export function createQuote(sdk, stateReader, config) {
  return async function quoteMeme({ meme_address, direction, amount, slippage_bps }) {
    const info = await stateReader.memeInfo(meme_address);
    if (!info.verified) throw new UranusError("UNVERIFIED_CONTRACT", "Meme contract code hash is not a supported Uranus deployment");
    const slippageBps = slippage_bps ?? config.defaultSlippageBps;
    if (info.migrated) {
      const dexAmount = Number(amount);
      if (!Number.isFinite(dexAmount) || dexAmount <= 0) throw new UranusError("INVALID_AMOUNT", "amount must be a positive decimal string");
      const dex = await sdk.ton.dex.quoteDeDust({
        fromAsset: direction === "buy" ? "ton" : info.address,
        toAsset: direction === "buy" ? info.address : "ton",
        amount: dexAmount,
        slippage: slippageBps / 10_000,
      });
      if (!dex) throw new UranusError("UPSTREAM_UNAVAILABLE", "No ready DeDust pool was found for this migrated Meme");
      return {
        route: "dedust",
        direction,
        amount_in: amount,
        expected_output: dex.expectedOutput,
        minimum_output: dex.minOutput,
        estimated_fee: dex.fee,
        price_impact: dex.priceImpact ?? null,
        state_timestamp: info.state_timestamp,
      };
    }
    const raw = info._raw.meme;
    if (!raw) throw new UranusError("UNSUPPORTED_VERSION", "This Uranus contract does not expose the required curve state");
    const amountRaw = parseUnits(amount, 9, "amount");
    const quote = quoteCurve(raw, direction, amountRaw, slippageBps);
    return {
      route: "uranus_curve",
      direction,
      amount_in: amount,
      amount_in_raw: amountRaw.toString(),
      expected_output: formatUnits(quote.expected, 9),
      expected_output_raw: quote.expected.toString(),
      minimum_output: formatUnits(quote.minimum, 9),
      minimum_output_raw: quote.minimum.toString(),
      estimated_fee: formatUnits(quote.fee, 9),
      estimated_fee_raw: quote.fee.toString(),
      price_impact: null,
      slippage_bps: slippageBps,
      state_timestamp: info.state_timestamp,
      state: {
        alpha: raw.alpha.toString(), beta: raw.beta.toString(), raised_funds: raw.raisedFunds.toString(),
        current_supply: raw.currentSupply.toString(), trade_fee_bps: raw.tradeFeeBps,
      },
      _info: info,
      _raw: quote,
    };
  };
}
