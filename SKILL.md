# Teleton Plugin Builder

You are building a plugin for **Teleton**, a Telegram AI agent on TON. Ask the user what plugin or tools they want to build, then follow this workflow.

## Reference documentation

Before building, read the relevant reference files from the teleton-plugins repo:

- **Full rules & SDK reference**: `CONTRIBUTING.md` — complete guide with tool definition, SDK API tables, error handling, lifecycle, best practices, testing
- **Simple plugin example**: `plugins/example/index.js` — Pattern A (array of tools, no SDK)
- **SDK plugin example**: `plugins/example-sdk/index.js` — Pattern B (tools(sdk) with database, TON balance, Telegram messaging)
- **Advanced SDK plugin**: `plugins/casino/index.js` — real-world SDK plugin with TON payments, payment verification, isolated database, payout logic
- **Registry**: `registry.json` — list of all existing plugins (check for name conflicts)
- **README.md** — project overview, plugin list, SDK section

Read at least `CONTRIBUTING.md` and the relevant example before building.

---

## Workflow

1. **Ask** the user what they want (plugin name, what it does, which API or bot)
2. **Decide** — determine if the plugin needs the SDK (see decision tree below)
3. **Plan** — present a structured plan and ask for validation
4. **Build** — create all files once the user approves
5. **Install** — copy to `~/.teleton/plugins/` and restart

---

## Step 1 — Understand the request

Determine:

- **Plugin name** — short, lowercase folder name (e.g. `pic`, `deezer`, `weather`)
- **Plugin type**:
  - **Inline bot** — wraps a Telegram inline bot (@pic, @vid, @gif, @DeezerMusicBot…)
  - **Public API** — calls an external REST API, no auth
  - **Auth API** — external API with Telegram WebApp auth
  - **Local logic** — pure JavaScript, no external calls
- **Tools** — list of tool names, what each does, parameters
- **Does it need GramJS?** — yes for inline bots and WebApp auth
- **Does it need the SDK?** — use the decision tree below

---

## SDK Decision Tree

The Plugin SDK (`tools(sdk)`) gives high-level access to TON, Telegram, database, logging, and config. Use it **only when needed** — simpler plugins should use Pattern A.

**Use `tools(sdk)` (Pattern B) if ANY of these apply:**

| Need | SDK namespace | Example |
|------|--------------|---------|
| Check TON balance or wallet address | `sdk.ton.getBalance()`, `sdk.ton.getAddress()` | Casino checking balance before payout |
| Send TON or verify payments | `sdk.ton.sendTON()`, `sdk.ton.verifyPayment()` | Casino auto-payout, paid services |
| Get TON price or transactions | `sdk.ton.getPrice()`, `sdk.ton.getTransactions()` | Portfolio tracker |
| Send Telegram messages programmatically | `sdk.telegram.sendMessage()` | Announcements, notifications |
| Edit messages or send reactions | `sdk.telegram.editMessage()`, `sdk.telegram.sendReaction()` | Interactive UIs |
| Send dice/slot animations | `sdk.telegram.sendDice()` | Casino dice game |
| Need an isolated database | `sdk.db` (requires `export function migrate(db)`) | Tracking user scores, history, state |
| Plugin-specific config with defaults | `sdk.pluginConfig` + `manifest.defaultConfig` | Customizable thresholds, modes |
| Structured logging | `sdk.log.info()`, `sdk.log.error()` | Debug, monitoring |

**Use `tools = [...]` (Pattern A) if ALL of these apply:**

- Only calls external APIs (REST, GraphQL) — no TON blockchain interaction
- Does not need to send Telegram messages from code (only returns data to LLM)
- Does not need persistent state (no database)
- Does not need plugin-specific config

**Examples:**

| Plugin | Pattern | Why |
|--------|---------|-----|
| `weather` | A (array) | Calls Open-Meteo API, returns data |
| `pic` | A (array) | Uses inline bot via context.bridge |
| `gaspump` | A (array) | Calls Gas111 API, uses WebApp auth |
| `casino` | B (SDK) | Needs sdk.ton (payments), sdk.telegram (dice), sdk.db (history) |
| `example-sdk` | B (SDK) | Needs sdk.db (counters), sdk.ton (balance), sdk.telegram (messages) |

