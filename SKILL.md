---
name: plugin
description: Teleton Plugin Builder. Use when the user wants to build, create, or scaffold a new plugin for Teleton (Telegram AI agent on TON blockchain). Triggers on requests like "build a plugin", "create a tool", "make a plugin for X", "add a new plugin". Covers both simple plugins (Pattern A - static tools array) and SDK plugins (Pattern B - tools(sdk) with TON blockchain, Telegram messaging, database, inline bot mode).
---

# Teleton Plugin Builder

Build plugins for **Teleton**, a Telegram AI agent on TON blockchain.

## Reference Files

Before building, read the relevant files **in this order**:

1. **SDK full reference** (REQUIRED): fetch and read `https://raw.githubusercontent.com/TONresistor/teleton-agent/main/packages/sdk/README.md` — this is the **source of truth** for all SDK types, method signatures, return values, error codes, and TypeScript interfaces. Read this first to fully understand the SDK before writing any code.
2. **Code patterns & best practices**: `references/patterns.md` — ready-to-use code templates (inline bot, payment verification, API fetch, GramJS import, per-plugin deps)
3. **Contribution rules & lifecycle**: `CONTRIBUTING.md` — tool definition, manifest fields, lifecycle hooks, context object, testing
4. **Simple plugin example**: `plugins/example/index.js` — Pattern A (static array, no SDK)
5. **SDK plugin example**: `plugins/example-sdk/index.js` — Pattern B (tools(sdk) with DB, TON, Telegram)
6. **Advanced plugin**: `plugins/casino/index.js` — real-world SDK plugin with payments, verification, payouts
7. **Registry**: `registry.json` — all existing plugins (check for name conflicts)

Read at least the SDK README (step 1), `CONTRIBUTING.md` (step 3), and the relevant example before building.

## Workflow

1. **Ask** — plugin name, what it does, which API or service
2. **Decide** — Pattern A (simple) or B (SDK) using the decision tree
3. **Plan** — present structured plan, wait for approval
4. **Build** — create all files once approved
5. **Install** — copy to `~/.teleton/plugins/`, restart agent

## SDK Decision Tree

**Use Pattern B (`tools(sdk)`) if ANY apply:**

| Need | SDK | Example |
|------|-----|---------|
| TON wallet, balance, transfers | `sdk.ton` | Casino payout |
| Jetton tokens or NFTs | `sdk.ton.getJettonBalances()` | Portfolio tracker |
| DEX swaps (STON.fi / DeDust) | `sdk.ton.dex.swap()` | Trading bot |
| .ton DNS domains | `sdk.ton.dns.check()` | Domain manager |
| Jetton analytics (price, holders) | `sdk.ton.getJettonPrice()` | Market data |
| Payment verification | `sdk.ton.verifyPayment()` | Paid services |
| Send Telegram messages | `sdk.telegram.sendMessage()` | Notifications |
| Media (photos, video, files) | `sdk.telegram.sendPhoto()` | Media bot |
| Moderation (ban, mute, kick) | `sdk.telegram.banUser()` | Group admin |
| Stars, gifts, collectibles | `sdk.telegram.sendGift()` | Gift marketplace |
| Inline bot mode (styled buttons) | `sdk.bot.onInlineQuery()` | Inline search bot |
| Isolated database | `sdk.db` + `migrate()` | Score tracking |
| Key-value storage with TTL | `sdk.storage` | Caching, rate limits |
| API keys or secrets | `sdk.secrets` | Authenticated APIs |
| Plugin-specific config | `sdk.pluginConfig` | Customizable settings |

**Use Pattern A (`tools = [...]`) if ALL apply:**
- Only calls external APIs — no TON, no Telegram messaging from code
- Only returns data to LLM (no side effects)
- No persistent state, no config, no secrets

## Plan Template

Present this to the user and **wait for approval**:

```
Plugin: [name]
Pattern: [A (simple) | B (SDK)]
Reason: [why SDK is/isn't needed]

Tools:
| Tool        | Description              | Params                     |
|-------------|--------------------------|----------------------------|
| `tool_name` | What it does             | `query` (string, required) |

SDK features: [none | sdk.ton, sdk.telegram, sdk.bot, sdk.db, sdk.storage, sdk.secrets]

Files:
- plugins/[name]/index.js
- plugins/[name]/manifest.json
- plugins/[name]/README.md
- registry.json (update)
```

## Build

Create all files in `plugins/[name]/`. See `references/patterns.md` for complete code templates.

### Pattern A — Simple (static array)

```javascript
export const tools = [
  {
    name: "tool_name",
    description: "The LLM reads this to decide when to call the tool",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
      },
      required: ["query"],
    },
    execute: async (params, context) => {
      try {
        return { success: true, data: { result: "..." } };
      } catch (err) {
        return { success: false, error: String(err.message || err).slice(0, 500) };
      }
    },
  },
];
```

### Pattern B — SDK (function)

```javascript
export const manifest = {
  name: "my-plugin",
  version: "1.0.0",
  sdkVersion: ">=1.0.0",
  description: "What this plugin does",
  defaultConfig: { some_setting: "default" },
  // bot: { inline: true, callbacks: true }, // uncomment for inline mode
};

export function migrate(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS my_table (id TEXT PRIMARY KEY, value TEXT)`);
}

export const tools = (sdk) => [
  {
    name: "my_tool",
    description: "What this tool does",
    parameters: { type: "object", properties: {} },
    scope: "always", // "always" | "dm-only" | "group-only" | "admin-only"
    category: "data-bearing", // "data-bearing" | "action"
    execute: async (params, context) => {
      try {
        const balance = await sdk.ton.getBalance();
        return { success: true, data: { balance: balance?.balance } };
      } catch (err) {
        return { success: false, error: String(err.message || err).slice(0, 500) };
      }
    },
  },
];

