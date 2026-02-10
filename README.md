# teleton-plugins

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/TONresistor/teleton-plugins/pulls)
[![ESM only](https://img.shields.io/badge/ESM-only-yellow.svg)](#)
[![Telegram](https://img.shields.io/badge/Telegram-bot-26A5E4.svg?logo=telegram)](https://t.me/)

Community plugin directory for [Teleton](https://github.com/TONresistor/tonnet-ai) -- the Telegram AI agent on TON. Drop a plugin in `~/.teleton/plugins/` and it's live. No build step, no config.

## Table of Contents

- [How it works](#how-it-works)
- [Available Plugins](#available-plugins)
- [Quick Start](#quick-start)
- [Create a plugin](#create-a-plugin)
- [Verify it works](#verify-it-works)
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
|--------|-------------|-------|
| [example](plugins/example/) | Randomness toolkit -- dice roller and random picker | `dice_roll`, `random_pick` |
| [giftstat](plugins/giftstat/) | Telegram gift market data from Giftstat API | `gift_collections`, `gift_floor_prices`, `gift_models`, +8 more |
| [gaspump](plugins/gaspump/) | Token launcher for Gas111 on TON | `gas_login`, `gas_create_token`, `gas_token_info`, +5 more |

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
3. Add a `README.md` in your plugin folder
4. Open a PR

Plugin folder structure:

```
plugins/your-plugin/
  index.js       # Required -- exports tools[]
  README.md      # Required -- what it does, how to use it
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

## License

MIT

---

Built for [Teleton](https://github.com/TONresistor/tonnet-ai) | MIT License
