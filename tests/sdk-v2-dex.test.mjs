import assert from "node:assert/strict";
import test from "node:test";
import { tools as createDedustTools } from "../plugins/dedust/index.js";
import { tools as createStonfiTools } from "../plugins/stonfi/index.js";

const log = { info() {}, warn() {}, error() {}, debug() {} };
const storage = { get() {}, set() {} };

test("DeDust quote and swap use the SDK v2 transaction broker", async () => {
  const calls = [];
  const sdk = {
    log,
    storage,
    ton: {
      dex: {
        async quoteDeDust(params) {
          calls.push(["quote", params]);
          return {
            dex: "dedust",
            expectedOutput: "2.500000",
            minOutput: "2.375000",
            rate: "0.250000",
            fee: "0.010000",
            poolType: "volatile",
          };
        },
        async swapDeDust(params) {
          calls.push(["swap", params]);
          return {
            dex: "dedust",
            fromAsset: "ton",
            toAsset: "EQJetton",
            amountIn: "10",
            expectedOutput: "2.500000",
            minOutput: "2.375000",
            slippage: "5.00%",
            txRef: "dedust-hash",
          };
        },
      },
    },
  };
  const tools = createDedustTools(sdk);

  const quote = await tools.find((tool) => tool.name === "dedust_swap_estimate").execute({
    input_token: "native",
    output_token: "EQJetton",
    input_amount: "10",
  });
  const swap = await tools.find((tool) => tool.name === "dedust_swap").execute({
    input_token: "native",
    output_token: "EQJetton",
    input_amount: "10",
    slippage: 0.05,
  });

  assert.deepEqual(calls, [
    ["quote", { fromAsset: "ton", toAsset: "EQJetton", amount: 10, slippage: 0.05 }],
    ["swap", { fromAsset: "ton", toAsset: "EQJetton", amount: 10, slippage: 0.05 }],
  ]);
  assert.equal(quote.success, true);
  assert.equal(quote.data.estimated_output, "2.500000");
  assert.equal(swap.success, true);
  assert.equal(swap.data.tx_ref, "dedust-hash");
});

test("STON.fi swap uses the SDK v2 transaction broker", async () => {
  let received;
  const sdk = {
    log,
    storage,
    ton: {
      dex: {
        async swapSTONfi(params) {
          received = params;
          return {
            dex: "stonfi",
            fromAsset: "ton",
            toAsset: "EQJetton",
            amountIn: "3",
            expectedOutput: "0.750000",
            minOutput: "0.742500",
            slippage: "1.00%",
            txRef: "stonfi-hash",
          };
        },
      },
    },
  };
  const tools = createStonfiTools(sdk);
  const swap = await tools.find((tool) => tool.name === "stonfi_swap").execute({
    offer_address: "ton",
    ask_address: "EQJetton",
    amount: "3",
    slippage: 0.01,
  });

  assert.deepEqual(received, {
    fromAsset: "ton",
    toAsset: "EQJetton",
    amount: 3,
    slippage: 0.01,
  });
  assert.equal(swap.success, true);
  assert.equal(swap.data.tx_ref, "stonfi-hash");
});