**Note:** Inline bots and WebApp auth plugins use `context.bridge` directly (Pattern A with `permissions: ["bridge"]`). They do NOT need the SDK unless they also need TON payments or database.

---

## Step 2 — Present the plan

Show this to the user and **wait for approval**:

```
Plugin: [name]
Pattern: [A (simple) | B (SDK)]
Reason: [why SDK is/isn't needed]

Tools:
| Tool        | Description              | Params                              |
|-------------|--------------------------|-------------------------------------|
| `tool_name` | What it does             | `query` (string, required), `index` (int, optional) |

SDK features used: [none | sdk.ton, sdk.db, sdk.telegram, sdk.log, sdk.pluginConfig]

Files:
- plugins/[name]/index.js
- plugins/[name]/manifest.json
- plugins/[name]/README.md
- registry.json (update)
```

Do NOT build until the user says go.

---

## Step 3 — Build

Create all files in `plugins/[name]/` following the patterns below.

### index.js

**ESM only** — always `export const tools`, never `module.exports`.

Choose the right pattern:

---

#### Pattern A: Simple tools (array)

For plugins that don't need TON, Telegram messaging, or persistent database.

Reference: `plugins/example/index.js`

```javascript
const myTool = {
  name: "tool_name",
  description: "The LLM reads this to decide when to call the tool. Be specific.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search query" },
      index: { type: "integer", description: "Which result (0 = first)", minimum: 0, maximum: 49 },
    },
    required: ["query"],
  },
  execute: async (params, context) => {
    try {
      // logic here
      return { success: true, data: { result: "..." } };
    } catch (err) {
      return { success: false, error: String(err.message || err).slice(0, 500) };
    }
  },
};

export const tools = [myTool];
```

---

#### Pattern B: SDK tools (function)

For plugins that need TON blockchain, Telegram messaging, isolated database, or config.

Reference: `plugins/example-sdk/index.js` (basic), `plugins/casino/index.js` (advanced)

```javascript
export const manifest = {
  name: "my-plugin",
  version: "1.0.0",
  sdkVersion: ">=1.0.0",
  description: "What this plugin does",
  defaultConfig: {
    some_setting: "default_value",
  },
};

// Optional: export migrate() to get sdk.db (isolated SQLite per plugin)
export function migrate(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS my_table (
    id TEXT PRIMARY KEY,
    value TEXT
  )`);
}

export const tools = (sdk) => [
  {
    name: "my_tool",
    description: "What this tool does",
    parameters: { type: "object", properties: {}, },
    scope: "always", // "always" | "dm-only" | "group-only"
    execute: async (params, context) => {
      try {
        // SDK namespaces:
        // sdk.ton      — getAddress(), getBalance(), getPrice(), sendTON(), getTransactions(), verifyPayment()
        // sdk.telegram — sendMessage(), editMessage(), sendDice(), sendReaction(), getMessages(), getMe(), getRawClient()
        // sdk.db       — better-sqlite3 instance (null if no migrate())
        // sdk.log      — info(), warn(), error(), debug()
        // sdk.config   — sanitized app config (no secrets)
        // sdk.pluginConfig — plugin-specific config from config.yaml merged with defaultConfig

        const balance = await sdk.ton.getBalance();
        sdk.log.info(`Balance: ${balance?.balance}`);
        return { success: true, data: { balance: balance?.balance } };
      } catch (err) {
        return { success: false, error: String(err.message || err).slice(0, 500) };
      }
    },
  },
];

// Optional: runs after Telegram bridge connects
export async function start(ctx) {
  // ctx.bridge, ctx.db, ctx.config, ctx.pluginConfig, ctx.log
}

// Optional: runs on shutdown
export async function stop() {
  // cleanup
}
```

**SDK error handling:**
- Read methods (`getBalance`, `getPrice`, `getTransactions`, `getMessages`) return `null` or `[]` on failure — never throw
- Write methods (`sendTON`, `sendMessage`, `sendDice`) throw `PluginSDKError` with `.code`:
  - `WALLET_NOT_INITIALIZED` — wallet not set up
  - `INVALID_ADDRESS` — bad TON address
  - `BRIDGE_NOT_CONNECTED` — Telegram not ready
  - `OPERATION_FAILED` — generic failure

---

#### GramJS import (only if plugin needs raw Telegram MTProto)

```javascript
import { createRequire } from "node:module";
import { realpathSync } from "node:fs";

