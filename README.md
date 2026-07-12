<div align="center">

# teleton-plugins

<!-- teleton-catalog:badges:start -->
[![SDK](https://img.shields.io/badge/SDK-v2-00C896.svg)](https://www.npmjs.com/package/@teleton-agent/sdk)
[![Marketplace](https://img.shields.io/badge/marketplace-22-8B5CF6.svg)](#sdk-v2-marketplace)
[![Catalog](https://img.shields.io/badge/catalog-26_plugins-E040FB.svg)](compatibility.json)
<!-- teleton-catalog:badges:end -->
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Official community plugin catalog for [Teleton Agent](https://github.com/TONresistor/teleton-agent).

</div>

## Compatibility policy

The target SDK version and plugin status are declared once in
[`compatibility.json`](compatibility.json). Only supported marketplace plugins are generated into
[`registry.json`](registry.json).

Legacy source remains available for migration and audit history, but quarantined plugins are not
offered through the WebUI marketplace. This prevents SDK v2 from installing plugins that depend on
removed raw Telegram access or direct wallet mnemonic access.

<!-- teleton-catalog:summary:start -->
| Status | Plugins | Meaning |
|---|---:|---|
| SDK v2 supported | 24 | Loads against SDK v2; 22 marketplace plugins plus 2 examples |
| Quarantined | 2 | Preserved in source, rejected by SDK v2 and excluded from the marketplace |
| Total | 26 | 193 tools |
<!-- teleton-catalog:summary:end -->

<!-- teleton-catalog:marketplace:start -->
## SDK v2 marketplace

| Plugin | Tools | Description |
|---|---:|---|
| [boards](plugins/boards/) | 9 | Browse and participate in the boards.ton decentralized forum using x402 TON micropayments |
| [casino](plugins/casino/) | 4 | Slot machine and dice games with TON payments and auto-payout |
| [crypto-prices](plugins/crypto-prices/) | 2 | Real-time cryptocurrency prices and comparison via CryptoCompare API |
| [dedust](plugins/dedust/) | 8 | Swap tokens, browse pools, and trade on DeDust -- TON's #2 DEX |
| [deezer](plugins/deezer/) | 1 | Search and send music tracks via Telegram's @DeezerMusicBot inline bot (Deezer) |
| [dyor](plugins/dyor/) | 11 | TON token analytics from DYOR.io -- search, price, trust score, metrics, DEX trades, holders, pools |
| [fragment](plugins/fragment/) | 6 | Search and browse Telegram's NFT marketplace — usernames, numbers, collectible gifts, auction history |
| [geckoterminal](plugins/geckoterminal/) | 10 | TON DEX pool and token data -- trending, new, and top pools, trades, OHLCV, token info, batch prices |
| [giftindex](plugins/giftindex/) | 6 | GiftIndex ODROB trading with workflow guardrails - monitor, analyze and trade the Telegram Gifts index on TON. Owner-only, corridor-enforced, post-trade verified. |
| [giftstat](plugins/giftstat/) | 11 | Telegram gift market data -- collections, floor prices, models, stats, history |
| [multisend](plugins/multisend/) | 5 | Batch send TON and jettons to up to 254 recipients through Teleton's protected Highload Wallet v3 broker |
| [pic](plugins/pic/) | 1 | Search and send images via Telegram's @pic inline bot (Yandex Image Search) |
| [sbt](plugins/sbt/) | 2 | Deploy and mint Soulbound Tokens (TEP-85) on TON |
| [stonfi](plugins/stonfi/) | 8 | Swap tokens, browse pools, and farm on StonFi DEX -- the largest DEX on TON |
| [stormtrade](plugins/stormtrade/) | 13 | Trade perpetual futures on Storm Trade DEX — crypto, stocks, forex, commodities |
| [swapcoffee](plugins/swapcoffee/) | 6 | Swap tokens on TON via swap.coffee aggregator - best rates across all DEXes |
| [tonapi](plugins/tonapi/) | 20 | TON blockchain data from TONAPI -- accounts, jettons, NFTs, prices, transactions, traces, DNS, staking |
| [twitter](plugins/twitter/) | 24 | X/Twitter API v2 — read (search, lookup, trends) + write (post, like, retweet, follow) with OAuth 1.0a |
| [uranus](plugins/uranus/) | 13 | Inspect, quote, trade and launch Uranus Meme tokens on TON through the protected Teleton SDK transaction broker. |
| [vid](plugins/vid/) | 1 | Search and send YouTube videos via Telegram's @vid inline bot |
| [weather](plugins/weather/) | 2 | Current weather and 7-day forecast via Open-Meteo API |
| [webdom](plugins/webdom/) | 11 | Buy, sell, auction, and manage .ton domains and Telegram usernames on webdom.market |
<!-- teleton-catalog:marketplace:end -->

Development examples are available in [`plugins/example`](plugins/example/) and
[`plugins/example-sdk`](plugins/example-sdk/), but are intentionally not marketplace entries.

## Quarantined legacy plugins

<!-- teleton-catalog:quarantine:start -->
| Plugin | Blocker |
|---|---|
| `gaspump` | Legacy SDK v1 plugin retained for older Teleton agents; raw bridge and wallet access are incompatible with SDK v2. |
| `voice-notes` | Legacy SDK v1 plugin retained for older Teleton agents; raw Telegram client access is incompatible with SDK v2. |
<!-- teleton-catalog:quarantine:end -->

Plugins listed in this section declare an incompatible SDK range, so the runtime rejects them before registering tools.
They return to the marketplace only after migration to public SDK capabilities.

## Install

Use the Teleton WebUI marketplace for supported plugins:

```bash
teleton start --webui
```

For local development, copy a supported plugin into the agent data directory and restart Teleton:

```bash
cp -R plugins/weather ~/.teleton/plugins/
teleton start
```

Do not manually install quarantined plugins into an SDK v2 runtime.

## Build a plugin

A plugin is an ESM directory with three required files:

```text
plugins/my-plugin/
├── index.js
├── manifest.json
└── README.md
```

Use a static `tools` array for pure local logic or external API reads. Use `tools(sdk)` when the
plugin needs public TON, Telegram, storage, secrets or logging capabilities.

```js
export const manifest = {
  name: "my-plugin",
  version: "1.0.0",
  sdkVersion: "^2.0.0",
  description: "Example SDK v2 plugin",
};

export const tools = (sdk) => [
  {
    name: "my_plugin_balance",
    description: "Read the configured TON wallet balance",
    scope: "admin-only",
    category: "data-bearing",
    parameters: { type: "object", properties: {} },
    async execute() {
      const balance = await sdk.ton.getBalance();
      return { success: true, data: balance };
    },
  },
];
```

The following are forbidden in SDK v2 plugins:

- `sdk.telegram.getRawClient()`;
- `context.bridge` or `ctx.bridge`;
- reading `wallet.json` or a mnemonic;
- undeclared secrets or environment-variable scraping;
- dependencies without a committed lockfile.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the complete contribution contract and the
[SDK README](https://github.com/TONresistor/teleton-agent/blob/dev/packages/sdk/README.md) for the
public API.

## Validate the complete catalog

Node `22.22.2`, `24.15.0`, or a supported newer release is required.

```bash
npm ci --ignore-scripts
npm run install:plugins
npm run validate
npm test
npm --prefix ../teleton-agent run build:sdk
npm run validate:runtime
npm run audit:plugins
```

Runtime validation imports every plugin against the sibling `../teleton-agent` SDK checkout,
compares runtime tools with manifests, and rejects duplicate or malformed tools. CI runs the same
checks on Node 22 and Node 24.

## Security model

- Plugins receive sanitized configuration and an isolated database.
- Secrets must be declared and accessed through `sdk.secrets`.
- Marketplace actions are treated as external actions by Teleton and require explicit approval.
- SDK v2 capability boundaries are mandatory; manifest permissions cannot restore removed raw APIs.
- npm lifecycle scripts are disabled when plugin dependencies are installed.
- HIGH and CRITICAL dependency vulnerabilities fail CI.

## License

[MIT](LICENSE)
