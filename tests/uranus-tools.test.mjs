import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { Address, beginCell } from "../plugins/uranus/node_modules/@ton/core/dist/index.js";
import { tools as createTools } from "../plugins/uranus/index.js";
import { createActions } from "../plugins/uranus/actions.js";
import { createHttp, assertPublicMetadataUrl, resolvePublicMetadataTarget } from "../plugins/uranus/http.js";
import { createState } from "../plugins/uranus/state.js";
import { createHistory } from "../plugins/uranus/history.js";
import { buildDeployCustomizedMeme, buildDeployMeme, decodeBuy, decodeClaim, decodeSellTokens } from "../plugins/uranus/abi.js";
import { ACTIVE_FACTORY, MEME_CODE_HASHES, OPCODES } from "../plugins/uranus/constants.js";

const ZERO = "EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c";
const ONE = "EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAd99";
const MEME = "EQAm57u2jsX1XSzmYtXZLcg6-0F1DqTUJZgpm_fA-kqAVJ7d";
const log = { info() {}, warn() {}, error() {}, debug() {} };
const config = { maxActionTon: "50", defaultSlippageBps: 500, partnerId: null, partnerFeeBps: 0, referrerId: null, referrerFeeBps: 0, allowThirdPartyPartnerClaim: false };

function sdkBase(overrides = {}) {
  return {
    log,
    pluginConfig: {},
    storage: { get() {}, set() {} },
    secrets: { get() {} },
    ton: {
      getAddress: () => ZERO,
      getBalance: async () => ({ balance: "100", balanceNano: "100000000000" }),
      send: async () => ({ hash: "abc123", seqno: 1 }),
      ...overrides,
    },
  };
}

function curveInfo(extra = {}) {
  return {
    address: MEME, verified: true, version: "v3.1", writable_curve: true, migrated: false,
    decimals: 9, creator_address: ZERO, creator_fee_nano: "1000000000", creator_fee_ton: "1",
    partner_address: ZERO, partner_fee_nano: "2000000000", partner_fee_ton: "2",
    ...extra,
  };
}

test("runtime and disk manifests expose the same 13 tools and all actions are approval-gated", async () => {
  const sdk = sdkBase({ dex: {} });
  const tools = createTools(sdk);
  const disk = JSON.parse(await readFile(new URL("../plugins/uranus/manifest.json", import.meta.url)));
  assert.equal(tools.length, 13);
  assert.deepEqual(tools.map((tool) => tool.name).sort(), disk.tools.map((tool) => tool.name).sort());
  for (const tool of tools) {
    assert.match(tool.name, /^uranus_/);
    assert.equal(tool.parameters.type, "object");
    if (tool.category === "action") {
      assert.equal(tool.scope, "admin-only");
      assert.equal(tool.requiresApproval, true);
    }
  }
});

test("documented Meme getter stack order maps to named public state", async () => {
  const addressItem = (value) => ({ type: "cell", cell: beginCell().storeAddress(Address.parse(value)).endCell() });
  const integer = (value) => ({ type: "int", value: BigInt(value) });
  const methods = {
    get_meme_data: [integer(-1), integer(0), addressItem(ONE), addressItem(ZERO), integer(7), integer(9), integer(0), integer(1_000), integer(100), integer(750), integer(300), integer(250), integer(200)],
    get_jetton_data: [integer(1_000), integer(0), { type: "cell", cell: beginCell().storeAddress(null).endCell() }, { type: "cell", cell: beginCell().storeUint(0, 8).endCell() }, { type: "cell", cell: beginCell().endCell() }],
    get_bonding_curve_data: [integer(0), integer(1_000), integer(200), integer(750), integer(250), integer(800), integer(50), integer(250), integer(1_000), integer(100)],
    get_partner_data: [integer(33), integer(500), addressItem(ONE), integer(400)],
  };
  const sdk = sdkBase({
    runGetMethod: async (_address, method) => ({ exitCode: 0, stack: methods[method] }),
    getJettonInfo: async () => null,
  });
  const codeHash = Buffer.from(MEME_CODE_HASHES["v3.1"], "hex").toString("base64");
  const http = { accountState: async () => ({ accounts: [{ address: Address.parse(MEME).toRawString(), status: "active", code_hash: codeHash }] }) };
  const info = await createState(sdk, http).memeInfo(MEME);
  assert.equal(info.verified, true);
  assert.equal(info.max_supply, "1000");
  assert.equal(info.bonding_supply, "750");
  assert.equal(info.liquidity_supply, "250");
  assert.equal(info.target_funds_nano, "800");
  assert.equal(info.migration_fee_nano, "50");
  assert.equal(info.partner_fee_nano, "33");
  assert.equal(info.partner_fee_bps, 500);
  assert.equal(info.partner_address, ONE);
  assert.equal(info.pool_partner_fee_bps, 400);
});