const _require = createRequire(realpathSync(process.argv[1]));
const { Api } = _require("telegram");
```

With SDK plugins, prefer `sdk.telegram.getRawClient()` over `context.bridge.getClient().getClient()`.

#### API fetch helper (for plugins calling external APIs)

```javascript
const API_BASE = "https://api.example.com";

async function apiFetch(path, params = {}) {
  const url = new URL(path, API_BASE);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${await res.text().catch(() => "")}`);
  }
  return res.json();
}
```

#### Inline bot pattern (@pic, @vid, @gif, @DeezerMusicBot…)

```javascript
execute: async (params, context) => {
  try {
    const client = context.bridge.getClient().getClient();
    const bot = await client.getEntity("BOT_USERNAME");
    const peer = await client.getInputEntity(context.chatId);

    const results = await client.invoke(
      new Api.messages.GetInlineBotResults({
        bot, peer, query: params.query, offset: "",
      })
    );

    if (!results.results || results.results.length === 0) {
      return { success: false, error: `No results found for "${params.query}"` };
    }

    const index = params.index ?? 0;
    if (index >= results.results.length) {
      return { success: false, error: `Only ${results.results.length} results, index ${index} out of range` };
    }

    const chosen = results.results[index];

    await client.invoke(
      new Api.messages.SendInlineBotResult({
        peer,
        queryId: results.queryId,
        id: chosen.id,
        randomId: BigInt(Math.floor(Math.random() * 2 ** 62)),
      })
    );

    return {
      success: true,
      data: {
        query: params.query,
        sent_index: index,
        total_results: results.results.length,
        title: chosen.title || null,
        description: chosen.description || null,
        type: chosen.type || null,
      },
    };
  } catch (err) {
    return { success: false, error: String(err.message || err).slice(0, 500) };
  }
}
```

#### WebApp auth pattern (Telegram-authenticated APIs)

```javascript
let cachedAuth = null;
let cachedAuthTime = 0;
const AUTH_TTL = 30 * 60 * 1000;

async function getAuth(bridge, botUsername, webAppUrl) {
  if (cachedAuth && Date.now() - cachedAuthTime < AUTH_TTL) return cachedAuth;
  const client = bridge.getClient().getClient();
  const bot = await client.getEntity(botUsername);
  const result = await client.invoke(
    new Api.messages.RequestWebView({ peer: bot, bot, platform: "android", url: webAppUrl })
  );
  const fragment = new URL(result.url).hash.slice(1);
  const initData = new URLSearchParams(fragment).get("tgWebAppData");
  if (!initData) throw new Error("Failed to extract tgWebAppData");
  cachedAuth = initData;
  cachedAuthTime = Date.now();
  return cachedAuth;
}
```

#### Payment verification pattern (SDK)

Reference: `plugins/casino/index.js`

```javascript
export function migrate(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS used_transactions (
    tx_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    amount REAL NOT NULL,
    game_type TEXT NOT NULL,
    used_at INTEGER NOT NULL DEFAULT (unixepoch())
  )`);
}

export const tools = (sdk) => [{
  name: "verify_and_process",
  execute: async (params, context) => {
    const payment = await sdk.ton.verifyPayment({
      amount: params.amount,
      memo: params.username,
      gameType: "my_service",
      maxAgeMinutes: 10,
    });

    if (!payment.verified) {
      const address = sdk.ton.getAddress();
      return { success: false, error: `Send ${params.amount} TON to ${address} with memo: ${params.username}` };
    }

    // Process the verified payment...
    // payment.playerWallet — sender's address (for refunds/payouts)
    // payment.compositeKey — unique tx identifier
    // payment.amount — verified amount

    return { success: true, data: { verified: true, from: payment.playerWallet } };
  }
}];
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
  "tools": [
    { "name": "tool_name", "description": "Short description" }
  ],
  "permissions": [],
  "tags": ["tag1", "tag2"],
  "repository": "https://github.com/TONresistor/teleton-plugins",
  "funding": null
}
```

Notes:
- Add `"sdkVersion": ">=1.0.0"` **only** if using `tools(sdk)` (Pattern B)
- Add `"permissions": ["bridge"]` only if using `context.bridge` directly (not needed with SDK)
- `permissions` is `[]` for most plugins

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

- "Natural language prompt the user would say"
- "Another example prompt"

## Tool schema

### tool_name

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `query` | string | Yes | — | Search query |
```

