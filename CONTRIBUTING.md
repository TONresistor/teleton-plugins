# Contributing

Plugins are single folders with an `index.js` that exports a `tools` array (or a function that returns one). Fork, add your plugin, open a PR.

## Steps

1. Fork this repo
2. Create `plugins/your-plugin/index.js`
3. Add a `manifest.json` in your plugin folder (see below)
4. Export a `tools` array or function (ESM — `export const tools`)
5. Add a `README.md` in your plugin folder
6. Open a PR

## Plugin structure

```
plugins/your-plugin/
├── index.js         # Required — exports tools[] or tools(sdk)
├── manifest.json    # Required — plugin metadata
└── README.md        # Required — documentation
```

## manifest.json

Every plugin must include a `manifest.json` at the root of its folder. This file describes the plugin to the registry and to the teleton runtime.

```json
{
  "id": "your-plugin",
  "name": "Human-Readable Plugin Name",
  "version": "1.0.0",
  "description": "One-line description of what the plugin does",
  "author": {
    "name": "your-name",
    "url": "https://github.com/your-name"
  },
  "license": "MIT",
  "entry": "index.js",
  "teleton": ">=1.0.0",
  "sdkVersion": ">=1.0.0",
  "tools": [
    { "name": "tool_name", "description": "What the tool does" }
  ],
  "permissions": [],
  "tags": ["category1", "category2"],
  "repository": "https://github.com/TONresistor/teleton-plugins",
  "funding": null
}
```

### Field reference

| Field         | Type         | Required | Description                                                                               |
| ------------- | ------------ | -------- | ----------------------------------------------------------------------------------------- |
| `id`          | string       | **Yes**  | Unique plugin identifier (lowercase, hyphens). Must match the folder name.                |
| `name`        | string       | **Yes**  | Human-readable display name shown in the registry.                                        |
| `version`     | string       | **Yes**  | Semver version string (e.g. `"1.0.0"`, `"2.3.1"`).                                        |
| `description` | string       | **Yes**  | One-line description of what the plugin does.                                             |
| `author`      | object       | **Yes**  | Object with `name` (string) and `url` (string) fields.                                    |
| `license`     | string       | **Yes**  | SPDX license identifier (e.g. `"MIT"`, `"Apache-2.0"`).                                   |
| `entry`       | string       | **Yes**  | Entry point filename. Almost always `"index.js"`.                                         |
| `teleton`     | string       | **Yes**  | Minimum teleton version required (semver range, e.g. `">=1.0.0"`).                        |
| `sdkVersion`  | string       | No       | Required SDK version (e.g. `">=1.0.0"`). Declare this if your plugin uses `tools(sdk)`.   |
| `tools`       | array        | **Yes**  | Array of objects, each with `name` and `description` for every tool the plugin exports.   |
| `permissions` | array        | **Yes**  | Empty array `[]` by default. Add `"bridge"` if the plugin uses `context.bridge` directly. |
| `secrets`     | object       | No       | Secret declarations — `{ "key": { "required": bool, "description": string } }`. Validated at load time. |
| `tags`        | array        | No       | Categories for discovery (e.g. `["defi", "ton", "trading"]`).                             |
| `repository`  | string       | No       | URL to the plugin's source repository.                                                    |
| `funding`     | string\|null | No       | Funding URL or `null`.                                                                    |

## Tool definition

A tool is a plain object with a `name`, `description`, `parameters` (JSON Schema), and an async `execute` function.

```js
export const tools = [
  {
    name: "my_tool",
    description: "What this tool does — the LLM reads this to decide when to call it",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" }
      },
      required: ["query"]
    },
    execute: async (params, context) => {
      // params.query is what the LLM passed in
      // context gives you Telegram, DB, user info
      return { success: true, data: { result: "hello" } };
    }
  }
];
```

The `data` object is serialized to JSON and sent back to the LLM, which uses it to build its response.

