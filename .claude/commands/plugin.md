# /plugin — Teleton Plugin Builder

You are building a plugin for **Teleton**, a Telegram AI agent on TON. The user will describe what plugin or tools they want. Your job is to **plan, validate with the user, then build** the complete plugin.

## User input

The user's request is: $ARGUMENTS

If no arguments were provided, ask the user what plugin they want to build using AskUserQuestion.

---

## Step 1: Analyze the request

Determine from the user's description:

1. **Plugin name** — short, lowercase, used as folder name (e.g. `pic`, `deezer`, `weather`)
2. **Plugin type** — one of:
   - **Inline bot** — wraps a Telegram inline bot (@pic, @vid, @gif, @DeezerMusicBot, etc.)
   - **Public API** — calls an external REST API (no auth needed)
   - **Auth API** — calls an external API with Telegram WebApp auth
   - **Local logic** — pure JavaScript, no external calls
3. **Tools** — list of tool names, what each does, parameters needed
4. **Dependencies** — does it need GramJS (`Api` from `telegram`)? Does it need `context.bridge`?

---

## Step 2: Present the plan

Present a clear, structured plan to the user and **ask them to validate** before building. Use this format:

```
## Plugin: [name]
Type: [Inline bot | Public API | Auth API | Local logic]

### Tools

| Tool | Description | Params |
|------|-------------|--------|
| `tool_name` | What it does | `param1` (string, required), `param2` (int, optional) |

### Files to create
- plugins/[name]/index.js
- plugins/[name]/manifest.json
- plugins/[name]/README.md
- registry.json (update)

### Install
cp -r plugins/[name] ~/.teleton/plugins/
```

Use **AskUserQuestion** to ask the user to validate the plan or adjust it.

---

## Step 3: Build the plugin

Once the user validates, create all files following these **exact patterns**.

### 3.1 — index.js structure

#### If plugin needs GramJS (inline bots, WebApp auth):

```javascript
import { createRequire } from "node:module";
import { realpathSync } from "node:fs";

const _require = createRequire(realpathSync(process.argv[1]));
const { Api } = _require("telegram");
```

#### If plugin only calls external APIs:

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

#### Tool definition:

```javascript
const myTool = {
  name: "tool_name",
  description: "LLM reads this to decide when to call the tool. Be specific and clear.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "What this param does" },
      index: { type: "integer", description: "Optional param", minimum: 0, maximum: 49 },
    },
    required: ["query"],
  },
  execute: async (params, context) => {
    try {
      // ... logic ...
      return { success: true, data: { result: "..." } };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
};

export const tools = [myTool];
```

#### Inline bot pattern (for @pic, @vid, @gif, @DeezerMusicBot, etc.):

```javascript
execute: async (params, context) => {
  try {
    const client = context.bridge.getClient().getClient();
    const bot = await client.getEntity("BOT_USERNAME");
    const peer = await client.getInputEntity(context.chatId);

    const results = await client.invoke(
      new Api.messages.GetInlineBotResults({
        bot,
        peer,
        query: params.query,
        offset: "",
      })
    );

    if (!results.results || results.results.length === 0) {
      return { success: false, error: `No results found for "${params.query}"` };
    }

    const index = params.index ?? 0;
    if (index >= results.results.length) {
      return {
        success: false,
        error: `Only ${results.results.length} results available, index ${index} is out of range`,
      };
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

#### WebApp auth pattern (for bots that need Telegram auth):

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

### 3.2 — manifest.json

```json
{
  "id": "PLUGIN_ID",
  "name": "Display Name",
  "version": "1.0.0",
  "description": "One-line description",
  "author": {
    "name": "teleton",
    "url": "https://github.com/TONresistor"
  },
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

### 3.3 — README.md

```markdown
# Plugin Name

One-line description.

| Tool | Description |
|------|-------------|
| `tool_name` | What it does |

## Install

\`\`\`bash
mkdir -p ~/.teleton/plugins
cp -r plugins/PLUGIN_ID ~/.teleton/plugins/
\`\`\`

## Usage examples

- "Natural language prompt 1"
- "Natural language prompt 2"

## Tool schema

### tool_name

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `param` | string | Yes | — | What it is |
```

### 3.4 — registry.json

Add a new entry to the `plugins` array in `registry.json`:

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

## Step 4: Install and commit

After creating all files:

1. **Install**: `cp -r plugins/PLUGIN_ID ~/.teleton/plugins/`
2. **Commit**: `git add plugins/PLUGIN_ID/ registry.json && git commit -m "PLUGIN_NAME: short description"`
3. Ask user if they want to **push**.

---

## Rules

- **ESM only** — `export const tools`, never `module.exports`
- **JS only** — loader reads `.js` files only
- **Tool names** — snake_case, globally unique across all plugins
- **Defaults** — use `??` (nullish coalescing), never `||`
- **Errors** — always wrap execute in try/catch, return `{ success: false, error }`
- **Timeouts** — `AbortSignal.timeout(15000)` for all external API calls
- **No dependencies** — use native `fetch`, no npm packages
- **GramJS import** — always use `createRequire(realpathSync(process.argv[1]))` pattern
- **Context chain** — `context.bridge.getClient().getClient()` for raw GramJS client
- **Descriptions** — write tool descriptions for the LLM, be specific about what the tool does and when to use it

## Context object available to plugins

| Field | Type | Description |
|-------|------|-------------|
| `bridge` | TelegramBridge | Send messages, reactions, media via Telegram |
| `db` | Database | SQLite instance for persistence |
| `chatId` | string | Current chat ID |
| `senderId` | number | Telegram user ID of who triggered the tool |
| `isGroup` | boolean | `true` if group chat, `false` if DM |
| `config` | Config? | Agent configuration (may be undefined) |

## Bridge methods

```javascript
// Send message (with optional inline keyboard)
await context.bridge.sendMessage({ chatId, text, replyToId?, inlineKeyboard? });

// Send reaction
await context.bridge.sendReaction(chatId, messageId, emoji);

// Edit message
await context.bridge.editMessage({ chatId, messageId, text, inlineKeyboard? });

// Set typing indicator
await context.bridge.setTyping(chatId);

// Get messages
const msgs = await context.bridge.getMessages(chatId, limit);

// Get cached peer
const peer = context.bridge.getPeer(chatId);

// Get underlying client chain
const gramjs = context.bridge.getClient().getClient();
```
