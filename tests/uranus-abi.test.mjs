import assert from "node:assert/strict";
import test from "node:test";
import { Cell } from "../plugins/uranus/node_modules/@ton/core/dist/index.js";
import {
  buildBuy, buildClaimCreatorFee, buildClaimPartnerFee, buildDeployCustomizedMeme, buildDeployMeme, buildSellTokens,
  decodeBuy, decodeClaim, decodeDeployCustomizedMeme, decodeInitMeme, decodeSellTokens, decodeTradeEvent,
} from "../plugins/uranus/abi.js";
import { OPCODES } from "../plugins/uranus/constants.js";

const LIVE = {
  buy: "te6cckEBAgEAYQABc5SCZVc67Aq5Y1ozO0stBeAHDV7bJg/nf4AKfRHTrlqjKhY56Yd1LyG0BzBJ8520mNcwHvmFs2m7dPQBAEShjmQstVt+A24+NNkEW58QpbiZjgcVZKzypMRzgSUBFAA8lckNNQ==",
  sell: "te6cckEBAgEAYgABdbdFniw67Aq5jrYMJXHZ5ogW4dPFAhJ2SNaAHZZdG8WWCaTXMOZK5UZcusL/hyNT48jWSvREzbBGyQyUAQBEoY5kLLVbfgNuPjTZBFufEKW4mY4HFWSs8qTEc4ElARQAPLEb5yQ=",
  custom: "te6cckEBAgEAiQABg2MvXRwAAAAAAAAAABVgJGE5yoAEuABmzJ8wJ8F/sm1iZmbF3rdSW/gWwCsjSsEV0ZrfC2AdaAAAAAAACigSoF8gAQEAhGlwZnM6Ly9iYWZrcmVpYWZzZGs0aWkzbW9wbGEzNjY0bGhlNG93am0zM2tzZnJpZWduZnMya2Jhejdra3h6YWhlYYHi4FQ=",
  claim: "te6cckEBAQEAUQAAna1yaagAAAAAAAAAAIAdll0bxZYJpNcw5krlRly6wv+HI1PjyNZK9ETNsEbJDJADssujeLLBNJrmHMlcqMuXWF/w5Gp8eRrJXoiZtgjZIZKVtkGq",
  init: "te6cckEBAQEAFAAAI3lvWgwAAAAAAAAAAFAlQL5AAt97yzU=",
  buyEvent: "te6cckEBAQEATAAAk6Cqa8KAHZZdG8WWCaTXMOZK5UZcusL/hyNT48jWSvREzbBGyQyKBIVfKpDjs80QLcOniBvG5FqAbxuRYA47PNEC3Dp4oEhV8qkIDc92fQ==",
  sellEvent: "te6cckEBAQEARQAAhTqw/MyAHZZdG8WWCaTXMOZK5UZcusL/hyNT48jWSvREzbBGyQyOOzzRAtw6eKBF0neSKBrPy56Aaz8uaAaz8ugAIDAGd0bY",
};

function sameCell(actual, encoded) {
  assert.equal(encoded.hash().toString("hex"), actual.hash().toString("hex"));
}

test("byte-exact live Buy and SellTokens fixtures re-encode", () => {
  const buyCell = Cell.fromBase64(LIVE.buy);
  const buy = decodeBuy(buyCell);
  sameCell(buyCell, buildBuy({ ...buy, excessesTo: buy.excessesTo }));
  assert.equal(buy.amount, 3_000_000_000n);
  assert.equal(buy.partnerConfig.partnerFeeBps, 60);

  const sellCell = Cell.fromBase64(LIVE.sell);
  const sell = decodeSellTokens(sellCell);
  sameCell(sellCell, buildSellTokens({ ...sell, excessesTo: sell.excessesTo }));
  assert.equal(sell.amount, 8_336_946_009_873_724n);
});

test("byte-exact successful mainnet customized deploy fixture re-encodes", () => {
  const actual = Cell.fromBase64(LIVE.custom);
  const decoded = decodeDeployCustomizedMeme(actual);
  sameCell(actual, buildDeployCustomizedMeme(decoded));
  assert.equal(decoded.raisingFunds, 2_500_000_000_000n);
  assert.equal(decoded.onSellSupplyPercent, 75);
  assert.equal(decoded.metadataUri, "ipfs://bafkreiafsdk4ii3mopla3664lhe4owjm33ksfriegnfs2kbaz7kkxzahea");
});

test("preset deploy matches the official generated-codec fixture", () => {
  const expected = Cell.fromBase64("te6cckEBAgEAJgABI2/0FtwAAAAAAAAAe3QO5rKAIAEAHmlwZnM6Ly9iYWZ5dGVzdDR3ekk=");
  const actual = buildDeployMeme({ queryId: 123n, presetId: 7, metadataUri: "ipfs://bafytest", initialBuy: 250_000_000n, partnerConfig: null, referrerConfig: null });
  sameCell(expected, actual);
});

test("claim and InitMeme live fixtures decode and claims re-encode", () => {
  const claimCell = Cell.fromBase64(LIVE.claim);
  const claim = decodeClaim(claimCell, OPCODES.CLAIM_CREATOR_FEE);
  sameCell(claimCell, buildClaimCreatorFee(claim));
  const partner = buildClaimPartnerFee(claim);
  assert.equal(partner.beginParse().loadUint(32), OPCODES.CLAIM_PARTNER_FEE);

  const init = decodeInitMeme(Cell.fromBase64(LIVE.init));
  assert.equal(init.queryId, 0n);
  assert.equal(init.initialBuy, 10_000_000_000n);
});

test("live BuyEvent and SellEvent fixtures decode complete fee records", () => {
  const buy = decodeTradeEvent(Cell.fromBase64(LIVE.buyEvent));
  assert.equal(buy.kind, "buy");
  assert.equal(buy.amountIn, 9_708_737_864n);
  assert.deepEqual(buy.fees, { creatorFee: 233_009_709n, protocolFee: 58_252_427n, partnerFee: 0n, referrerFee: 0n });
  assert.equal(buy.isGraduated, false);

  const sell = decodeTradeEvent(Cell.fromBase64(LIVE.sellEvent));
  assert.equal(sell.kind, "sell");
  assert.equal(sell.raisedFunds, 1n);
  assert.equal(sell.fees.partnerFee, 56_228_212n);
});

test("affiliate refs encode present and absent, malformed bodies fail closed", () => {
  const absent = buildBuy({ queryId: 1n, amount: 1n, minimalAmountOut: 1n, excessesTo: "EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c", partnerConfig: null, referrerConfig: null });
  const present = buildBuy({ queryId: 1n, amount: 1n, minimalAmountOut: 1n, excessesTo: "EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c", partnerConfig: { partnerId: "2", partnerFeeBps: 50 }, referrerConfig: { referrerId: "3", referrerFeeBps: 25 } });
  assert.equal(decodeBuy(absent).partnerConfig, null);
  assert.equal(decodeBuy(present).referrerConfig.referrerId, 3n);
  assert.throws(() => decodeBuy(Cell.fromBase64("te6cckEBAQEABgAACAAAAAB7P4Q=")));
});