### Tool fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | **Yes** | Unique name across all plugins (e.g. `"weather_forecast"`) |
| `description` | string | **Yes** | LLM reads this to decide when to call your tool |
| `parameters` | object | No | JSON Schema for params. Defaults to empty object if omitted |
| `execute` | async function | **Yes** | `(params, context) => Promise<ToolResult>` |
| `scope` | string | No | `"always"` (default), `"dm-only"`, `"group-only"`, or `"admin-only"` |
| `category` | string | No | `"data-bearing"` (read-only) or `"action"` (side-effect) — helps the LLM reason about tool impact |

### Return format

```js
// Success
return { success: true, data: { /* anything — this is what the LLM sees */ } };

// Error
return { success: false, error: "What went wrong" };
```

## Plugin SDK

If your plugin needs TON blockchain or Telegram messaging features, export `tools` as a **function** instead of an array. The runtime passes a `sdk` object with high-level APIs:

```js
export const tools = (sdk) => [
  {
    name: "my_tool",
    description: "Check balance and send a message",
    parameters: { type: "object", properties: {} },
    execute: async (params, context) => {
      const balance = await sdk.ton.getBalance();
      await sdk.telegram.sendMessage(context.chatId, `Balance: ${balance?.balance} TON`);
      sdk.log.info("Balance checked");
      return { success: true, data: { balance: balance?.balance } };
    }
  }
];
```

The `context` object is still available in `execute` — the SDK is an addition, not a replacement.

### sdk.ton — TON blockchain

| Method | Returns | Throws |
|--------|---------|--------|
| `getAddress()` | `string \| null` — bot's wallet address | — |
| `getBalance(address?)` | `{ balance, balanceNano } \| null` — defaults to bot's wallet | — |
| `getPrice()` | `{ usd, source, timestamp } \| null` — TON/USD price | — |
| `sendTON(to, amount, comment?)` | `{ txRef, amount }` — irreversible transfer | `WALLET_NOT_INITIALIZED`, `INVALID_ADDRESS`, `OPERATION_FAILED` |
| `getTransactions(address, limit?)` | `TonTransaction[]` — max 50 | — |
| `verifyPayment({ amount, memo, gameType, maxAgeMinutes? })` | `{ verified, txHash?, amount?, playerWallet?, date?, secondsAgo?, error? }` | `WALLET_NOT_INITIALIZED`, `OPERATION_FAILED` |
| `getJettonBalances(address?)` | `JettonBalance[]` — all jetton balances | — |
| `getJettonInfo(jettonAddress)` | `JettonInfo \| null` — metadata, supply, holders | — |
| `sendJetton(jettonAddress, to, amount, opts?)` | `{ success, seqno }` | `WALLET_NOT_INITIALIZED`, `INVALID_ADDRESS`, `OPERATION_FAILED` |
| `getJettonWalletAddress(ownerAddress, jettonAddress)` | `string \| null` | — |
| `getNftItems(address?)` | `NftItem[]` — NFTs owned by address | — |
| `getNftInfo(nftAddress)` | `NftItem \| null` — NFT metadata and collection | — |
| `toNano(amount)` | `bigint` — converts TON to nanoTON | — |
| `fromNano(amount)` | `string` — converts nanoTON to TON | — |
| `validateAddress(address)` | `boolean` — checks if a TON address is valid | — |

**Jetton analytics:**

| Method | Returns | Throws |
|--------|---------|--------|
| `getJettonPrice(jettonAddress)` | `JettonPrice \| null` — USD/TON price + 24h/7d/30d changes | — |
| `getJettonHolders(jettonAddress, limit?)` | `JettonHolder[]` — top holders, max 100 | — |
| `getJettonHistory(jettonAddress)` | `JettonHistory \| null` — volume, FDV, market cap | — |

**DEX — `sdk.ton.dex`:**