export async function start(ctx) { /* ctx.bridge, ctx.db, ctx.config, ctx.pluginConfig, ctx.log */ }
export async function stop() { /* cleanup */ }
```

### manifest.json

```json
{
  "id": "PLUGIN_ID",
  "name": "Display Name",
  "version": "1.0.0",
  "description": "One-line description",
  "author": { "name": "teleton", "url": "https://github.com/TONresistor" },
  "license": "MIT",
  "entry": "index.js",
  "teleton": ">=1.0.0",
  "tools": [{ "name": "tool_name", "description": "Short description" }],
  "permissions": [],
  "tags": ["tag1", "tag2"],
  "repository": "https://github.com/TONresistor/teleton-plugins",
  "funding": null
}
```

- Add `"sdkVersion": ">=1.0.0"` only for Pattern B
- Add `"permissions": ["bridge"]` only if using `context.bridge` directly
- Add `"secrets"` to declare required secrets

### README.md

```markdown
# Plugin Name

One-line description.

| Tool | Description |
|------|-------------|
| `tool_name` | What it does |

## Install

mkdir -p ~/.teleton/plugins
cp -r plugins/PLUGIN_ID ~/.teleton/plugins/

## Usage examples

- "Natural language prompt"

## Tool schema

### tool_name

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `query` | string | Yes | — | Search query |
```

### registry.json

Add to the `plugins` array:

```json
{ "id": "PLUGIN_ID", "name": "Display Name", "description": "One-line", "author": "teleton", "tags": ["tag1"], "path": "plugins/PLUGIN_ID" }
```

## Install & Commit

1. Copy: `cp -r plugins/PLUGIN_ID ~/.teleton/plugins/`
2. Commit: `git add plugins/PLUGIN_ID/ registry.json && git commit -m "PLUGIN_NAME: short description"`
3. Ask user if they want to push

## Rules

- **ESM only** — `export const tools`, never `module.exports`
- **JS only** — loader reads `.js` files only; compile TypeScript first
- **Tool names** — `snake_case`, globally unique, prefixed with plugin name
- **Defaults** — use `??` (nullish coalescing), never `||`
- **Errors** — always try/catch, return `{ success: false, error }`, slice to 500 chars
- **Timeouts** — `AbortSignal.timeout(15000)` on all `fetch()` calls
- **GramJS** — always `createRequire(realpathSync(process.argv[1]))`, never `import from "telegram"`
- **SDK preferred** — prefer `sdk.telegram` over `context.bridge`, `sdk.db` over `context.db`
- **Scope** — `"dm-only"` for financial, `"group-only"` for moderation, `"admin-only"` for admin
- **Category** — `"data-bearing"` for reads, `"action"` for writes (irreversible ops)
- **Secrets** — use `sdk.secrets`, declare in `manifest.secrets`
- **Storage** — prefer `sdk.storage` over `sdk.db` for caching (no `migrate()` needed)
- **Bot SDK** — declare `bot` in manifest to enable `sdk.bot`; `sdk.bot` is `null` without it

## SDK Namespaces Overview

Full method signatures, types, and error codes are in the SDK README (step 1 above). Quick summary of available namespaces:

| Namespace | Purpose | Key Capabilities |
|-----------|---------|-----------------|
| `sdk.ton` | TON blockchain | Wallet, balance, transfers, jettons, NFTs, payment verification |
| `sdk.ton.dex` | DEX trading | STON.fi + DeDust quotes and swaps |
| `sdk.ton.dns` | .ton domains | Check, resolve, auction, bid, link, ADNL records |
| `sdk.telegram` | Telegram messaging | Messages, media, moderation, polls, stars, gifts, collectibles, stories |
| `sdk.bot` | Inline bot mode | Inline queries, callback buttons, colored styled keyboards |
| `sdk.db` | Isolated database | `better-sqlite3` instance (requires `migrate()`) |
| `sdk.storage` | Key-value store | `get/set/delete/has/clear` with optional TTL |
| `sdk.secrets` | Secret management | 3-tier resolution: ENV → secrets file → pluginConfig |
| `sdk.log` | Prefixed logger | `info()`, `warn()`, `error()`, `debug()` |
| `sdk.pluginConfig` | Plugin config | Merged with `manifest.defaultConfig` |

## Error Handling

- **Read methods** (`getBalance`, `getMessages`, etc.) return `null` or `[]` — never throw
- **Write methods** (`sendTON`, `sendMessage`, `banUser`, etc.) throw `PluginSDKError` with `.code`:
  - `WALLET_NOT_INITIALIZED` — wallet not set up
  - `INVALID_ADDRESS` — bad TON address
  - `BRIDGE_NOT_CONNECTED` — Telegram not ready
  - `SECRET_NOT_FOUND` — `sdk.secrets.require()` failed
  - `OPERATION_FAILED` — generic failure

```javascript
try {
  await sdk.ton.sendTON(address, 1.0);
} catch (err) {
  if (err.name === "PluginSDKError") {
    return { success: false, error: `${err.code}: ${err.message}` };
  }
  return { success: false, error: String(err.message).slice(0, 500) };
}
```

## Context Object

Available in `execute(params, context)` for **all** plugins:

| Field | Type | Description |
|-------|------|-------------|
| `chatId` | string | Current chat ID |
| `senderId` | number | Telegram user ID |
| `isGroup` | boolean | Group or DM |
| `bridge` | TelegramBridge | Low-level Telegram (prefer `sdk.telegram`) |
| `db` | Database | Shared DB (prefer `sdk.db` for isolation) |
| `config` | Config? | Agent config |