test("account identity fails closed when the response omits the requested address", async () => {
  const codeHash = Buffer.from(MEME_CODE_HASHES["v3.1"], "hex").toString("base64");
  const http = { accountState: async () => ({ accounts: [{ address: Address.parse(ONE).toRawString(), status: "active", code_hash: codeHash }] }) };
  const identity = await createState(sdkBase(), http).inspectContract(MEME);
  assert.equal(identity.account, null);
  assert.equal(identity.codeHash, null);
  assert.equal(identity.verified, false);
});

test("factory history decodes preset and custom launches and skips malformed transactions", async () => {
  const init = (queryId, initialBuy) => beginCell().storeUint(OPCODES.INIT_MEME, 32).storeUint(queryId, 64).storeCoins(initialBuy).storeBit(false).storeBit(false).endCell();
  const simple = buildDeployMeme({ queryId: 11n, presetId: 3, metadataUri: "ipfs://simple", initialBuy: 1n, partnerConfig: null, referrerConfig: null });
  const custom = buildDeployCustomizedMeme({ queryId: 12n, totalSupplyPresetId: 1, baseFeePresetId: 3, raisingFunds: 1_000_000_000_000n, onSellSupplyPercent: 75, partnerAddress: ZERO, partnerFeeBps: 0, poolPartnerFeeBps: 0, poolBaseFeePresetId: 3, poolLiquidityOwnerAddress: null, metadataUri: "ipfs://custom", initialBuy: 2n, partnerConfig: null, referrerConfig: null });
  const message = (body, opcode, extra = {}) => ({ opcode, message_content: { body: body.toBoc().toString("base64") }, ...extra });
  const payload = { transactions: [
    { hash: Buffer.alloc(32, 1).toString("base64"), now: 2, in_msg: message(simple, "0x6ff416dc", { source: ZERO }), out_msgs: [message(init(11n, 1n), "0x796f5a0c", { destination: MEME })] },
    { hash: Buffer.alloc(32, 2).toString("base64"), now: 1, in_msg: message(custom, "0x632f5d1c", { source: ONE }), out_msgs: [message(init(12n, 2n), "0x796f5a0c", { destination: ONE })] },
    { hash: "bad", now: 3, in_msg: { opcode: "0x632f5d1c", message_content: { body: "not-a-boc" } }, out_msgs: [] },
  ] };
  const launches = await createHistory({ log }, { transactions: async () => payload }).recentLaunches({ limit: 10, factory_version: "v3.1" });
  assert.equal(launches.length, 2);
  assert.deepEqual(launches.map((launch) => launch.kind), ["preset", "custom"]);
  assert.deepEqual(launches.map((launch) => launch.query_id), ["11", "12"]);
  assert.deepEqual(launches.map((launch) => launch.metadata_uri), ["ipfs://simple", "ipfs://custom"]);
});

test("counterfeit identity blocks address-based financial actions before send", async () => {
  let sends = 0;
  const sdk = sdkBase({ send: async () => { sends += 1; } });
  const deps = {
    config,
    state: { memeInfo: async () => curveInfo({ verified: false }) },
    quote: async () => { throw new Error("must not quote"); },
    history: {},
  };
  const actions = createActions(sdk, deps, { attempts: 1, intervalMs: 0 });
  await assert.rejects(actions.buy({ meme_address: MEME, amount_ton: "1" }), /code hash/i);
  await assert.rejects(actions.sell({ meme_address: MEME, amount_tokens: "1" }), /code hash/i);
  await assert.rejects(actions.claimCreatorFee({ meme_address: MEME }), /code hash/i);
  await assert.rejects(actions.claimPartnerFee({ meme_address: MEME }), /code hash/i);
  assert.equal(sends, 0);
});

