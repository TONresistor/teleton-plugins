<div align="center">

# teleton-plugins

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/TONresistor/teleton-plugins/pulls)
[![ESM only](https://img.shields.io/badge/ESM-only-yellow.svg)](#)
[![Telegram](https://img.shields.io/badge/Telegram-bot-26A5E4.svg?logo=telegram)](https://t.me/teloton_bot)

Community plugin directory for [Teleton](https://github.com/TONresistor/tonnet-ai) -- the Telegram AI agent on TON.<br>Drop a plugin in `~/.teleton/plugins/` and it's live. No build step, no config.

</div>

## Table of Contents

- [How it works](#how-it-works)
- [Available Plugins](#available-plugins)
- [Quick Start](#quick-start)
- [Create a plugin](#create-a-plugin)
- [Verify it works](#verify-it-works)
- [Contributors](#contributors)
- [License](#license)

## How it works

```
User message -> LLM reads your tool's description
  -> LLM decides to call it -> execute(params, context) runs
  -> result sent back to LLM -> LLM responds to user
```

Teleton loads every `.js` file (or `folder/index.js`) from `~/.teleton/plugins/` at startup. Each plugin exports a `tools` array. The `execute` function runs when the LLM calls your tool, and the returned `data` object is serialized to JSON and fed back to the LLM.

## Available Plugins

| Plugin | Description | Tools |
|--------|-------------|------:|
| [example](plugins/example/) | Randomness toolkit -- dice roller and random picker | 2 |
| [deezer](plugins/deezer/) | Search and send music via @DeezerMusicBot inline bot | 1 |
| [pic](plugins/pic/) | Search and send images via @pic inline bot (Yandex) | 1 |
| [vid](plugins/vid/) | Search and send YouTube videos via @vid inline bot | 1 |
| [giftstat](plugins/giftstat/) | Telegram gift market data from Giftstat API | 11 |
| [giftindex](plugins/giftindex/) | GiftIndex ODROB trading -- monitor and trade Telegram Gifts index on TON | 6 |
| [gaspump](plugins/gaspump/) | Launch, trade, and manage meme tokens on Gas111/TON | 13 |
| [stormtrade](plugins/stormtrade/) | Perpetual futures trading on Storm Trade DEX -- crypto, stocks, forex, commodities | 13 |
| [swapcoffee](plugins/swapcoffee/) | Swap tokens on TON via swap.coffee -- best rates across all DEXes | 6 |
| [geckoterminal](plugins/geckoterminal/) | TON DEX pool and token data -- trending, new, and top pools, trades, OHLCV, batch prices | 10 |
| [dyor](plugins/dyor/) | TON token analytics from DYOR.io -- search, trust score, price, metrics, DEX trades, holders, pools | 11 |
| [stonfi](plugins/stonfi/) | StonFi DEX -- search tokens, browse pools/farms, swap quotes, execute swaps | 8 |
| [dedust](plugins/dedust/) | DeDust DEX -- browse pools, search assets, view trades, prices, on-chain swaps | 8 |
| [tonapi](plugins/tonapi/) | TON blockchain data from TONAPI -- accounts, jettons, NFTs, prices, transactions, traces, DNS, staking | 20 |
| [evaa](plugins/evaa/) | Lending and borrowing on EVAA Protocol -- supply, borrow, withdraw, repay, liquidate | 11 |
| [weather](plugins/weather/) | Current weather and 7-day forecast via Open-Meteo API | 2 |
| [crypto-prices](plugins/crypto-prices/) | Real-time cryptocurrency prices and comparison for 5000+ coins | 2 |
| [voice-notes](plugins/voice-notes/) | Transcribe voice messages using Telegram Premium speech-to-text | 1 |

## Quick Start

1. Create the plugins directory:

   ```bash
   mkdir -p ~/.teleton/plugins
   ```

2. Copy a plugin from this repo:

   ```bash
   cp -r plugins/example ~/.teleton/plugins/
   ```

3. Restart Teleton. The plugin loads automatically.

## Create a plugin

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full plugin development guide.

Short version:

1. Fork this repo
2. Create `plugins/your-plugin/index.js` -- export a `tools` array
3. Add a `manifest.json` -- plugin metadata ([see format](CONTRIBUTING.md#manifestjson))
4. Add a `README.md` in your plugin folder
5. Open a PR

Plugin folder structure:

```
plugins/your-plugin/
  index.js         # Required -- exports tools[]
  manifest.json    # Required -- plugin metadata
  README.md        # Required -- what it does, how to use it
```

## Verify it works

After installing a plugin and restarting Teleton, check the console output:

```
Plugin "example": 2 tools registered          <- success
Plugin "my-plugin": no 'tools' array exported, skipping  <- missing export
Plugin "my-plugin": tool "foo" missing 'execute' function, skipping  <- bad tool
Plugin "my-plugin" failed to load: <error>    <- syntax error or crash
```

If your plugin name shows up with tools registered, you're good.

## Contributors

<a href="https://github.com/TONresistor/teleton-plugins/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=TONresistor/teleton-plugins" />
</a>

## License

MIT

---

Built for [Teleton](https://github.com/TONresistor/tonnet-ai) | MIT License
