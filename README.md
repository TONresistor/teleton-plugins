<div align="center">

# teleton-plugins

[![GitHub stars](https://img.shields.io/github/stars/TONresistor/teleton-plugins?style=flat&logo=github)](https://github.com/TONresistor/teleton-plugins/stargazers)
[![Plugins](https://img.shields.io/badge/plugins-25-8B5CF6.svg)](#available-plugins)
[![Tools](https://img.shields.io/badge/tools-183-E040FB.svg)](#available-plugins)
[![SDK](https://img.shields.io/badge/SDK-v1.0.0-00C896.svg)](#plugin-sdk)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![SKILL.md](https://img.shields.io/badge/SKILL.md-AI%20prompt-F97316.svg)](https://github.com/TONresistor/teleton-plugins/blob/main/SKILL.md)
[![Telegram](https://img.shields.io/badge/Telegram-community-26A5E4.svg?logo=telegram)](https://t.me/ResistanceForum)

Community plugin directory for [Teleton](https://github.com/TONresistor/teleton-agent), the Telegram AI agent on TON.<br>
Drop a plugin in `~/.teleton/plugins/` and it's live. No build step, no config.

</div>

---

<details>
<summary><strong>Table of Contents</strong></summary>

- [How It Works](#how-it-works)
- [Quick Start](#quick-start)
- [Available Plugins](#available-plugins)
- [Build Your Own](#build-your-own)
- [Plugin SDK](#plugin-sdk)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)
- [Community](#community)
- [Contributors](#contributors)
- [License](#license)

</details>

## How It Works

```
User message
  → LLM reads tool descriptions
  → picks and calls a tool
  → execute(params, context) runs
  → result JSON → LLM
  → LLM responds to user
```

Teleton loads every folder from `~/.teleton/plugins/` at startup. Each plugin exports a `tools` array (or a function that receives the [Plugin SDK](#plugin-sdk)). The `execute` function receives the LLM's parameters and a `context` with Telegram bridge access. The returned `data` object is serialized to JSON and fed back to the LLM.

**Plugin lifecycle:** `manifest.json` is read first, then `migrate(db)` runs if exported (for database setup), then `tools` are registered, `start(ctx)` is called if exported, and `stop()` on shutdown.

## Quick Start

```bash
# 1. Create the plugins directory
mkdir -p ~/.teleton/plugins

# 2. Clone and copy any plugin
git clone https://github.com/TONresistor/teleton-plugins.git
cp -r teleton-plugins/plugins/example ~/.teleton/plugins/

# 3. Restart Teleton — the plugin loads automatically
```

### GroypFi Perps & Groypad Integration (MCP)

See [docs/groypfi-mcp.md](docs/groypfi-mcp.md) for full setup instructions.
AI agents can now trade perpetuals and launch tokens on Groypad via the official GroypFi MCP server.

No build step. Just copy and go. Plugins with npm dependencies are auto-installed at startup.

## Available Plugins

> **25 plugins** · **183 tools** · [Browse the registry](registry.json)

### DeFi & Trading

| Plugin | Description | Tools | Author |
|--------|-------------|:-----:|--------|
| [gaspump](plugins/gaspump/) | Launch, trade, and manage meme tokens on Gas111/TON | 13 | teleton |
| [stormtrade](plugins/stormtrade/) | Perpetual futures — crypto, stocks, forex, commodities | 13 | teleton |
| [evaa](plugins/evaa/) | EVAA Protocol — supply, borrow, withdraw, repay, liquidate | 11 | teleton |
| [stonfi](plugins/stonfi/) | StonFi DEX — tokens, pools, farms, swap | 8 | teleton |
| [dedust](plugins/dedust/) | DeDust DEX — pools, assets, trades, on-chain swaps | 8 | teleton |
| [swapcoffee](plugins/swapcoffee/) | swap.coffee aggregator — best rates across all DEXes | 6 | teleton |
| [giftindex](plugins/giftindex/) | GiftIndex ODROB — trade Telegram Gifts index on TON | 6 | teleton |

### Market Data & Analytics

| Plugin | Description | Tools | Author |
|--------|-------------|:-----:|--------|
| [tonapi](plugins/tonapi/) | TON blockchain data — accounts, jettons, NFTs, DNS, staking | 20 | teleton |
| [giftstat](plugins/giftstat/) | Telegram gift market data from Giftstat API | 11 | teleton |
| [dyor](plugins/dyor/) | DYOR.io — trust score, price, metrics, holders, pools | 11 | teleton |
| [geckoterminal](plugins/geckoterminal/) | TON DEX pools — trending, OHLCV, batch prices | 10 | teleton |
| [crypto-prices](plugins/crypto-prices/) | Real-time prices for 5000+ coins | 2 | walged |

### Social & Messaging

| Plugin | Description | Tools | Author |
|--------|-------------|:-----:|--------|
| [twitter](plugins/twitter/) | X/Twitter API v2 — search, post, like, retweet, follow | 24 | teleton |
| [pic](plugins/pic/) | Image search via @pic inline bot | 1 | teleton |
| [vid](plugins/vid/) | YouTube search via @vid inline bot | 1 | teleton |
| [deezer](plugins/deezer/) | Music search via @DeezerMusicBot | 1 | teleton |
| [voice-notes](plugins/voice-notes/) | Transcribe voice messages (Premium STT) | 1 | walged |

### TON Infrastructure

| Plugin | Description | Tools | Author |
|--------|-------------|:-----:|--------|
| [multisend](plugins/multisend/) | Batch send TON/jettons to 254 recipients in one TX | 5 | teleton |
| [sbt](plugins/sbt/) | Deploy and mint Soulbound Tokens (TEP-85) | 2 | teleton |

### Marketplace & NFTs

| Plugin | Description | Tools | Author |
|--------|-------------|:-----:|--------|
| [fragment](plugins/fragment/) | Fragment marketplace — usernames, numbers, collectible gifts | 6 | teleton |
| [webdom](plugins/webdom/) | TON domain marketplace — search, buy, sell, auction, DNS bid | 12 | teleton |

### Utilities & Games

| Plugin | Description | Tools | Author |
|--------|-------------|:-----:|--------|
| [casino](plugins/casino/) | Slot machine and dice games with TON payments and auto-payout | 4 | teleton |
| [example](plugins/example/) | Dice roller and random picker | 2 | teleton |
| [example-sdk](plugins/example-sdk/) | SDK example — greeting counter, balance check, announcements | 3 | teleton |
| [weather](plugins/weather/) | Weather and 7-day forecast via Open-Meteo | 2 | walged |

## Build Your Own

Three files. No build step. No npm install.

```
plugins/your-plugin/
  index.js         # exports tools[] or tools(sdk)
  manifest.json    # plugin metadata
  README.md        # documentation
```

**Pattern A** — Simple plugin (no SDK needed):

```js
// index.js
export const tools = [
  {
    name: "hello",
    description: "Say hello to someone",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Who to greet" },
      },
      required: ["name"],
    },
    execute: async (params) => ({
      success: true,
      data: { message: `Hello, ${params.name}!` },
    }),
  },
];
```

**Pattern B** — Plugin with SDK (TON, Telegram, database):

```js
// index.js
export const tools = (sdk) => [
  {
    name: "check_balance",
    description: "Check TON wallet balance",
    execute: async (params, context) => {
      const balance = await sdk.ton.getBalance();
      sdk.log.info(`Balance: ${balance?.balance}`);
      return { success: true, data: { balance: balance?.balance } };
    }
  }
];
```

> See [`plugins/example/`](plugins/example/) for Pattern A and [`plugins/example-sdk/`](plugins/example-sdk/) for Pattern B.

**Declaring secrets:**

If your plugin needs API keys, declare them in `manifest.json` with the exact environment variable name:

```json
"secrets": {
  "api_key": { "env": "MYPLUGIN_API_KEY", "required": true, "description": "API key for MyService" },
  "webhook_secret": { "env": "MYPLUGIN_WEBHOOK_SECRET", "required": false, "description": "Optional webhook signing secret" }
}
```

Users can then configure secrets via:
- **Environment variable**: `MYPLUGIN_API_KEY=sk-xxx` (Docker, CI)
- **WebUI**: Plugins → Manage Secrets (auto-prompted on install)
- **Telegram**: `/plugin set myplugin api_key sk-xxx`

In your plugin code: `sdk.secrets.require("api_key")` or `sdk.secrets.get("api_key")`.

**Submission checklist:**

- [ ] Three files: `index.js`, `manifest.json`, `README.md`
- [ ] `manifest.json` has all required fields (`id`, `name`, `description`, `version`, `author`)
- [ ] Tool names are prefixed with the plugin name (e.g. `myplugin_action`)
- [ ] `sdkVersion` declared in manifest if using the SDK
- [ ] Secrets declared with `env` field if the plugin needs API keys
- [ ] Tested locally (see below)
- [ ] Added to `registry.json`

**Test locally:**

```bash
# Verify your plugin loads without errors
node -e "import('./plugins/your-plugin/index.js').then(m => console.log('OK:', typeof m.tools === 'function' ? m.tools.length + ' (sdk)' : m.tools.length + ' tools'))"

# Or copy to Teleton and restart
cp -r plugins/your-plugin ~/.teleton/plugins/
```

**Submit your plugin:**

1. Fork this repo
2. Create `plugins/your-plugin/` with the three files above
3. Add your plugin to `registry.json`
4. Open a PR

Full guide — manifest format, context API, best practices: **[CONTRIBUTING.md](CONTRIBUTING.md)**

## Plugin SDK

The SDK gives your plugin access to TON, Telegram, secrets, storage, and more — without touching any internals.

| Namespace | What it does |
|-----------|-------------|
| `sdk.ton` | Wallet balance, send TON/jettons, NFTs, transactions, payment verification, utilities |
| `sdk.telegram` | Messages, media (photo/video/voice/file/gif/sticker), polls, moderation, gifts, stories, raw GramJS |
| `sdk.secrets` | 3-tier secret resolution (ENV → secrets store → pluginConfig) — `get()`, `require()`, `has()` |
| `sdk.storage` | Key-value store with TTL — no `migrate()` needed |
| `sdk.db` | Isolated SQLite database per plugin (requires `migrate()` export) |
| `sdk.log` | Prefixed logger (`info`, `warn`, `error`, `debug`) |
| `sdk.config` | Sanitized app config (no secrets) |
| `sdk.pluginConfig` | Plugin-specific config with defaults from manifest |

```js
// Send TON, verify payments, send Telegram messages — all through the SDK
await sdk.ton.sendTON("EQx...", 1.5, "payment for order #42");
const payment = await sdk.ton.verifyPayment({ amount: 1.5, memo: "order-42" });
await sdk.telegram.sendMessage(chatId, "Payment received!");

// New: secrets, storage, media, jettons
const apiKey = await sdk.secrets.require("api_key");
await sdk.storage.set("last_run", Date.now(), 3600);
await sdk.telegram.sendPhoto(chatId, buffer, { caption: "Done!" });
await sdk.ton.sendJetton(jettonMaster, to, amount);
```

Full SDK reference: **[CONTRIBUTING.md — Plugin SDK](CONTRIBUTING.md#plugin-sdk)**

## Troubleshooting

**Plugin not loading?**

- Check that `manifest.json` exists and has valid JSON
- Verify the plugin exports `tools` (array or function): `node -e "import('./plugins/name/index.js').then(m => console.log(m.tools))"`
- Look for errors in the Teleton console output at startup
- Make sure the plugin folder name matches the `id` in `manifest.json`

**Common errors:**

| Error | Cause | Fix |
|-------|-------|-----|
| `Cannot find module` | Missing dependency | Add a `package.json` — deps are auto-installed at startup |
| `tools is not iterable` | `tools` export is not an array or function | Check your export: `export const tools = [...]` or `export const tools = (sdk) => [...]` |
| `Plugin name collision` | Two plugins share the same `id` | Rename one of the plugins in its `manifest.json` |
| `SDK not available` | Using `sdk.*` without the SDK pattern | Switch to Pattern B: `export const tools = (sdk) => [...]` |

## FAQ

**Can I use npm packages?**
Yes. Add a `package.json` (and `package-lock.json`) to your plugin folder. Teleton auto-installs dependencies at startup.

**How do I store data?**
Use `sdk.db` for SQL (requires exporting a `migrate(db)` function) or `sdk.storage` for simple key-value pairs with optional TTL.

**How do I access TON or Telegram?**
Use the SDK (Pattern B): `export const tools = (sdk) => [...]`. Then call `sdk.ton.*` for wallet/blockchain operations and `sdk.telegram.*` for messaging.

**How do I manage API keys?**
Declare them in `manifest.json` with the `env` field so users know exactly what to set. In your code, use `sdk.secrets.require("key_name")`. Secrets resolve in order: environment variable → secrets store (`/plugin set`) → `pluginConfig` (config.yaml).

**Why is my plugin not showing tools?**
Make sure your `tools` export is either an array of tool objects or a function that returns one. Each tool needs at least `name`, `description`, and `execute`.

## Community

- **[Telegram Group](https://t.me/ResistanceForum)**: questions, plugin ideas, support
- **[GitHub Issues](https://github.com/TONresistor/teleton-plugins/issues)**: bug reports, feature requests
- **[Contributing Guide](CONTRIBUTING.md)**: how to build and submit plugins

## Contributors

This project exists thanks to everyone who contributes.

<a href="https://github.com/TONresistor/teleton-plugins/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=TONresistor/teleton-plugins&max=100&columns=12" />
</a>

Want to see your name here? Check out the [Contributing Guide](CONTRIBUTING.md).

## License

[MIT](LICENSE) — use it, fork it, build on it.

---

<div align="center">

**[teleton-plugins](https://github.com/TONresistor/teleton-plugins)** — open source plugins for the TON ecosystem

[Report Bug](https://github.com/TONresistor/teleton-plugins/issues) · [Request Plugin](https://github.com/TONresistor/teleton-plugins/issues/new) · [Contributing Guide](CONTRIBUTING.md)

</div>
