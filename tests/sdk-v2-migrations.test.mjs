import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const agentDir = resolve(process.env.TELETON_AGENT_DIR ?? "../teleton-agent");
process.argv[1] = realpathSync(resolve(agentDir, "bin/teleton.js"));

const [{ tools: createDeezerTools }, { tools: createPicTools }, { tools: createVidTools }] =
  await Promise.all([
    import("../plugins/deezer/index.js"),
    import("../plugins/pic/index.js"),
    import("../plugins/vid/index.js"),
  ]);
const { tools: createMultisendTools } = await import("../plugins/multisend/index.js");
const { tools: createSbtTools } = await import("../plugins/sbt/index.js");
const { tools: createStormTools } = await import("../plugins/stormtrade/index.js");
const { tools: createSwapCoffeeTools } = await import("../plugins/swapcoffee/index.js");
const { actionTools: createWebdomActionTools } = await import("../plugins/webdom/tools/actions.js");
const { initTrade, placeAskOrder } = await import("../plugins/giftindex/trade.js");

const ADDRESS_A = `0:${"1".repeat(64)}`;
const ADDRESS_B = `0:${"2".repeat(64)}`;
const log = { info() {}, warn() {}, error() {}, debug() {} };
const { beginCell } = createRequire(process.argv[1])("@ton/core");

test("inline media plugins use the typed Telegram SDK capability", async () => {
  const calls = [];
  const sdk = {
    telegram: {
      async sendInlineBotResult(...args) {
        calls.push(args);
        return {
          query: args[2],
          sentIndex: args[3] ?? 0,
          totalResults: 3,
          title: "Result",
          description: null,
          type: "article",
        };
      },
    },
  };

  const cases = [
    [createDeezerTools, "DeezerMusicBot"],
    [createPicTools, "pic"],
    [createVidTools, "vid"],
  ];
  for (const [factory, bot] of cases) {
    const result = await factory(sdk)[0].execute({ query: "test", index: 1 }, { chatId: "42" });
    assert.equal(result.success, true);
    assert.deepEqual(calls.at(-1), ["42", bot, "test", 1]);
  }
});

test("multisend preserves the Highload wallet lifecycle through sdk.ton.highload", async () => {
  const batches = [];
  const highloadInfo = {
    address: ADDRESS_A,
    rawAddress: ADDRESS_A,
    balance: "100",
    balanceNano: "100000000000",
    deployed: true,
    currentQueryId: 4,
    hasNext: true,
    timeout: 86400,
    subwalletId: 0x10ad,
  };
  const sdk = {
    log,
    ton: {
      validateAddress: () => true,
      getAddress: () => ADDRESS_A,
      getJettonWalletAddress: async () => ADDRESS_B,
      highload: {
        getInfo: async () => highloadInfo,
        fund: async () => ({ hash: "fund-hash", seqno: 7 }),
        sendMessages: async (messages) => {
          batches.push(messages);
          return {
            address: ADDRESS_A,
            queryId: 3 + batches.length,
            nextQueryId: 4 + batches.length,
            recipientCount: messages.length,
          };
        },
      },
    },
  };
  const tools = createMultisendTools(sdk);

  assert.deepEqual(
    (await tools.find((tool) => tool.name === "multisend_info").execute({})).data,
    {
      address: ADDRESS_A,
      address_raw: ADDRESS_A,
      balance: "100",
      balance_nano: "100000000000",
      deployed: true,
      sequence: { lastQueryId: 4, savedQueryId: 4, hasNext: true },
    }
  );
  assert.equal(
    (await tools.find((tool) => tool.name === "multisend_fund").execute({ amount: "5" })).success,
    true
  );

  const tonResult = await tools.find((tool) => tool.name === "multisend_batch_ton").execute({
    recipients: [{ address: ADDRESS_B, amount: "1.25", memo: "batch" }],
  });
  assert.equal(tonResult.success, true);
  assert.deepEqual(batches[0], [
    { to: ADDRESS_B, value: 1.25, body: "batch", bounce: false },
  ]);

  const jettonResult = await tools.find((tool) => tool.name === "multisend_batch_jetton").execute({
    jetton_master: ADDRESS_B,
    decimals: 6,
    recipients: [{ address: ADDRESS_B, amount: "12.345678" }],
  });
  assert.equal(jettonResult.success, true);
  assert.equal(batches[1][0].to, ADDRESS_B);
  assert.equal(batches[1][0].value, 0.05);
  assert.ok(batches[1][0].body);
  assert.equal(
    (await tools.find((tool) => tool.name === "multisend_status").execute({})).success,
    true
  );
});