test("curve buy and sell use fixed targets, safe budgets and internally-derived min output", async () => {
  const sent = [];
  const balances = [10_000n, 11_000n, 11_000n, 9_000n];
  const sdk = sdkBase({ send: async (...args) => { sent.push(args); return { hash: `hash${sent.length}`, seqno: sent.length }; } });
  const state = {
    memeInfo: async () => curveInfo(),
    walletInfo: async () => ({ wallet_address: ONE, verified: true, _rawBalance: balances.shift() }),
  };
  const quote = async ({ direction }) => direction === "buy"
    ? { expected_output: "2", minimum_output: "1.9", minimum_output_raw: "1900000000" }
    : { expected_output: "0.9", minimum_output: "0.8", minimum_output_raw: "800000000" };
  const actions = createActions(sdk, { config, state, quote, history: {} }, { attempts: 1, intervalMs: 0, sleep: async () => {} });
  const buy = await actions.buy({ meme_address: MEME, amount_ton: "1" });
  assert.equal(sent[0][0], MEME);
  assert.equal(sent[0][1], 1.1);
  assert.equal(decodeBuy(sent[0][2].body).minimalAmountOut, 1_900_000_000n);
  assert.equal(buy.status, "confirmed");

  const sell = await actions.sell({ meme_address: MEME, amount_tokens: "0.000001" });
  assert.equal(sent[1][0], ONE);
  assert.equal(sent[1][1], 0.12);
  assert.equal(decodeSellTokens(sent[1][2].body).minimalAmountOut, 800_000_000n);
  assert.equal(sell.status, "confirmed");
});

test("settlement timeout returns submitted_unsettled, not confirmed", async () => {
  const sdk = sdkBase();
  const state = { memeInfo: async () => curveInfo(), walletInfo: async () => ({ wallet_address: ONE, verified: true, _rawBalance: 10n }) };
  const quote = async () => ({ expected_output: "1", minimum_output: "0.9", minimum_output_raw: "900000000" });
  const actions = createActions(sdk, { config, state, quote, history: {} }, { attempts: 1, intervalMs: 0, sleep: async () => {} });
  const result = await actions.buy({ meme_address: MEME, amount_ton: "1" });
  assert.equal(result.status, "submitted_unsettled");
});

test("migrated trades route exclusively through DeDust", async () => {
  const calls = [];
  const sdk = sdkBase({ dex: { swapDeDust: async (params) => { calls.push(params); return { txRef: "dexhash", expectedOutput: "2", minOutput: "1.8" }; } } });
  const state = { memeInfo: async () => curveInfo({ migrated: true }), walletInfo: async () => ({ verified: true, _rawBalance: 10_000_000_000n }) };
  const actions = createActions(sdk, { config, state, quote: async () => {}, history: {} });
  await actions.buy({ meme_address: MEME, amount_ton: "1", slippage_bps: 500 });
  await actions.sell({ meme_address: MEME, amount_tokens: "2", slippage_bps: 250 });
  assert.deepEqual(calls, [
    { fromAsset: "ton", toAsset: MEME, amount: 1, slippage: 0.05 },
    { fromAsset: MEME, toAsset: "ton", amount: 2, slippage: 0.025 },
  ]);
});

test("launches target only v3.1 and claims cannot redirect payouts", async () => {
  const sent = [];
  const sdk = sdkBase({ send: async (...args) => { sent.push(args); return { hash: "hash", seqno: 1 }; } });
  let creatorFee = 1_000_000_000n;
  let partnerFee = 2_000_000_000n;
  const state = {
    memeInfo: async () => curveInfo({ creator_fee_nano: String(creatorFee), partner_fee_nano: String(partnerFee) }),
    inspectContract: async () => ({ verified: true, version: "v3.1" }),
  };
  const history = { recentLaunches: async () => [] };
  const actions = createActions(sdk, { config, state, quote: async () => {}, history }, { attempts: 1, intervalMs: 0, sleep: async () => { creatorFee = 0n; partnerFee = 0n; } });
  await actions.launchPreset({ preset_id: 3, metadata_uri: "ipfs://bafytest", initial_buy_ton: "0" });
  await actions.launchCustom({ total_supply_preset_id: 1, base_fee_preset_id: 3, raising_funds_ton: "1000", on_sell_supply_percent: 75, partner_fee_bps: 0, pool_partner_fee_bps: 0, pool_base_fee_preset_id: 3, metadata_uri: "ipfs://bafytest", initial_buy_ton: "0" });
  assert.equal(sent[0][0], ACTIVE_FACTORY);
  assert.equal(sent[1][0], ACTIVE_FACTORY);

  await actions.claimCreatorFee({ meme_address: MEME });
  const creatorClaim = decodeClaim(sent[2][2].body, OPCODES.CLAIM_CREATOR_FEE);
  assert.equal(creatorClaim.to.toString(), ZERO);
  assert.equal(creatorClaim.excessesTo.toString(), ZERO);
  await actions.claimPartnerFee({ meme_address: MEME });
  const partnerClaim = decodeClaim(sent[3][2].body, OPCODES.CLAIM_PARTNER_FEE);
  assert.equal(partnerClaim.to.toString(), ZERO);
  assert.equal(partnerClaim.excessesTo.toString(), ZERO);
});

