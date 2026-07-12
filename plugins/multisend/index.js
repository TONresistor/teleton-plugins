/** Batch TON and jetton transfers through Teleton's core Highload Wallet v3 broker. */

import { createRequire } from "node:module";
import { realpathSync } from "node:fs";

const require = createRequire(realpathSync(process.argv[1]));
const { Address, beginCell } = require("@ton/core");

const MAX_RECIPIENTS = 254;

export function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS multisend_sequence (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      last_query_id TEXT NOT NULL
    )
  `);
}

export const manifest = {
  name: "multisend",
  version: "2.0.0",
  sdkVersion: "^2.1.0",
  description: "Batch TON and jetton transfers through Teleton's protected Highload Wallet v3 broker.",
};

function formatError(error) {
  return { success: false, error: String(error?.message || error).slice(0, 500) };
}

function validateRecipients(ton, recipients) {
  if (!Array.isArray(recipients) || recipients.length === 0) {
    throw new Error("recipients must be a non-empty array");
  }
  if (recipients.length > MAX_RECIPIENTS) {
    throw new Error(`Maximum ${MAX_RECIPIENTS} recipients per batch`);
  }
  for (const recipient of recipients) {
    if (!ton.validateAddress(recipient.address)) {
      throw new Error(`Invalid recipient address: ${recipient.address}`);
    }
  }
}

function parsePositiveAmount(value, label) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error(`Invalid ${label}: ${value}`);
  return amount;
}

function toUnits(value, decimals) {
  const input = String(value).trim();
  if (!/^\d+(?:\.\d+)?$/.test(input)) throw new Error(`Invalid jetton amount: ${value}`);
  const [whole, fraction = ""] = input.split(".");
  if (fraction.length > decimals) {
    throw new Error(`Jetton amount ${value} has more than ${decimals} decimals`);
  }
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, "0") || "0");
}

export const tools = (sdk) => {
  const multisendInfo = {
    name: "multisend_info",
    description: "Show the Highload multisend wallet address, balance, deployment, and query sequence.",
    category: "data-bearing",
    scope: "always",
    parameters: { type: "object", properties: {}, required: [] },
    execute: async () => {
      try {
        const info = await sdk.ton.highload.getInfo();
        return {
          success: true,
          data: {
            address: info.address,
            address_raw: info.rawAddress,
            balance: info.balance,
            balance_nano: info.balanceNano,
            deployed: info.deployed,
            sequence: {
              lastQueryId: info.currentQueryId,
              savedQueryId: info.currentQueryId,
              hasNext: info.hasNext,
            },
          },
        };
      } catch (error) {
        return formatError(error);
      }
    },
  };

  const multisendFund = {
    name: "multisend_fund",
    description: "Fund the Highload multisend wallet from the agent's main wallet.",
    category: "action",
    scope: "admin-only",
    parameters: {
      type: "object",
      properties: { amount: { type: "string", description: "Amount in TON" } },
      required: ["amount"],
    },
    execute: async (params) => {
      try {
        const amount = parsePositiveAmount(params.amount, "amount");
        const info = await sdk.ton.highload.getInfo();
        const result = await sdk.ton.highload.fund(amount);
        return {
          success: true,
          data: {
            from: sdk.ton.getAddress(),
            to: info.address,
            amount: params.amount,
            bounce: info.deployed,
            ...result,
          },
        };
      } catch (error) {
        return formatError(error);
      }
    },
  };

  const multisendBatchTon = {
    name: "multisend_batch_ton",
    description: "Send TON to up to 254 recipients in one Highload Wallet v3 batch.",
    category: "action",
    scope: "admin-only",
    parameters: {
      type: "object",
      properties: {
        recipients: {
          type: "array",
          maxItems: MAX_RECIPIENTS,
          items: {
            type: "object",
            properties: {
              address: { type: "string" },
              amount: { type: "string", description: "Amount in TON" },
              memo: { type: "string" },
            },
            required: ["address", "amount"],
          },
        },
      },
      required: ["recipients"],
    },
    execute: async (params) => {
      try {
        validateRecipients(sdk.ton, params.recipients);
        let total = 0;
        const messages = params.recipients.map((recipient, index) => {
          const amount = parsePositiveAmount(recipient.amount, `TON amount for recipient #${index + 1}`);
          total += amount;
          return { to: recipient.address, value: amount, body: recipient.memo, bounce: false };
        });
        const info = await sdk.ton.highload.getInfo();
        if (Number(info.balance) < total + 0.15) {
          throw new Error(`Insufficient Highload balance: ${info.balance} TON, need ~${total + 0.15} TON`);
        }
        const result = await sdk.ton.highload.sendMessages(messages, { valuePerBatch: 0.05 });
        sdk.log.info(`Highload TON batch sent to ${messages.length} recipients`);
        return {
          success: true,
          data: {
            recipient_count: messages.length,
            total_ton: total.toString(),
            multisend_address: result.address,
            query_id: result.nextQueryId,
            submitted_query_id: result.queryId,
          },
        };
      } catch (error) {
        return formatError(error);
      }
    },
  };

  const multisendBatchJetton = {
    name: "multisend_batch_jetton",
    description: "Send one jetton to up to 254 recipients in one Highload Wallet v3 batch.",
    category: "action",
    scope: "admin-only",
    parameters: {
      type: "object",
      properties: {
        jetton_master: { type: "string" },
        recipients: {
          type: "array",
          maxItems: MAX_RECIPIENTS,
          items: {
            type: "object",
            properties: {
              address: { type: "string" },
              amount: { type: "string", description: "Amount in human units" },
            },
            required: ["address", "amount"],
          },
        },
        decimals: { type: "integer", minimum: 0, maximum: 18 },
        forward_ton: { type: "string", description: "TON attached to each jetton transfer" },
      },
      required: ["jetton_master", "recipients"],
    },
    execute: async (params) => {
      try {
        validateRecipients(sdk.ton, params.recipients);
        if (!sdk.ton.validateAddress(params.jetton_master)) {
          throw new Error(`Invalid jetton master address: ${params.jetton_master}`);
        }
        const info = await sdk.ton.highload.getInfo();
        if (!info.deployed) {
          throw new Error("Highload wallet is not deployed. Fund it and send a TON batch first.");
        }
        const jettonWallet = await sdk.ton.getJettonWalletAddress(info.address, params.jetton_master);
        if (!jettonWallet) throw new Error("Could not resolve the Highload jetton wallet");

        const decimals = params.decimals ?? 9;
        const forwardTon = parsePositiveAmount(params.forward_ton ?? "0.05", "forward_ton");
        const gasNeeded = forwardTon * params.recipients.length + 0.1;
        if (Number(info.balance) < gasNeeded) {
          throw new Error(`Insufficient Highload TON for gas: ${info.balance} TON, need ~${gasNeeded} TON`);
        }
        const responseAddress = Address.parse(info.address);
        const queryBase = BigInt(Date.now()) * 1000n;
        const messages = params.recipients.map((recipient, index) => {
          const body = beginCell()
            .storeUint(0x0f8a7ea5, 32)
            .storeUint(queryBase + BigInt(index), 64)
            .storeCoins(toUnits(recipient.amount, decimals))
            .storeAddress(Address.parse(recipient.address))
            .storeAddress(responseAddress)
            .storeBit(false)
            .storeCoins(1n)
            .storeBit(false)
            .endCell();
          return { to: jettonWallet, value: forwardTon, body, bounce: true };
        });
        const result = await sdk.ton.highload.sendMessages(messages, { valuePerBatch: 0.05 });
        sdk.log.info(`Highload jetton batch sent to ${messages.length} recipients`);
        return {
          success: true,
          data: {
            recipient_count: messages.length,
            jetton_master: params.jetton_master,
            jetton_wallet: jettonWallet,
            multisend_address: result.address,
            decimals,
            query_id: result.nextQueryId,
            submitted_query_id: result.queryId,
          },
        };
      } catch (error) {
        return formatError(error);
      }
    },
  };

  const multisendStatus = {
    name: "multisend_status",
    description: "Check Highload wallet balance, deployment, timeout, cleanup, and subwallet state.",
    category: "data-bearing",
    scope: "always",
    parameters: { type: "object", properties: {}, required: [] },
    execute: async () => {
      try {
        const info = await sdk.ton.highload.getInfo();
        return {
          success: true,
          data: {
            address: info.address,
            address_raw: info.rawAddress,
            balance: info.balance,
            balance_nano: info.balanceNano,
            deployed: info.deployed,
            sequence: {
              current_query_id: info.currentQueryId,
              has_next: info.hasNext,
            },
            timeout: info.timeout,
            last_cleaned: info.lastCleaned,
            last_cleaned_date: info.lastCleaned
              ? new Date(info.lastCleaned * 1000).toISOString()
              : undefined,
            subwallet_id: info.subwalletId,
          },
        };
      } catch (error) {
        return formatError(error);
      }
    },
  };

  return [
    multisendInfo,
    multisendFund,
    multisendBatchTon,
    multisendBatchJetton,
    multisendStatus,
  ];
};