| Method | Returns | Throws |
|--------|---------|--------|
| `quote({ fromAsset, toAsset, amount, slippage? })` | `DexQuoteResult` — compares STON.fi + DeDust | — |
| `quoteSTONfi(params)` | `DexSingleQuote \| null` | — |
| `quoteDeDust(params)` | `DexSingleQuote \| null` | — |
| `swap({ fromAsset, toAsset, amount, slippage?, dex? })` | `DexSwapResult` — auto-selects best DEX | `WALLET_NOT_INITIALIZED`, `OPERATION_FAILED` |
| `swapSTONfi(params)` | `DexSwapResult` | `WALLET_NOT_INITIALIZED`, `OPERATION_FAILED` |
| `swapDeDust(params)` | `DexSwapResult` | `WALLET_NOT_INITIALIZED`, `OPERATION_FAILED` |

**DNS — `sdk.ton.dns`:**

| Method | Returns | Throws |
|--------|---------|--------|
| `check(domain)` | `DnsCheckResult` — availability, owner, auction status | — |
| `resolve(domain)` | `DnsResolveResult \| null` — wallet address | — |
| `getAuctions(limit?)` | `DnsAuction[]` — active auctions | — |
| `startAuction(domain)` | `DnsAuctionResult` — ~0.06 TON min bid | `WALLET_NOT_INITIALIZED`, `OPERATION_FAILED` |
| `bid(domain, amount)` | `DnsBidResult` | `WALLET_NOT_INITIALIZED`, `OPERATION_FAILED` |
| `link(domain, address)` | `void` | `WALLET_NOT_INITIALIZED`, `OPERATION_FAILED` |
| `unlink(domain)` | `void` | `WALLET_NOT_INITIALIZED`, `OPERATION_FAILED` |
| `setSiteRecord(domain, adnlAddress)` | `void` — set TON Site ADNL record | `WALLET_NOT_INITIALIZED`, `OPERATION_FAILED` |

Read methods return `null` or `[]` on failure. Write methods throw `PluginSDKError`.

### sdk.telegram — Telegram messaging

**Core messaging:**

| Method                                        | Returns                                        | Throws                                     |
| --------------------------------------------- | ---------------------------------------------- | ------------------------------------------ |
| `sendMessage(chatId, text, opts?)`            | `number` — message ID                          | `BRIDGE_NOT_CONNECTED`, `OPERATION_FAILED` |
| `editMessage(chatId, messageId, text, opts?)` | `number` — message ID                          | `BRIDGE_NOT_CONNECTED`, `OPERATION_FAILED` |
| `deleteMessage(chatId, messageId, revoke?)`   | `void`                                         | `BRIDGE_NOT_CONNECTED`, `OPERATION_FAILED` |
| `forwardMessage(fromChat, toChat, messageId)` | `number` — new message ID                      | `BRIDGE_NOT_CONNECTED`, `OPERATION_FAILED` |
| `pinMessage(chatId, messageId, opts?)`        | `void`                                         | `BRIDGE_NOT_CONNECTED`, `OPERATION_FAILED` |
| `sendDice(chatId, emoticon, replyToId?)`      | `{ value, messageId }`                         | `BRIDGE_NOT_CONNECTED`, `OPERATION_FAILED` |
| `sendReaction(chatId, messageId, emoji)`      | `void`                                         | `BRIDGE_NOT_CONNECTED`, `OPERATION_FAILED` |
| `getMessages(chatId, limit?)`                 | `SimpleMessage[]` — default 50                 | —                                          |
| `searchMessages(chatId, query, limit?)`       | `SimpleMessage[]`                              | —                                          |
| `getReplies(chatId, messageId, limit?)`       | `SimpleMessage[]`                              | —                                          |
| `scheduleMessage(chatId, text, scheduleDate)`  | `number` — message ID                          | `BRIDGE_NOT_CONNECTED`, `OPERATION_FAILED` |
| `getScheduledMessages(chatId)`                | `SimpleMessage[]`                              | —                                          |
| `deleteScheduledMessage(chatId, messageId)`   | `void`                                         | `BRIDGE_NOT_CONNECTED`, `OPERATION_FAILED` |
| `sendScheduledNow(chatId, messageId)`         | `void`                                         | `BRIDGE_NOT_CONNECTED`, `OPERATION_FAILED` |
| `getMe()`                                     | `{ id, username?, firstName?, isBot } \| null` | —                                          |
| `isAvailable()`                               | `boolean`                                      | —                                          |
| `getRawClient()`                              | GramJS `TelegramClient \| null` — escape hatch  | —                                          |

