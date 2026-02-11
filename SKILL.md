# Teleton Plugin Builder

Build plugins for [Teleton](https://github.com/TONresistor/teleton-agent), the Telegram AI agent on TON. Ask the user what plugin or tools they want to build, then follow this workflow.

- **Agent runtime**: [github.com/TONresistor/teleton-agent](https://github.com/TONresistor/teleton-agent) — core agent, plugin loader, bridge, wallet
- **Plugin directory**: [github.com/TONresistor/teleton-plugins](https://github.com/TONresistor/teleton-plugins) — community plugins
- **Plugin dev guide**: [CONTRIBUTING.md](CONTRIBUTING.md)

---

## Workflow

1. **Ask** the user what they want (plugin name, what it does, which API or bot)
2. **Plan** — present a structured plan (see below) and ask for validation
3. **Build** — create all files once the user approves
4. **Install** — copy to `~/.teleton/plugins/` and restart

---

## Step 1 — Understand the request

Determine:

- **Plugin name** — short, lowercase folder name (e.g. `pic`, `deezer`, `weather`)
- **Plugin type**:
  - **Inline bot** — wraps a Telegram inline bot (@pic, @vid, @gif, @DeezerMusicBot…)
  - **Public API** — calls an external REST API, no auth
  - **Auth API** — external API with Telegram WebApp auth
  - **On-chain** — signs and sends TON transactions from the agent wallet
  - **Local logic** — pure JavaScript, no external calls
- **Tools** — list of tool names, what each does, parameters
- **Does it need GramJS?** — yes for inline bots and WebApp auth
- **Does it need wallet signing?** — yes for on-chain plugins

---

## Step 2 — Present the plan

Show this to the user and **wait for approval**:

```
Plugin: [name]
Type: [Inline bot | Public API | Auth API | On-chain | Local logic]

Tools:
| Tool        | Description              | Params                              |
|-------------|--------------------------|-------------------------------------|
| `tool_name` | What it does             | `query` (string, required), `index` (int, optional) |

Files:
- plugins/[name]/index.js
- plugins/[name]/manifest.json
- plugins/[name]/README.md
- registry.json (update)
```

Do NOT build until the user says go.

---

## Step 3 — Build

Create all files in `plugins/[name]/`.

### index.js

**ESM only** — always `export const tools = [...]`, never `module.exports`.

#### GramJS import (only if plugin needs Telegram MTProto)

```javascript
import { createRequire } from "node:module";
import { realpathSync } from "node:fs";

const _require = createRequire(realpathSync(process.argv[1]));
const { Api } = _require("telegram");
```

#### Tool definition

```javascript
const myTool = {
  name: "prefix_tool_name",
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
      const index = params.index ?? 0;
      // logic here
      return { success: true, data: { result: "..." } };
    } catch (err) {
      return { success: false, error: String(err.message || err).slice(0, 500) };
    }
  },
};

export const tools = [myTool];
```

#### Inline bot pattern

See `plugins/pic/index.js` for a complete example.

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

#### Public API pattern

See `plugins/giftstat/index.js` for a complete example.

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

#### WebApp auth pattern (Telegram-authenticated APIs)

See `plugins/gaspump/index.js` for a complete example.

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

// Auth fetch with retry on expiry
async function authFetch(bridge, path, opts = {}) {
  const doFetch = async (auth) => {
    const res = await fetch(new URL(path, API_BASE), {
      ...opts,
      headers: { ...opts.headers, Authorization: auth },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`API error: ${res.status} ${text}`);
    }
    return res.json();
  };

  try {
    return await doFetch(await getAuth(bridge, "botUsername", "https://webapp.url"));
  } catch (err) {
    if (/permission denied|unauthorized|403|401/i.test(err.message)) {
      cachedAuth = null;
      return await doFetch(await getAuth(bridge, "botUsername", "https://webapp.url"));
    }
    throw err;
  }
}
```

#### On-chain / wallet signing pattern (TON transactions)

See `plugins/stormtrade/index.js` for a complete example.

```javascript
import { createRequire } from "node:module";
import { readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const _require = createRequire(realpathSync(process.argv[1]));
const { Address, beginCell, SendMode } = _require("@ton/core");
const { WalletContractV5R1, TonClient, internal } = _require("@ton/ton");
const { mnemonicToPrivateKey } = _require("@ton/crypto");

const WALLET_FILE = join(homedir(), ".teleton", "wallet.json");

async function getWalletAndClient() {
  const walletData = JSON.parse(readFileSync(WALLET_FILE, "utf-8"));
  const keyPair = await mnemonicToPrivateKey(walletData.mnemonic);
  const wallet = WalletContractV5R1.create({ workchain: 0, publicKey: keyPair.publicKey });

  let endpoint;
  try {
    const { getHttpEndpoint } = _require("@orbs-network/ton-access");
    endpoint = await getHttpEndpoint({ network: "mainnet" });
  } catch {
    endpoint = "https://toncenter.com/api/v2/jsonRPC";
  }

  const client = new TonClient({ endpoint });
  const contract = client.open(wallet);
  return { wallet, keyPair, client, contract };
}

// Usage in execute:
const { wallet, keyPair, client, contract } = await getWalletAndClient();
const seqno = await contract.getSeqno();
await contract.sendTransfer({
  seqno,
  secretKey: keyPair.secretKey,
  sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
  messages: [
    internal({ to: txParams.to, value: txParams.value, body: txParams.body, bounce: true }),
  ],
});
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

> Set `"permissions": ["bridge"]` only if the plugin uses `context.bridge`. Default is `[]`.
> The `id` field **must match** the plugin folder name.

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

## Step 4 — Install and verify

```bash
cp -r plugins/PLUGIN_ID ~/.teleton/plugins/
```

Verify the plugin loads:

```bash
node -e "import('./plugins/PLUGIN_ID/index.js').then(m => console.log(m.tools.length, 'tools exported'))"
```

After restarting Teleton, check console output:

```
Plugin "PLUGIN_ID": N tools registered    <- success
```

Commit if the user wants: `git add plugins/PLUGIN_ID/ registry.json && git commit -m "PLUGIN_NAME: short description"`

---

## Advanced patterns

### Factory function for similar endpoints

When multiple tools share the same fetch/paginate logic, use a factory:

```javascript
function makePaginatedTool(name, description, endpoint, extraParams = {}) {
  return {
    name,
    description,
    parameters: {
      type: "object",
      properties: {
        limit: { type: "integer", description: "Results per page", minimum: 1, maximum: 100 },
        offset: { type: "integer", description: "Pagination offset", minimum: 0 },
        ...extraParams,
      },
      required: [],
    },
    execute: async (params) => {
      try {
        const data = await apiFetch(endpoint, { limit: params.limit ?? 20, offset: params.offset ?? 0 });
        return { success: true, data };
      } catch (err) {
        return { success: false, error: String(err.message || err).slice(0, 500) };
      }
    },
  };
}

export const tools = [
  makePaginatedTool("prefix_list_items", "List all items", "/items"),
  makePaginatedTool("prefix_list_users", "List all users", "/users"),
];
```

### Enum parameters

Use `enum` in JSON Schema for fixed option sets:

```javascript
properties: {
  direction: { type: "string", enum: ["long", "short"], description: "Trade direction" },
  order_type: { type: "string", enum: ["stopLoss", "takeProfit", "stopLimit"], description: "Order type" },
}
```

### Helper functions

Extract repeated logic into reusable helpers:

```javascript
function parseAmount(amount, vault) {
  const v = (vault ?? "usdt").toLowerCase();
  if (v === "usdt") return toStablecoin(Number(amount)); // 6 decimals
  return numToNano(Number(amount)); // 9 decimals
}
```

### Multi-step operations

Track each step and return context for the LLM:

```javascript
execute: async (params, context) => {
  const steps = [];
  try {
    const auth = await getAuth(context.bridge);
    steps.push("authenticated");

    const upload = await uploadImage(auth, params.image);
    steps.push(`image uploaded: ${upload.url}`);

    const token = await createToken(auth, { ...params, image_url: upload.url });
    steps.push(`token created: ${token.address}`);

    return { success: true, data: { ...token, steps } };
  } catch (err) {
    return { success: false, error: String(err.message || err).slice(0, 500), steps };
  }
}
```

### Parameter validation

Validate inputs explicitly before processing:

```javascript
if (params.sides < 2 || params.sides > 100) {
  return { success: false, error: "sides must be between 2 and 100" };
}
if (!Array.isArray(params.choices) || params.choices.length < 2) {
  return { success: false, error: "choices must have at least 2 items" };
}
```

---

## Rules

- **ESM only** — `export const tools`, never `module.exports`
- **JS only** — the plugin loader reads `.js` files only
- **Tool names** — `snake_case`, prefixed with plugin name or short unique prefix (e.g. `gas_`, `storm_`, `gift_`), globally unique
- **Folder = ID** — plugin folder name must match the `id` field in manifest.json
- **Permissions** — set `"permissions": ["bridge"]` in manifest.json if the plugin uses `context.bridge`, otherwise `[]`
- **Defaults** — use `??` (nullish coalescing), never `||`
- **Errors** — always try/catch in execute, return `{ success: false, error }`, slice errors to 500 chars
- **Timeouts** — `AbortSignal.timeout(15000)` on all external `fetch()` calls
- **No npm deps** — plugins cannot install packages. Use native `fetch` and runtime packages (`@ton/core`, `@ton/ton`, `@ton/crypto`, `telegram`)
- **GramJS** — always `createRequire(realpathSync(process.argv[1]))`, never `import from "telegram"`
- **Client chain** — `context.bridge.getClient().getClient()` for raw GramJS client

---

## Context object

| Field | Type | Description |
|-------|------|-------------|
| `bridge` | TelegramBridge | Telegram access — messages, reactions, media, raw GramJS MTProto |
| `db` | better-sqlite3 Database | SQLite instance at `~/.teleton/memory.db` for persistence |
| `chatId` | string | Current Telegram chat ID |
| `senderId` | number | Telegram user ID of caller |
| `isGroup` | boolean | `true` = group, `false` = DM |
| `config` | Config \| undefined | Agent YAML config (may be undefined) |

## Bridge methods

```javascript
// Send a message
await context.bridge.sendMessage({ chatId, text, replyToId?, inlineKeyboard? });

// Edit an existing message
await context.bridge.editMessage({ chatId, messageId, text, inlineKeyboard? });

// Send a reaction emoji
await context.bridge.sendReaction(chatId, messageId, emoji);

// Show typing indicator
await context.bridge.setTyping(chatId);

// Get recent messages (returns TelegramMessage[])
const msgs = await context.bridge.getMessages(chatId, limit);

// Get cached peer entity
const peer = context.bridge.getPeer(chatId);

// Get raw GramJS MTProto client (full Api.* namespace)
const gramjs = context.bridge.getClient().getClient();

// Get agent's own user ID / username
const myId = context.bridge.getOwnUserId();
const username = context.bridge.getUsername();
```

## Tool fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | **Yes** | Unique name across all plugins, `snake_case` with plugin prefix |
| `description` | string | **Yes** | What the tool does — the LLM reads this to decide when to call it |
| `parameters` | object | No | JSON Schema for params. Defaults to empty object if omitted |
| `execute` | async function | **Yes** | `(params, context) => Promise<{ success, data/error }>` |

## Return format

```javascript
// Success — data is serialized to JSON and fed back to the LLM
return { success: true, data: { /* anything */ } };

// Error — error string shown to LLM, always slice
return { success: false, error: String(err.message || err).slice(0, 500) };
```

## Runtime packages

Provided by the [Teleton runtime](https://github.com/TONresistor/teleton-agent) and available via `createRequire`:

| Package | Use case |
|---------|----------|
| `telegram` (GramJS) | MTProto client, `Api.*` namespace |
| `@ton/core` | Cell building, Address, beginCell, SendMode |
| `@ton/ton` | WalletContractV5R1, TonClient, internal |
| `@ton/crypto` | mnemonicToPrivateKey |
| `@orbs-network/ton-access` | Decentralized TON API endpoints |
| `better-sqlite3` | SQLite (accessed via `context.db`) |

Plugins **cannot** install their own npm packages. If an SDK is needed, it must be installed in the teleton runtime's `node_modules/`.

## Agent wallet

On-chain plugins sign transactions from `~/.teleton/wallet.json` (WalletContractV5R1, generated during `teleton setup`).

## Plugin loading

The agent loads plugins from `~/.teleton/plugins/` at startup ([source](https://github.com/TONresistor/teleton-agent/blob/main/src/agent/tools/plugin-loader.ts)):

1. Scans directory for `.js` files and `directory/index.js`
2. Dynamic `import()` each entry
3. Validates `tools` array with `name`, `description`, `execute`
4. Checks name collisions — first registered wins, collisions silently skipped
5. Load order: core tools → built-in modules → external plugins

## Example plugins

| Plugin | Type | Source |
|--------|------|--------|
| `example` | Local logic | `plugins/example/index.js` |
| `pic` | Inline bot | `plugins/pic/index.js` |
| `giftstat` | Public API | `plugins/giftstat/index.js` |
| `gaspump` | Auth API + On-chain | `plugins/gaspump/index.js` |
| `stormtrade` | On-chain + SDK | `plugins/stormtrade/index.js` |