### registry.json

Add to the `plugins` array:

```json
{
  "id": "PLUGIN_ID",
  "name": "Display Name",
  "description": "One-line description",
  "author": "teleton",
  "tags": ["tag1", "tag2"],
  "path": "plugins/PLUGIN_ID"
}
```

---

## Step 4 — Install and commit

1. Copy: `cp -r plugins/PLUGIN_ID ~/.teleton/plugins/`
2. Commit: `git add plugins/PLUGIN_ID/ registry.json && git commit -m "PLUGIN_NAME: short description"`
3. Ask user if they want to push.

---

## Rules

- **ESM only** — `export const tools`, never `module.exports`
- **JS only** — the plugin loader reads `.js` files only
- **Tool names** — `snake_case`, globally unique across all plugins, prefixed with plugin name
- **Defaults** — use `??` (nullish coalescing), never `||`
- **Errors** — always try/catch in execute, return `{ success: false, error }`, slice to 500 chars
- **Timeouts** — `AbortSignal.timeout(15000)` on all external fetch calls
- **No npm deps** — use native `fetch`, no external packages
- **GramJS** — always `createRequire(realpathSync(process.argv[1]))`, never `import from "telegram"`
- **Client chain** — `context.bridge.getClient().getClient()` OR `sdk.telegram.getRawClient()` for raw GramJS
- **SDK preferred** — when using SDK, prefer `sdk.telegram` over `context.bridge`, `sdk.db` over `context.db`
- **Scope** — add `scope: "dm-only"` on financial/private tools, `scope: "group-only"` on moderation tools
- **SDK decision** — only use Pattern B if the plugin actually needs TON, Telegram messaging, database, or config (see decision tree)

## Context object

Available in `execute(params, context)` for **all** plugins (Pattern A and B):

| Field | Type | Description |
|-------|------|-------------|
| `bridge` | TelegramBridge | Send messages, reactions, media (low-level) |
| `db` | Database | SQLite (shared — prefer `sdk.db` for isolation) |
| `chatId` | string | Current chat ID |
| `senderId` | number | Telegram user ID of caller |
| `isGroup` | boolean | `true` = group, `false` = DM |
| `config` | Config? | Agent config (may be undefined) |

## SDK object

Available **only** in `tools(sdk)` function plugins (Pattern B):

| Namespace | Methods |
|-----------|---------|
| `sdk.ton` | `getAddress()`, `getBalance(addr?)`, `getPrice()`, `sendTON(to, amount, comment?)`, `getTransactions(addr, limit?)`, `verifyPayment(params)` |
| `sdk.telegram` | `sendMessage(chatId, text, opts?)`, `editMessage(chatId, messageId, text, opts?)`, `sendDice(chatId, emoticon, replyToId?)`, `sendReaction(chatId, messageId, emoji)`, `getMessages(chatId, limit?)`, `getMe()`, `isAvailable()`, `getRawClient()` |
| `sdk.db` | `better-sqlite3` instance (requires `export function migrate(db)`) |
| `sdk.log` | `info()`, `warn()`, `error()`, `debug()` |
| `sdk.config` | Sanitized app config (no API keys) |
| `sdk.pluginConfig` | Plugin config from `config.yaml` merged with `manifest.defaultConfig` |

## Bridge methods (legacy)

Only needed for Pattern A plugins that use `context.bridge` directly:

```javascript
await context.bridge.sendMessage({ chatId, text, replyToId?, inlineKeyboard? });
await context.bridge.sendReaction(chatId, messageId, emoji);
await context.bridge.editMessage({ chatId, messageId, text, inlineKeyboard? });
await context.bridge.setTyping(chatId);
const msgs = await context.bridge.getMessages(chatId, limit);
const peer = context.bridge.getPeer(chatId);
const gramjs = context.bridge.getClient().getClient();
```