**Media:**

| Method | Returns | Throws |
|--------|---------|--------|
| `sendPhoto(chatId, file, opts?)` | `number` — message ID | `BRIDGE_NOT_CONNECTED`, `OPERATION_FAILED` |
| `sendVideo(chatId, file, opts?)` | `number` — message ID | `BRIDGE_NOT_CONNECTED`, `OPERATION_FAILED` |
| `sendVoice(chatId, file, opts?)` | `number` — message ID | `BRIDGE_NOT_CONNECTED`, `OPERATION_FAILED` |
| `sendFile(chatId, file, opts?)` | `number` — message ID | `BRIDGE_NOT_CONNECTED`, `OPERATION_FAILED` |
| `sendGif(chatId, file, opts?)` | `number` — message ID | `BRIDGE_NOT_CONNECTED`, `OPERATION_FAILED` |
| `sendSticker(chatId, file)` | `number` — message ID | `BRIDGE_NOT_CONNECTED`, `OPERATION_FAILED` |
| `downloadMedia(chatId, messageId)` | `Buffer \| null` | `BRIDGE_NOT_CONNECTED`, `OPERATION_FAILED` |
| `setTyping(chatId)` | `void` | `BRIDGE_NOT_CONNECTED`, `OPERATION_FAILED` |

**Social & moderation:**

| Method | Returns | Throws |
|--------|---------|--------|
| `getChatInfo(chatId)` | `ChatInfo \| null` | — |
| `getUserInfo(userId)` | `UserInfo \| null` | — |
| `resolveUsername(username)` | `{ id, type } \| null` | — |
| `getParticipants(chatId, limit?)` | `UserInfo[]` | — |
| `createPoll(chatId, question, answers, opts?)` | `number` — message ID | `BRIDGE_NOT_CONNECTED`, `OPERATION_FAILED` |
| `createQuiz(chatId, question, answers, correctIndex, explanation?)` | `number` — message ID | `BRIDGE_NOT_CONNECTED`, `OPERATION_FAILED` |
| `banUser(chatId, userId)` | `void` | `BRIDGE_NOT_CONNECTED`, `OPERATION_FAILED` |
| `unbanUser(chatId, userId)` | `void` | `BRIDGE_NOT_CONNECTED`, `OPERATION_FAILED` |
| `muteUser(chatId, userId, untilDate)` | `void` — untilDate is Unix timestamp, 0 = forever | `BRIDGE_NOT_CONNECTED`, `OPERATION_FAILED` |
| `kickUser(chatId, userId)` | `void` — ban + immediate unban | `BRIDGE_NOT_CONNECTED`, `OPERATION_FAILED` |
| `getDialogs(limit?)` | `Dialog[]` — max 100 | — |
| `getHistory(chatId, limit?)` | `SimpleMessage[]` — max 100 | — |

**Stars & gifts:**

| Method | Returns | Throws |
|--------|---------|--------|
| `getStarsBalance()` | `number` | `BRIDGE_NOT_CONNECTED`, `OPERATION_FAILED` |
| `sendGift(userId, giftId, opts?)` | `void` | `BRIDGE_NOT_CONNECTED`, `OPERATION_FAILED` |
| `getAvailableGifts()` | `StarGift[]` | `BRIDGE_NOT_CONNECTED`, `OPERATION_FAILED` |
| `getMyGifts(limit?)` | `ReceivedGift[]` | `BRIDGE_NOT_CONNECTED`, `OPERATION_FAILED` |
| `getResaleGifts(giftId, limit?)` | `StarGift[]` | `BRIDGE_NOT_CONNECTED`, `OPERATION_FAILED` |
| `buyResaleGift(giftId)` | `void` | `BRIDGE_NOT_CONNECTED`, `OPERATION_FAILED` |
| `getStarsTransactions(limit?)` | `StarsTransaction[]` | `BRIDGE_NOT_CONNECTED`, `OPERATION_FAILED` |

