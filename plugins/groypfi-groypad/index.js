// plugins/groypfi-groypad/index.js — Teleton SDK plugin for Groypad (Bonding Curve Launchpad on TON)
// Repository: https://github.com/TONresistor/teleton-plugins
//
// MemeFactory: EQAO4cYqithwdltzmrlal1L5JKLK5Xk76feAJq0VoBC6Fy8T
// Deploy opcode: 0x6ff416dc → MemeFactory
// Buy opcode:    0x742b36d8 → Meme (jetton master)
// Sell opcode:   0x595f07bc → MemeWallet (user jetton wallet)
// Claim fee:     0xad7269a8 → Meme (jetton master)
//
// Docs: https://groypfi.io/docs/groypad

import { createRequire } from "node:module";
import { realpathSync } from "node:fs";

const _require = createRequire(realpathSync(process.argv[1]));
const { beginCell, Address } = _require("@ton/core");

const MEME_FACTORY = "EQAO4cYqithwdltzmrlal1L5JKLK5Xk76feAJq0VoBC6Fy8T";
const SUPABASE_URL = "https://rcuesqclhdghrqrmwjlk.supabase.co";
const PRECISION = BigInt(1e9);

function integrateCurve(s1, s2, alpha, beta) {
  const dx = s2 - s1;
  if (dx <= 0n) return 0n;
  const term1 = (alpha * dx) / PRECISION;
  const term2 = (beta * dx * (s1 + s2)) / (2n * PRECISION * PRECISION);
  return term1 + term2;
}

function buyQuote(amountTon, currentSupply, alpha, beta) {
  const avgPrice = alpha + (beta * currentSupply) / PRECISION;
  if (avgPrice <= 0n) return 0n;
  let tokensOut = (amountTon * PRECISION) / avgPrice;

  for (let i = 0; i < 10; i++) {
    const cost = integrateCurve(
      currentSupply,
      currentSupply + tokensOut,
      alpha,
      beta
    );
    const diff = cost - amountTon;
    if (diff === 0n) break;
    const priceAtEnd = alpha + (beta * (currentSupply + tokensOut)) / PRECISION;
    if (priceAtEnd <= 0n) break;
    const adj = (diff * PRECISION) / priceAtEnd;
    tokensOut -= adj;
    if (tokensOut <= 0n) return 0n;
    if (adj > -2n && adj < 2n) break;
  }

  return tokensOut;
}

function sellQuote(tokenAmount, currentSupply, alpha, beta, tradeFeeBPS = 100) {
  if (tokenAmount <= 0n || tokenAmount > currentSupply) return 0n;
  const newSupply = currentSupply - tokenAmount;
  const rawTon = integrateCurve(newSupply, currentSupply, alpha, beta);
  return (rawTon * (10000n - BigInt(tradeFeeBPS))) / 10000n;
}

async function runGetMethod(address, method, stack, apiKey) {
  const url = "https://toncenter.com/api/v3/runGetMethod";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { "X-API-Key": apiKey } : {}),
    },
    body: JSON.stringify({ address, method, stack }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) throw new Error(`runGetMethod failed: ${res.status}`);
  return res.json();
}

export const manifest = {
  name: "groypfi-groypad",
  version: "1.2.0",
  sdkVersion: ">=1.0.0",
  description:
    "Deploy, trade, and manage tokens on Groypad — a bonding-curve memecoin launchpad on TON.",
  defaultConfig: {},
};

