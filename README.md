<div align="center">

# teleton-plugins

[![GitHub stars](https://img.shields.io/github/stars/TONresistor/teleton-plugins?style=flat&logo=github)](https://github.com/TONresistor/teleton-plugins/stargazers)
[![Plugins](https://img.shields.io/badge/plugins-22-8B5CF6.svg)](#-available-plugins)
[![Tools](https://img.shields.io/badge/tools-164-E040FB.svg)](#-available-plugins)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
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
  - [DeFi & Trading](#defi--trading)
  - [Market Data & Analytics](#market-data--analytics)
  - [Telegram & Social](#telegram--social)
  - [TON Infrastructure](#ton-infrastructure)
  - [Utilities](#utilities)
- [Create a Plugin](#create-a-plugin)
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

Teleton loads every folder from `~/.teleton/plugins/` at startup. Each plugin exports a `tools` array. The `execute` function receives the LLM's parameters and an optional `context` with Telegram bridge access. The returned `data` object is serialized to JSON and fed back to the LLM.

## Quick Start

```bash
# 1. Create the plugins directory
mkdir -p ~/.teleton/plugins

# 2. Clone and copy any plugin
git clone https://github.com/TONresistor/teleton-plugins.git
cp -r teleton-plugins/plugins/example ~/.teleton/plugins/

# 3. Restart Teleton — the plugin loads automatically
```

No build step. No npm install. Just copy and go.

## Available Plugins

> **22 plugins** · **164 tools** · [Browse the registry](registry.json)

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

### Telegram & Social

| Plugin | Description | Tools | Author |
|--------|-------------|:-----:|--------|
| [twitter](plugins/twitter/) | X/Twitter API v2 — search, post, like, retweet, follow | 24 | teleton |
| [fragment](plugins/fragment/) | Fragment marketplace — usernames, numbers, collectible gifts | 6 | teleton |
| [pic](plugins/pic/) | Image search via @pic inline bot | 1 | teleton |
| [vid](plugins/vid/) | YouTube search via @vid inline bot | 1 | teleton |
| [deezer](plugins/deezer/) | Music search via @DeezerMusicBot | 1 | teleton |
| [voice-notes](plugins/voice-notes/) | Transcribe voice messages (Premium STT) | 1 | walged |

### TON Infrastructure

| Plugin | Description | Tools | Author |
|--------|-------------|:-----:|--------|
| [multisend](plugins/multisend/) | Batch send TON/jettons to 254 recipients in one TX | 5 | teleton |
| [sbt](plugins/sbt/) | Deploy and mint Soulbound Tokens (TEP-85) | 2 | teleton |

### Utilities

| Plugin | Description | Tools | Author |
|--------|-------------|:-----:|--------|
| [example](plugins/example/) | Dice roller and random picker | 2 | teleton |
| [weather](plugins/weather/) | Weather and 7-day forecast via Open-Meteo | 2 | walged |

## Create a Plugin

Every plugin is a folder with three files:

```
plugins/your-plugin/
  index.js         # exports tools[]
  manifest.json    # plugin metadata
  README.md        # documentation
```

```js
// index.js — minimal plugin
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

1. Fork this repo
2. Create `plugins/your-plugin/` with the three files above
3. Add your plugin to `registry.json`
4. Open a PR

See **[CONTRIBUTING.md](CONTRIBUTING.md)** for the full guide — manifest format, context API, bridge access, wallet signing, and best practices.

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
