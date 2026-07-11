<div align="center">

# teleton-plugins

[![SDK](https://img.shields.io/badge/SDK-v2-00C896.svg)](https://www.npmjs.com/package/@teleton-agent/sdk)
[![Marketplace](https://img.shields.io/badge/marketplace-12-8B5CF6.svg)](#sdk-v2-marketplace)
[![Catalog](https://img.shields.io/badge/catalog-26_plugins-E040FB.svg)](compatibility.json)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Official community plugin catalog for [Teleton Agent](https://github.com/TONresistor/teleton-agent).

</div>

## Compatibility policy

The catalog targets `@teleton-agent/sdk@2.0.0`. Only plugins marked `supported` in
[`compatibility.json`](compatibility.json) may appear in [`registry.json`](registry.json).

Legacy source remains available for migration and audit history, but quarantined plugins are not
offered through the WebUI marketplace. This prevents SDK v2 from installing plugins that depend on
removed raw Telegram access or direct wallet mnemonic access.

| Status | Plugins | Meaning |
|---|---:|---|
| SDK v2 supported | 14 | Loads against SDK v2; 12 marketplace plugins plus 2 examples |
| Quarantined | 12 | Preserved in source, rejected by SDK v2 and excluded from the marketplace |
| Total | 26 | 191 tools: 135 data tools and 56 actions |

## SDK v2 marketplace

| Plugin | Tools | Description |
|---|---:|---|
| [boards](plugins/boards/) | 9 | boards.ton forum with x402 TON payments |
| [casino](plugins/casino/) | 4 | Dice and slot games with verified TON payments |
| [crypto-prices](plugins/crypto-prices/) | 2 | CryptoCompare prices and comparisons |
| [dedust](plugins/dedust/) | 8 | DeDust market data, quotes and brokered swaps |
| [dyor](plugins/dyor/) | 11 | DYOR.io TON token analytics |
| [fragment](plugins/fragment/) | 6 | Fragment marketplace discovery |
| [geckoterminal](plugins/geckoterminal/) | 10 | TON DEX pools, trades and OHLCV data |
| [giftstat](plugins/giftstat/) | 11 | Telegram gift market data |
| [stonfi](plugins/stonfi/) | 8 | STON.fi market data, quotes and brokered swaps |
| [tonapi](plugins/tonapi/) | 20 | TON accounts, jettons, NFTs, DNS and staking data |
| [twitter](plugins/twitter/) | 24 | X/Twitter read and write operations using declared secrets |
| [weather](plugins/weather/) | 2 | Current weather and seven-day forecasts |

Development examples are available in [`plugins/example`](plugins/example/) and
[`plugins/example-sdk`](plugins/example-sdk/), but are intentionally not marketplace entries.

## Quarantined legacy plugins

| Plugins | Blocker |
|---|---|
| `pic`, `vid`, `deezer`, `voice-notes` | Depend on the removed `sdk.telegram.getRawClient()` API |
| `gaspump` | Depends on removed `context.bridge` and direct wallet signing |
| `evaa`, `giftindex`, `stormtrade`, `swapcoffee`, `webdom` | Read and sign with the wallet mnemonic directly |
| `multisend`, `sbt` | Require specialized signing or contract deployment capabilities |

These plugins declare `sdkVersion: "^1.0.0"`, so SDK v2 rejects them before registering tools.
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
npm run validate:runtime
npm run audit:plugins
```

Runtime validation imports all 26 plugins against the sibling `../teleton-agent` SDK checkout,
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