test("custom deploy constraints return stable failures", async () => {
  const actions = createActions(sdkBase(), { config, state: {}, quote: async () => {}, history: {} });
  const base = { total_supply_preset_id: 1, base_fee_preset_id: 3, raising_funds_ton: "1000", on_sell_supply_percent: 75, partner_fee_bps: 0, pool_partner_fee_bps: 0, pool_base_fee_preset_id: 3, metadata_uri: "ipfs://bafytest" };
  await assert.rejects(actions.launchCustom({ ...base, raising_funds_ton: "799" }), (error) => error.code === "RAISE_OUT_OF_RANGE");
  await assert.rejects(actions.launchCustom({ ...base, partner_fee_bps: 6001 }), (error) => error.code === "PARTNER_FEE_OUT_OF_RANGE");
  await assert.rejects(actions.launchCustom({ ...base, on_sell_supply_percent: 59 }), (error) => error.code === "SELL_SUPPLY_OUT_OF_RANGE");
});

test("unproven third-party partner claims fail closed even when configured", async () => {
  const thirdPartyConfig = { ...config, allowThirdPartyPartnerClaim: true };
  const state = { memeInfo: async () => curveInfo({ partner_address: ONE }) };
  const actions = createActions(sdkBase(), { config: thirdPartyConfig, state, quote: async () => {}, history: {} });
  await assert.rejects(actions.claimPartnerFee({ meme_address: MEME }), (error) => error.code === "PARTNER_CLAIM_AUTH_UNVERIFIED");
});

test("metadata SSRF and Toncenter failures fail closed with bounded errors", async () => {
  await assert.rejects(assertPublicMetadataUrl("http://127.0.0.1/a.json"), (error) => error.code === "METADATA_SSRF_BLOCKED");
  await assert.rejects(assertPublicMetadataUrl("http://localhost/a.json"), (error) => error.code === "METADATA_SSRF_BLOCKED");
  await assert.rejects(assertPublicMetadataUrl("http://[::1]/a.json"), (error) => error.code === "METADATA_SSRF_BLOCKED");
  await assert.rejects(assertPublicMetadataUrl("http://[0:0:0:0:0:0:0:1]/a.json"), (error) => error.code === "METADATA_SSRF_BLOCKED");
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response("{}", { status: 429 });
    await assert.rejects(createHttp(sdkBase()).transactions(ZERO), (error) => error.code === "UPSTREAM_RATE_LIMITED");
    globalThis.fetch = async () => new Response("not json", { status: 200, headers: { "content-type": "application/json" } });
    await assert.rejects(createHttp(sdkBase()).transactions(ZERO), (error) => error.code === "INVALID_RESPONSE");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("metadata fetches stay pinned to the address validated for each redirect hop", async () => {
  const resolved = [];
  const fetched = [];
  const responses = [
    new Response(null, { status: 302, headers: { location: "https://cdn.example/meta.json" } }),
    new Response('{"name":"safe"}', { status: 200, headers: { "content-type": "application/json" } }),
  ];
  const targets = new Map([
    ["metadata.example", "203.0.113.10"],
    ["cdn.example", "203.0.113.11"],
  ]);
  const http = createHttp(sdkBase(), {
    resolveMetadataTarget: async (input) => {
      const url = new URL(input);
      const target = { url, address: targets.get(url.hostname), family: 4 };
      resolved.push(target);
      return target;
    },
    fetchPinnedMetadata: async (target) => {
      fetched.push(target);
      return responses.shift();
    },
  });

  assert.deepEqual(await http.metadata("https://metadata.example/meta.json"), { name: "safe" });
  assert.deepEqual(resolved.map(({ address }) => address), ["203.0.113.10", "203.0.113.11"]);
  assert.deepEqual(fetched.map(({ address }) => address), ["203.0.113.10", "203.0.113.11"]);
  assert.strictEqual(fetched[0], resolved[0]);
  assert.strictEqual(fetched[1], resolved[1]);
});

test("metadata DNS is not resolved again between validation and connection", async () => {
  let lookups = 0;
  const fetched = [];
  const lookupOnce = async () => {
    lookups += 1;
    return lookups === 1
      ? [{ address: "203.0.113.20", family: 4 }]
      : [{ address: "127.0.0.1", family: 4 }];
  };
  const http = createHttp(sdkBase(), {
    resolveMetadataTarget: (input) => resolvePublicMetadataTarget(input, lookupOnce),
    fetchPinnedMetadata: async (target) => {
      fetched.push(target.address);
      return new Response('{"name":"safe"}', { status: 200 });
    },
  });

  assert.deepEqual(await http.metadata("https://rebind.example/meta.json"), { name: "safe" });
  assert.equal(lookups, 1);
  assert.deepEqual(fetched, ["203.0.113.20"]);
});