**Collectibles & NFT gifts:**

| Method | Returns | Throws |
|--------|---------|--------|
| `transferCollectible(msgId, toUserId)` | `TransferResult` | `BRIDGE_NOT_CONNECTED`, `OPERATION_FAILED` |
| `setCollectiblePrice(msgId, price)` | `void` — 0 to unlist | `BRIDGE_NOT_CONNECTED`, `OPERATION_FAILED` |
| `getCollectibleInfo(slug)` | `CollectibleInfo \| null` | — |
| `getUniqueGift(slug)` | `UniqueGift \| null` | — |
| `getUniqueGiftValue(slug)` | `GiftValue \| null` | — |
| `sendGiftOffer(userId, giftSlug, price, opts?)` | `void` | `BRIDGE_NOT_CONNECTED`, `OPERATION_FAILED` |

**Stories:**

| Method | Returns | Throws |
|--------|---------|--------|
| `sendStory(mediaPath, opts?)` | `number` — story ID | `BRIDGE_NOT_CONNECTED`, `OPERATION_FAILED` |

Options for `sendMessage`:
```js
await sdk.telegram.sendMessage(chatId, "Pick one:", {
  replyToId: 123,
  inlineKeyboard: [
    [{ text: "Option A", callback_data: "a" }, { text: "Option B", callback_data: "b" }]
  ]
});
```

### sdk.db — Isolated database

Each plugin gets its own SQLite database at `~/.teleton/plugins/data/{plugin-name}.db`. To enable it, export a `migrate` function:

```js
export function migrate(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS scores (
    user_id TEXT PRIMARY KEY,
    points INTEGER NOT NULL DEFAULT 0
  )`);
}

export const tools = (sdk) => [{
  name: "my_tool",
  execute: async (params, context) => {
    // sdk.db is a full better-sqlite3 instance
    sdk.db.prepare("INSERT INTO scores ...").run(...);
    const row = sdk.db.prepare("SELECT * FROM scores WHERE user_id = ?").get(userId);
    return { success: true, data: row };
  }
}];
```

If you don't export `migrate`, `sdk.db` is `null`.

### sdk.secrets — Secret management

3-tier resolution: **ENV variable** → **secrets store** (`~/.teleton/plugins/data/<name>.secrets.json`) → **pluginConfig fallback**.

| Method | Returns | Throws |
|--------|---------|--------|
| `get(key)` | `string \| undefined` — resolved secret | — |
| `require(key)` | `string` — resolved secret (throws if missing) | `SECRET_NOT_FOUND` |
| `has(key)` | `boolean` — checks if secret exists | — |

Declare secrets in `manifest.json` for validation at load time:

```json
{
  "secrets": {
    "api_key": { "required": true, "description": "API key for the service" },
    "webhook_url": { "required": false, "description": "Optional webhook endpoint" }
  }
}
```

```js
// In your plugin:
const apiKey = sdk.secrets.require("api_key");  // throws if missing
const webhook = sdk.secrets.get("webhook_url");  // undefined if not set
```

Users set secrets via env vars (`YOURPLUGIN_API_KEY` — plugin name uppercased, hyphens to underscores) or the secrets store (`/plugin set <name> <key> <value>`).

### sdk.storage — Key-value store with TTL

Auto-provisioned KV store — no `migrate()` needed. Uses a `_kv` table in the plugin's SQLite database.

| Method | Returns | Description |
|--------|---------|-------------|
| `get<T>(key)` | `T \| undefined` | Get value (returns undefined if expired or missing) |
| `set<T>(key, value, opts?)` | `void` | Set value with optional `{ ttl }` in milliseconds |
| `delete(key)` | `boolean` | Delete a key (returns true if key existed) |
| `has(key)` | `boolean` | Check if key exists and isn't expired |
| `clear()` | `void` | Delete all keys in this plugin's storage |

```js
// Cache API responses for 1 hour (TTL in milliseconds)
sdk.storage.set("token_price", price, { ttl: 3_600_000 });
const cached = sdk.storage.get("token_price");
if (cached) return cached;  // auto-deserialized from JSON
```

### sdk.config & sdk.pluginConfig

- `sdk.config` — sanitized application config (no API keys or secrets)
- `sdk.pluginConfig` — plugin-specific config from `~/.teleton/config.yaml`

Plugin config is merged with defaults from your manifest:

```js
// In your plugin:
export const manifest = {
  name: "my-plugin",
  defaultConfig: { threshold: 50, mode: "auto" }
};
```

```yaml
# In ~/.teleton/config.yaml (optional — only if the user wants to override):
plugins:
  my_plugin:
    threshold: 100
