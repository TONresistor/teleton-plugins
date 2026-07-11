import assert from "node:assert/strict";
import test from "node:test";
import { applySlippage, estimateBuyOut, estimateSellOut, quoteCurve, raiseAtSupply, supplyAtRaise } from "../plugins/uranus/quote.js";

const state = {
  initialized: true,
  migrated: false,
  isGraduated: false,
  alpha: 1_144_067_796_610_169_491n,
  beta: 814_406_779_661n,
  tradeFeeBps: 300,
  raisedFunds: 23_926_336_271n,
  currentSupply: 32_652_116_795_191_278n,
};
const TON = 1_000_000_000n;

test("curve half-saturation and inverse are exact within floor tolerance", () => {
  assert.equal(supplyAtRaise(state.alpha, state.beta, state.beta), state.alpha / 2n);
  const supply = supplyAtRaise(state.alpha, state.beta, state.raisedFunds);
  const raise = raiseAtSupply(state.alpha, state.beta, supply);
  assert.ok(state.raisedFunds - raise <= 1n);
});

test("verified tradingbot curve snapshot is monotonic and concave", () => {
  const out5 = estimateBuyOut(state, 5n * TON);
  const out10 = estimateBuyOut(state, 10n * TON);
  assert.ok(out5 > 0n);
  assert.ok(out10 > out5);
  assert.ok(out10 < 2n * out5);
  const sellBack = estimateSellOut(state, out5);
  assert.ok(sellBack > 0n && sellBack < 5n * TON);
});

test("sell fee and slippage use exact integer floor division", () => {
  const tokens = 1_000_000_000_000n;
  const remaining = state.currentSupply - tokens;
  const gross = state.raisedFunds - raiseAtSupply(state.alpha, state.beta, remaining);
  assert.equal(estimateSellOut(state, tokens), (gross * 10_000n) / 10_300n);
  assert.equal(applySlippage(1_234_567n, 500), (1_234_567n * 9_500n) / 10_000n);
});

test("quotes fail closed for invalid lifecycle, oversell and zero minimum", () => {
  assert.throws(() => estimateBuyOut({ ...state, initialized: false }, TON), /not initialized/i);
  assert.throws(() => estimateBuyOut({ ...state, isGraduated: true }, TON), /migration/i);
  assert.throws(() => estimateBuyOut({ ...state, currentSupply: state.alpha }, TON), /asymptote/i);
  assert.throws(() => estimateSellOut(state, state.currentSupply + 1n), /exceeds/i);
  assert.throws(() => quoteCurve({ ...state, alpha: 2n, beta: 1n, raisedFunds: 0n, currentSupply: 0n }, "buy", 1n, 500), /too small/i);
});