export const tools = (sdk) => [
  {
    name: "groypad_deploy",
    description:
      "Deploy a new memecoin on Groypad with metadata and an initial buy.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Token name (e.g. 'Pepe the Frog')" },
        ticker: { type: "string", description: "Token ticker/symbol, 2-10 chars" },
        description: { type: "string", description: "Token description (min 10 chars)" },
        initial_buy_ton: { type: "number", description: "TON for initial buy (minimum 10)" },
        image_url: { type: "string", description: "Public URL to token logo image" },
        website: { type: "string", description: "Project website URL" },
        telegram: { type: "string", description: "Telegram group/channel URL" },
        twitter: { type: "string", description: "X/Twitter profile URL" },
      },
      required: ["name", "ticker", "description", "initial_buy_ton", "image_url"],
    },
    scope: "dm-only",
    category: "action",
    async execute(params) {
      const {
        name,
        ticker,
        description,
        initial_buy_ton,
        image_url,
        website = "",
        telegram = "",
        twitter = "",
      } = params;

      if (initial_buy_ton < 10)
        return { success: false, error: "Minimum initial buy is 10 TON" };

      const metadata = {
        name,
        symbol: ticker,
        description,
        image: image_url,
        website,
        social: { telegram, twitter },
      };

      sdk.log.info(`Uploading metadata for ${ticker}...`);
      const metaFileName = `${Date.now()}_${ticker.toLowerCase()}.json`;
      const uploadRes = await fetch(`${SUPABASE_URL}/functions/v1/upload-token-asset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bucket: "token-metadata",
          fileName: metaFileName,
          content: JSON.stringify(metadata),
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!uploadRes.ok) return { success: false, error: "Metadata upload failed" };
      const { publicUrl: metadataUrl } = await uploadRes.json();

      const initialBuyNano = BigInt(Math.floor(initial_buy_ton * 1e9));
      const gasAmount = 500000000n;
      const metaCell = beginCell().storeStringTail(metadataUrl).endCell();
      const body = beginCell()
        .storeUint(0x6ff416dc, 32)
        .storeUint(0, 64)
        .storeUint(0, 4)
        .storeRef(metaCell)
        .storeCoins(initialBuyNano)
        .storeBit(false)
        .storeBit(false)
        .endCell();

      const totalTon = Number(gasAmount + initialBuyNano) / 1e9;
      const result = await sdk.ton.sendTON(
        MEME_FACTORY,
        totalTon,
        body.toBoc().toString("base64")
      );

      return {
        success: true,
        data: {
          txRef: result?.txRef,
          ticker,
          name,
          initialBuy: initial_buy_ton + " TON",
          metadataUrl,
        },
      };
    },
  },
  {
    name: "groypad_list_tokens",
    description:
      "List active Groypad tokens with market cap, progress, volume, and holders.",
    parameters: { type: "object", properties: {} },
    category: "data-bearing",
    async execute() {
      const apiKey = sdk.secrets.get("SUPABASE_ANON_KEY");
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/launchpad_tokens?is_graduated=eq.false&order=market_cap.desc.nullslast&limit=50`,
        {
          headers: {
            apikey: apiKey ?? "",
            Authorization: `Bearer ${apiKey ?? ""}`,
          },
          signal: AbortSignal.timeout(15000),
        }
      );
      const tokens = await res.json();
      return {
        success: true,
        data: tokens.map((t) => ({
          ticker: t.ticker,
          name: t.name,
          address: t.meme_address,
          marketCap: (t.market_cap?.toFixed(2) ?? "0") + " TON",
          progress: (t.progress ?? 0).toFixed(1) + "%",
          volume24h: (t.volume_24h?.toFixed(2) ?? "0") + " TON",
          holders: t.holders ?? 0,
        })),
      };
    },
  },
  {
    name: "groypad_token_info",
    description:
      "Get on-chain bonding curve data: price, progress, supply, raised funds.",
    parameters: {
      type: "object",
      properties: {
        address: {
          type: "string",
          description: "Meme contract address (EQ... or UQ...)",
        },
      },
      required: ["address"],
    },
    category: "data-bearing",
    async execute(params) {
      const toncenterKey = sdk.secrets.get("TONCENTER_API_KEY");
      const result = await runGetMethod(
        params.address,
        "get_meme_data",
        [],
        toncenterKey
      );
      const stack = result.stack;
      const alpha = BigInt(stack[7].value ?? stack[7]);
      const beta = BigInt(stack[8].value ?? stack[8]);
      const raisedFunds = BigInt(stack[11].value ?? stack[11]);
      const currentSupply = BigInt(stack[12].value ?? stack[12]);
      const price = Number(alpha + (beta * currentSupply) / PRECISION) / 1e9;
      const progress = Math.min(
        100,
        Number((raisedFunds * 10000n) / (1050n * PRECISION)) / 100
      );

      return {
        success: true,
        data: {
          price,
          progress: progress.toFixed(1) + "%",
          raisedFunds: (Number(raisedFunds) / 1e9).toFixed(4) + " TON",
          currentSupply: currentSupply.toString(),
          isGraduated: (stack[6].value ?? stack[6]) !== "0",
        },
      };
    },
  },
  {
    name: "groypad_get_quote",
    description: "Preview buy/sell quote without executing a trade.",
    parameters: {
      type: "object",
      properties: {
        address: { type: "string", description: "Meme contract address" },
        side: { type: "string", description: "'buy' or 'sell'" },
        amount: {
          type: "number",
          description:
            "For buy: TON to spend. For sell: token amount (human-readable)",
        },
      },
      required: ["address", "side", "amount"],
    },
    category: "data-bearing",
    async execute(params) {
      const { address, side, amount } = params;
      const toncenterKey = sdk.secrets.get("TONCENTER_API_KEY");
      const result = await runGetMethod(address, "get_meme_data", [], toncenterKey);
      const stack = result.stack;
      const alpha = BigInt(stack[7].value ?? stack[7]);
      const beta = BigInt(stack[8].value ?? stack[8]);
      const tradeFeeBPS = Number(stack[10].value ?? stack[10]);
      const supply = BigInt(stack[12].value ?? stack[12]);
      const currentPrice = Number(alpha + (beta * supply) / PRECISION) / 1e9;

      if (side === "buy") {
        const amountNano = BigInt(Math.floor(amount * 1e9));
        const tokensOut = buyQuote(amountNano, supply, alpha, beta);
        const priceAfter =
          Number(alpha + (beta * (supply + tokensOut)) / PRECISION) / 1e9;
        const priceImpact =
          currentPrice > 0
            ? (((priceAfter - currentPrice) / currentPrice) * 100).toFixed(2)
            : "0";

        return {
          success: true,
          data: {
            side: "buy",
            inputTon: amount,
            estimatedTokensOut: (Number(tokensOut) / 1e9).toFixed(4),
            currentPrice: currentPrice.toFixed(9) + " TON",
            priceAfter: priceAfter.toFixed(9) + " TON",
            priceImpact: priceImpact + "%",
          },
        };
      }

      const tokenNano = BigInt(Math.floor(amount * 1e9));
      const tonOut = sellQuote(tokenNano, supply, alpha, beta, tradeFeeBPS);
      return {
        success: true,
        data: {
          side: "sell",
          inputTokens: amount,
          estimatedTonOut: (Number(tonOut) / 1e9).toFixed(4) + " TON",
          tradeFee: tradeFeeBPS / 100 + "%",
        },
      };
    },
  },
  {
    name: "groypad_buy",
    description: "Buy tokens on the Groypad bonding curve.",
    parameters: {
      type: "object",
      properties: {
        address: { type: "string", description: "Meme contract address" },
        amount_ton: { type: "number", description: "TON to spend" },
        slippage: { type: "number", description: "Slippage % (default 5)" },
      },
      required: ["address", "amount_ton"],
    },
    scope: "dm-only",
    category: "action",
    async execute(params) {
      const { address, amount_ton, slippage = 5 } = params;
      const toncenterKey = sdk.secrets.get("TONCENTER_API_KEY");
      const result = await runGetMethod(address, "get_meme_data", [], toncenterKey);
      const stack = result.stack;
      const alpha = BigInt(stack[7].value ?? stack[7]);
      const beta = BigInt(stack[8].value ?? stack[8]);
      const supply = BigInt(stack[12].value ?? stack[12]);
      const amountNano = BigInt(Math.floor(amount_ton * 1e9));
      const tokensOut = buyQuote(amountNano, supply, alpha, beta);
      const minOut = (tokensOut * BigInt(100 - slippage)) / 100n;

      const body = beginCell()
        .storeUint(0x742b36d8, 32)
        .storeUint(0, 64)
        .storeCoins(minOut)
        .endCell();
      const txResult = await sdk.ton.sendTON(
        address,
        amount_ton + 0.3,
        body.toBoc().toString("base64")
      );

      return {
        success: true,
        data: {
          txRef: txResult?.txRef,
          estimatedTokens: (Number(tokensOut) / 1e9).toFixed(2),
        },
      };
    },
  },
  {
    name: "groypad_sell",
    description: "Sell tokens back to the bonding curve.",
    parameters: {
      type: "object",
      properties: {
        address: {
          type: "string",
          description: "Meme contract address (jetton master)",
        },
        amount: {
          type: "string",
          description: "Nano-token amount as string, or 'all' for full balance",
        },
      },
      required: ["address", "amount"],
    },
    scope: "dm-only",
    category: "action",
    async execute(params) {
      const { address, amount } = params;
      const toncenterKey = sdk.secrets.get("TONCENTER_API_KEY");
      const walletAddr = sdk.ton.getAddress();
      if (!walletAddr) return { success: false, error: "Wallet not initialized" };

      const walletResult = await runGetMethod(
        address,
        "get_wallet_address",
        [{ type: "slice", value: walletAddr }],
        toncenterKey
      );
      const memeWallet = walletResult.stack[0].value ?? walletResult.stack[0];

      const balResult = await runGetMethod(
        memeWallet,
        "get_wallet_data",
        [],
        toncenterKey
      );
      const actualBalance = BigInt(balResult.stack[0].value ?? balResult.stack[0]);
      let sellAmount = amount === "all" ? actualBalance : BigInt(amount);
      if (sellAmount > actualBalance) sellAmount = actualBalance;
      if (sellAmount <= 0n) return { success: false, error: "Zero balance" };

      const body = beginCell()
        .storeUint(0x595f07bc, 32)
        .storeUint(0, 64)
        .storeCoins(sellAmount)
        .storeAddress(Address.parse(walletAddr))
        .storeBit(false)
        .endCell();
      const txResult = await sdk.ton.sendTON(
        memeWallet,
        0.3,
        body.toBoc().toString("base64")
      );

      return {
        success: true,
        data: {
          txRef: txResult?.txRef,
          sold: (Number(sellAmount) / 1e9).toFixed(2) + " tokens",
        },
      };
    },
  },
  {
    name: "groypad_claim_fee",
    description: "Claim accumulated creator trading fees from a token you deployed.",
    parameters: {
      type: "object",
      properties: {
        address: { type: "string", description: "Meme contract address" },
      },
      required: ["address"],
    },
    scope: "dm-only",
    category: "action",
    async execute(params) {
      const { address } = params;
      const toncenterKey = sdk.secrets.get("TONCENTER_API_KEY");
      const walletAddr = sdk.ton.getAddress();
      if (!walletAddr) return { success: false, error: "Wallet not initialized" };

      const result = await runGetMethod(address, "get_meme_data", [], toncenterKey);
      const creatorFee = BigInt(result.stack[4].value ?? result.stack[4]);
      if (creatorFee <= 0n) return { success: false, error: "No fees to claim" };

      const body = beginCell()
        .storeUint(0xad7269a8, 32)
        .storeUint(0, 64)
        .storeAddress(Address.parse(walletAddr))
        .storeAddress(Address.parse(walletAddr))
        .endCell();
      const txResult = await sdk.ton.sendTON(
        address,
        0.3,
        body.toBoc().toString("base64")
      );

      return {
        success: true,
        data: {
          txRef: txResult?.txRef,
          claimed: (Number(creatorFee) / 1e9).toFixed(4) + " TON",
        },
      };
    },
  },
];