```

Result: `sdk.pluginConfig = { threshold: 100, mode: "auto" }`. The plugin works out of the box with `defaultConfig` — users only touch config.yaml to override.

### sdk.log — Prefixed logger

```js
sdk.log.info("started");   // [my-plugin] started
sdk.log.warn("low funds");  // ⚠️ [my-plugin] low funds
sdk.log.error("failed");    // ❌ [my-plugin] failed
sdk.log.debug("details");   // 🔍 [my-plugin] details  (only if DEBUG or VERBOSE env)
```

### sdk.bot — Inline mode

Enables inline query and callback button handling. Requires `bot` in manifest:

```js
export const manifest = {
  name: "my-bot",
  version: "1.0.0",
  bot: { inline: true, callbacks: true, rateLimits: { inlinePerMinute: 30, callbackPerMinute: 60 } },
};
```

`sdk.bot` is `null` unless the manifest declares `bot` capabilities.

| Property / Method | Returns | Description |
|-------------------|---------|-------------|
| `isAvailable` | `boolean` | Whether bot client is connected (getter) |
| `username` | `string` | Bot username (getter) |
| `onInlineQuery(handler)` | `void` | Register inline query handler |
| `onCallback(pattern, handler)` | `void` | Register callback handler (glob pattern) |
| `onChosenResult(handler)` | `void` | Handle chosen inline results |
| `editInlineMessage(id, text, opts?)` | `Promise<void>` | Edit inline message (GramJS → Grammy fallback) |
| `keyboard(rows)` | `BotKeyboard` | Build keyboard with auto-prefixed callbacks |

```js
sdk.bot.onInlineQuery(async (ctx) => {
  return [{ id: "1", type: "article", title: ctx.query, content: { text: ctx.query } }];
});

sdk.bot.onCallback("pick:*", async (ctx) => {
  await ctx.answer("Selected!");
  await ctx.editMessage("Done!");
});

const kb = sdk.bot.keyboard([
  [{ text: "Buy", callback: "buy", style: "success" }],
  [{ text: "Cancel", callback: "cancel", style: "danger" }],
]);
// kb.toTL()     — GramJS (colored buttons)
// kb.toGrammy() — Grammy Bot API (standard buttons)
```

Button styles: `"success"` (green), `"danger"` (red), `"primary"` (blue) — GramJS only, graceful fallback.

### Error handling with SDK

SDK write methods throw `PluginSDKError` with a `.code` property:

```js
try {
  await sdk.ton.sendTON(address, 1.0);
} catch (err) {
  if (err.name === "PluginSDKError") {
    switch (err.code) {
      case "WALLET_NOT_INITIALIZED": // wallet not set up
      case "INVALID_ADDRESS":        // bad TON address
      case "BRIDGE_NOT_CONNECTED":   // Telegram not ready
      case "SECRET_NOT_FOUND":       // sdk.secrets.require() failed
      case "OPERATION_FAILED":       // generic failure
    }
  }
  return { success: false, error: String(err.message).slice(0, 500) };
}
```

## Advanced lifecycle

Beyond `tools`, plugins can export additional hooks for database, background tasks, and cleanup:

```js
// Optional: the runtime reads this for sdkVersion, defaultConfig, etc.
// The manifest.json file is used by the registry for discovery.
export const manifest = {
  name: "my-plugin",
  version: "1.0.0",
  sdkVersion: ">=1.0.0",
  defaultConfig: { key: "value" },
};

