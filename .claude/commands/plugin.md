# Teleton Plugin Builder

You are building a plugin for **Teleton**, a Telegram AI agent on TON. The user describes what plugin they want via: $ARGUMENTS

If no arguments were provided, ask the user what plugin they want to build.

---

## Workflow

1. **Analyze** the request — determine plugin name, type, tools, params
2. **Plan** — present a structured plan and **ask user to validate** before building
3. **Build** — create all files once approved
4. **Install** — copy to `~/.teleton/plugins/`, commit, ask if push

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

---

## Step 2 — Present the plan

Show this to the user and **wait for approval**:

```
Plugin: [name]
Type: [Inline bot | Public API | Auth API | Local logic]

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

Create all files in `plugins/[name]/` following the patterns below.

### index.js

**ESM only** — always `export const tools = [...]`, never `module.exports`.

#### GramJS import (only if plugin needs Telegram MTProto)

```javascript
import { createRequire } from "node:module";
import { realpathSync } from "node:fs";

const _require = createRequire(realpathSync(process.argv[1]));
const { Api } = _require("telegram");
```

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

#### Tool definition

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
      return { success: false, error: err.message };
    }
  },
};

export const tools = [myTool];
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
    return { success: false, error: err.message };
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
  "permissions": ["bridge"],
  "tags": ["tag1", "tag2"],
  "repository": "https://github.com/TONresistor/teleton-plugins",
  "funding": null
}
```

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
- **Tool names** — `snake_case`, globally unique across all plugins
- **Defaults** — use `??` (nullish coalescing), never `||`
- **Errors** — always try/catch in execute, return `{ success: false, error }`
- **Timeouts** — `AbortSignal.timeout(15000)` on all external calls
- **No npm deps** — use native `fetch`, no external packages
- **GramJS** — always `createRequire(realpathSync(process.argv[1]))`, never `import from "telegram"`
- **Client chain** — `context.bridge.getClient().getClient()` for raw GramJS client

## Context object

| Field | Type | Description |
|-------|------|-------------|
| `bridge` | TelegramBridge | Send messages, reactions, media |
| `db` | Database | SQLite for persistence |
| `chatId` | string | Current chat ID |
| `senderId` | number | Telegram user ID of caller |
| `isGroup` | boolean | `true` = group, `false` = DM |
| `config` | Config? | Agent config (may be undefined) |

## Bridge methods

```javascript
await context.bridge.sendMessage({ chatId, text, replyToId?, inlineKeyboard? });
await context.bridge.sendReaction(chatId, messageId, emoji);
await context.bridge.editMessage({ chatId, messageId, text, inlineKeyboard? });
await context.bridge.setTyping(chatId);
const msgs = await context.bridge.getMessages(chatId, limit);
const peer = context.bridge.getPeer(chatId);
const gramjs = context.bridge.getClient().getClient();
```