test("SBT deployment is sent through the protected TON broker", async () => {
  let sent;
  const sdk = {
    log,
    ton: {
      getAddress: () => ADDRESS_A,
      send: async (...args) => {
        sent = args;
        return { hash: "sbt-hash", seqno: 3 };
      },
    },
  };
  const deploy = createSbtTools(sdk).find((tool) => tool.name === "sbt_deploy_collection");
  const result = await deploy.execute({
    name: "Badges",
    description: "Test badges",
    image: "https://example.com/badge.png",
  });

  assert.equal(result.success, true);
  assert.equal(sent[1], 0.05);
  assert.equal(sent[2].bounce, false);
  assert.ok(sent[2].stateInit.code);
  assert.ok(sent[2].stateInit.data);
});

test("GiftIndex and Webdom writes no longer sign inside plugins", async () => {
  const sends = [];
  const ton = {
    getAddress: () => ADDRESS_A,
    getJettonWalletAddress: async () => ADDRESS_B,
    send: async (...args) => {
      sends.push(args);
      return { hash: "broker-hash", seqno: 9 };
    },
    fromNano: (value) => (Number(value) / 1e9).toString(),
  };
  initTrade({ log, ton });
  const gift = await placeAskOrder(ADDRESS_B, 1_000_000_000n, 10_000);
  assert.equal(gift.seqno, 9);
  assert.equal(sends[0][0], ADDRESS_B);

  const bid = createWebdomActionTools({ log, ton }).find(
    (tool) => tool.name === "webdom_place_bid"
  );
  const result = await bid.execute({ auction_address: ADDRESS_B, bid_ton: 2 });
  assert.equal(result.success, true);
  assert.match(sends[1][0], /^EQ/);
  assert.equal(sends[1][1], 2.11);
});

test("swap.coffee sends route transactions through sdk.ton.sendMessages", async () => {
  const originalFetch = globalThis.fetch;
  const responses = [
    { paths: [{ dex: "test" }], output_amount: 9, price_impact: 0.01 },
    {
      route_id: 77,
      transactions: [
        {
          address: ADDRESS_B,
          value: "100000000",
          cell: beginCell().endCell().toBoc().toString("base64"),
        },
      ],
    },
  ];
  globalThis.fetch = async () =>
    new Response(JSON.stringify(responses.shift()), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    let messages;
    const sdk = {
      log,
      ton: {
        getAddress: () => ADDRESS_A,
        fromNano: (value) => (Number(value) / 1e9).toString(),
        sendMessages: async (value) => {
          messages = value;
          return { hash: "swap-hash", seqno: 11 };
        },
      },
    };
    const execute = createSwapCoffeeTools(sdk).find((tool) => tool.name === "swap_execute");
    const result = await execute.execute({
      input_token: "native",
      output_token: ADDRESS_B,
      input_amount: "1",
    });

    assert.equal(result.success, true);
    assert.equal(result.data.seqno, 11);
    assert.equal(messages[0].to, ADDRESS_B);
    assert.equal(messages[0].value, 0.1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Storm read tools obtain the default trader from sdk.ton", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl;
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return new Response(JSON.stringify([{ position: "open" }]), { status: 200 });
  };
  try {
    const sdk = { log, ton: { getAddress: () => ADDRESS_A } };
    const positions = createStormTools(sdk).find((tool) => tool.name === "storm_positions");
    const result = await positions.execute({});

    assert.equal(result.success, true);
    assert.equal(result.trader, ADDRESS_A);
    assert.ok(requestedUrl.includes(encodeURIComponent(ADDRESS_A)) || requestedUrl.includes(ADDRESS_A));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