// Optional: database setup (enables sdk.db)
export function migrate(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS ...`);
}

// Required: tools
export const tools = (sdk) => [{ ... }];

// Optional: runs after Telegram bridge connects
export async function start(ctx) {
  // ctx.bridge   — TelegramBridge
  // ctx.db       — plugin's isolated DB (null if no migrate)
  // ctx.config   — sanitized app config
  // ctx.pluginConfig — plugin-specific config
  // ctx.log      — prefixed logger function
}

// Optional: runs on shutdown
export async function stop() {
  // cleanup timers, connections, etc.
}
```

Execution order: `import` → manifest validation → `migrate(db)` → `tools(sdk)` → register → `start(ctx)` → ... → `stop()`.

## Context object

Your `execute` function receives `(params, context)`. The context contains:

| Field | Type | Description |
|-------|------|-------------|
| `bridge` | TelegramBridge | Send messages, reactions, media via Telegram (low-level) |
| `db` | Database | SQLite instance (shared — prefer `sdk.db` for isolation) |
| `chatId` | string | Current chat ID |
| `senderId` | number | Telegram user ID of who triggered the tool |
| `isGroup` | boolean | `true` if group chat, `false` if DM |
| `config` | Config? | Agent configuration (may be undefined) |

When using the SDK, prefer `sdk.telegram` over `context.bridge` and `sdk.db` over `context.db`.

## Best practices

### Fetch timeouts

Always use `AbortSignal.timeout()` on every `fetch()` call. This prevents tools from hanging indefinitely when an external API is slow or unreachable.

```js
const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
```

### CJS dependencies

The teleton runtime is ESM-only, but some Node.js packages (like `@ton/core`) only ship CommonJS. Use `createRequire` with `realpathSync` to load them:

```js
import { createRequire } from "node:module";
import { realpathSync } from "node:fs";

const _require = createRequire(realpathSync(process.argv[1]));
const { Address } = _require("@ton/core");
```

### Per-plugin npm dependencies

Plugins can declare their own npm dependencies by adding `package.json` and `package-lock.json` to the plugin folder. Teleton auto-installs them at startup — no manual step needed.

**Setup:**

```bash
cd plugins/your-plugin
npm init -y
npm install some-package
# Commit both package.json and package-lock.json
```

**Dual-require pattern** — use two `createRequire` instances to separate core and plugin-local deps:

```js
import { createRequire } from "node:module";
import { realpathSync } from "node:fs";

// Core deps (provided by teleton runtime: @ton/core, @ton/ton, @ton/crypto, telegram)
const _require = createRequire(realpathSync(process.argv[1]));
// Plugin-local deps (from your plugin's node_modules/)
const _pluginRequire = createRequire(import.meta.url);

const { Address } = _require("@ton/core");           // core
const { getHttpEndpoint } = _pluginRequire("@orbs-network/ton-access");  // plugin-local
```

**Rules:**
- A `package-lock.json` is **required** alongside `package.json` (the loader skips install without it)
- Dependencies are installed with `npm ci --ignore-scripts` (no postinstall scripts run)
- `node_modules/` is gitignored — it's created automatically at startup
- If install fails (e.g. no network), the plugin is skipped with a warning

### Bridge access

When your plugin needs direct Telegram MTProto access, you have two options:

```js
// Option 1: SDK (recommended)
const client = sdk.telegram.getRawClient();

// Option 2: Context (legacy)
const client = context.bridge.getClient().getClient();
```

If using `context.bridge` directly, declare `"permissions": ["bridge"]` in your `manifest.json`.

### Tool scope

Control where your tools are available:

```js
{
  name: "send_payment",
  scope: "dm-only",    // Only in DMs (financial operations)
  execute: async (params, context) => { ... }
}
```

- `"always"` (default) — available in DMs and groups
- `"dm-only"` — only in DMs (use for financial, private tools)
- `"group-only"` — only in groups (use for moderation tools)
- `"admin-only"` — only for admins (use for sensitive operations)

### Error handling

Always return the `{ success, data/error }` format. Slice long error messages to avoid flooding the LLM context:

```js
try {
  const result = await doSomething(params);
  return { success: true, data: result };
} catch (err) {
  return { success: false, error: String(err.message || err).slice(0, 500) };
}
```

## Rules

- **ESM only** — use `export const tools`, not `module.exports`
- **JS only at runtime** — the loader only reads `.js` files. Write TypeScript if you want, but compile to `.js` first
- **`manifest.json` is required** — plugins without it won't be listed in the registry
- Tool `name` must be globally unique — if it collides with a built-in or another plugin, yours is silently skipped
- **Tool names must be prefixed** with the plugin name or a short unique prefix (e.g. `gas_`, `storm_`, `gift_`)
- **Defaults** — use `??` (nullish coalescing), never `||` for default values
- **Per-plugin npm deps** — plugins that need npm packages beyond the core runtime (`@ton/core`, `@ton/ton`, `@ton/crypto`, `telegram`) should add a `package.json` + `package-lock.json` in their plugin folder. Teleton auto-installs them at startup via `npm ci --ignore-scripts`. Use the dual-require pattern to load plugin-local deps (see below)
- **Use `AbortSignal.timeout()`** on all `fetch()` calls — never let a network request hang without a timeout
- **GramJS** — always use `createRequire(realpathSync(process.argv[1]))` to import CJS packages, never `import from "telegram"`
- **Declare `sdkVersion`** in `manifest.json` if your plugin uses `tools(sdk)` (e.g. `"sdkVersion": ">=1.0.0"`)

## Local testing

To test a plugin without restarting Teleton, verify it loads and exports the correct number of tools:

```bash
# Simple array format
node -e "import('./plugins/your-plugin/index.js').then(m => console.log(m.tools.length, 'tools exported'))"

# SDK function format (tools is a function, so check it exists)
node -e "import('./plugins/your-plugin/index.js').then(m => console.log(typeof m.tools, '— tools export type'))"
```

To install it for live testing with Teleton:

```bash
mkdir -p ~/.teleton/plugins
cp -r plugins/your-plugin ~/.teleton/plugins/
```

Then restart Teleton and check the console output.

## Verify it works

After installing your plugin and restarting Teleton, check the console output:

```
Plugin "example": 2 tools registered              <- success
Plugin "my-plugin": no 'tools' array exported      <- missing export
Plugin "my-plugin": tool "foo" missing 'execute'   <- bad tool definition
Plugin "my-plugin" failed to load: <error>         <- syntax error or crash
```

If you see the registered line with your plugin name, it works.

## Plugin README template

Your plugin's `README.md` should include:

- Plugin name and one-line description
- Table of tools (name + what each one does)
- Install command (`cp -r plugins/your-plugin ~/.teleton/plugins/`)
- Usage examples (natural language prompts the user can send)
- Parameter tables per tool (param name, type, required, default, description)

Example structure:

```markdown
# your-plugin

One-line description of what the plugin does.

| Tool | Description |
|------|-------------|
| `tool_name` | What it does |

## Install

mkdir -p ~/.teleton/plugins
cp -r plugins/your-plugin ~/.teleton/plugins/

## Usage examples

- "Ask the AI to do X"
- "Ask the AI to do Y"

## Tool schemas

### tool_name

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `param` | string | Yes | — | What it is |
```
