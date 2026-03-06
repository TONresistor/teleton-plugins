# Code Patterns & Best Practices

Ready-to-use code templates for common plugin scenarios. For full SDK method signatures and types, read the [SDK README](https://github.com/TONresistor/teleton-agent/blob/main/packages/sdk/README.md).

## Table of Contents

- [GramJS / CJS Import](#gramjs--cjs-import)
- [Per-Plugin npm Dependencies](#per-plugin-npm-dependencies)
- [API Fetch with Timeout](#api-fetch-with-timeout)
- [Payment Verification Flow](#payment-verification-flow)
- [Inline Bot Mode](#inline-bot-mode)
- [Styled Keyboard Buttons](#styled-keyboard-buttons)
- [Database + Storage Patterns](#database--storage-patterns)
- [Secret Management](#secret-management)
- [Scheduled Messages](#scheduled-messages)
- [Media Handling](#media-handling)
- [Error Handling Patterns](#error-handling-patterns)
- [Anti-Patterns](#anti-patterns)

---

## GramJS / CJS Import

The teleton runtime is ESM-only, but some packages (GramJS, `@ton/core`) only ship CJS. Always use `createRequire` with `realpathSync`:

```javascript
import { createRequire } from "node:module";
import { realpathSync } from "node:fs";

const _require = createRequire(realpathSync(process.argv[1]));
const { Api } = _require("telegram");
const { Address } = _require("@ton/core");
```

**Never do this:**

```javascript
// WRONG — will fail at runtime
import { Api } from "telegram";
import { Address } from "@ton/core";
```

## Per-Plugin npm Dependencies

Plugins can have their own `package.json` for dependencies beyond what teleton provides (`@ton/core`, `@ton/ton`, `@ton/crypto`, `telegram`).

**Setup:**

```bash
cd plugins/your-plugin
npm init -y
npm install some-package
# Commit BOTH package.json AND package-lock.json
```

**Dual-require pattern** — separate core and plugin-local deps:

```javascript
import { createRequire } from "node:module";
import { realpathSync } from "node:fs";

// Core deps (provided by teleton runtime)
const _require = createRequire(realpathSync(process.argv[1]));
// Plugin-local deps (from your plugin's node_modules/)
const _pluginRequire = createRequire(import.meta.url);

const { Address } = _require("@ton/core");                              // core
const { getHttpEndpoint } = _pluginRequire("@orbs-network/ton-access"); // plugin-local
```

**Rules:**
- `package-lock.json` is **required** (loader skips install without it)
- Dependencies installed with `npm ci --ignore-scripts` (no postinstall scripts)
- `node_modules/` is gitignored — created automatically at startup
- If install fails (no network), plugin is skipped with a warning

## API Fetch with Timeout

**Always** use `AbortSignal.timeout()` on every `fetch()` call:

```javascript
execute: async (params, context) => {
  try {
    const res = await fetch(`https://api.example.com/data?q=${encodeURIComponent(params.query)}`, {
      signal: AbortSignal.timeout(15_000),
      headers: { "Accept": "application/json" },
    });
    if (!res.ok) {
      return { success: false, error: `API returned ${res.status}` };
    }
    const data = await res.json();
    return { success: true, data };
  } catch (err) {
    return { success: false, error: String(err.message || err).slice(0, 500) };
  }
}
```

**With secrets for authenticated APIs:**

```javascript
execute: async (params, context) => {
  const apiKey = sdk.secrets.require("API_KEY"); // throws SECRET_NOT_FOUND if missing
  try {
    const res = await fetch("https://api.example.com/data", {
      signal: AbortSignal.timeout(15_000),
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Accept": "application/json",
      },
    });
    if (!res.ok) return { success: false, error: `API ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err) {
    if (err.name === "PluginSDKError") {
      return { success: false, error: `${err.code}: ${err.message}` };
    }
    return { success: false, error: String(err.message || err).slice(0, 500) };
  }
}
```

## Payment Verification Flow

Complete pattern for pay-to-use features:

```javascript
export const tools = (sdk) => [
  {
    name: "myservice_pay",
    description: "Pay 1 TON to use the service. Returns the wallet address and memo to include.",
    scope: "dm-only",
    category: "data-bearing",
    parameters: { type: "object", properties: {} },
    execute: async (params, context) => {
      const address = sdk.ton.getAddress();
      if (!address) return { success: false, error: "Wallet not initialized" };

      const memo = `service-${context.senderId}-${Date.now()}`;
      return {
        success: true,
        data: {
          address,
          amount: "1.0",
          memo,
          instructions: `Send exactly 1 TON to ${address} with memo: ${memo}`,
        },
      };
    },
  },
  {
    name: "myservice_verify",
    description: "Verify payment and activate the service",
    scope: "dm-only",
    category: "action",
    parameters: {
      type: "object",
      properties: {
        memo: { type: "string", description: "Payment memo from myservice_pay" },
      },
      required: ["memo"],
    },
    execute: async (params, context) => {
      try {
        const result = await sdk.ton.verifyPayment({
          amount: 1.0,
          memo: params.memo,
          maxAgeMinutes: 30,
        });
        if (!result.verified) {
          return { success: false, error: result.error ?? "Payment not found" };
        }
        // Payment confirmed — activate service
        return {
          success: true,
          data: {
            verified: true,
            txHash: result.txHash,
            amount: result.amount,
          },
        };
      } catch (err) {
        return { success: false, error: String(err.message || err).slice(0, 500) };
      }
    },
  },
];
```

## Inline Bot Mode

Full inline bot plugin with queries and callback buttons. Requires `bot` in manifest.

```javascript
export const manifest = {
  name: "my-inline",
  version: "1.0.0",
  sdkVersion: ">=1.0.0",
  description: "Inline search bot",
  bot: {
    inline: true,       // enable onInlineQuery
    callbacks: true,    // enable onCallback
    rateLimits: {       // optional rate limits
      inlinePerMinute: 30,
      callbackPerMinute: 60,
    },
  },
};

export const tools = (sdk) => {
  // Register inline query handler — fires when user types @botname <query>
  sdk.bot.onInlineQuery(async (ctx) => {
    // ctx.query  — the search text
    // ctx.userId — who is querying
    // Return array of InlineResult objects
    return [
      {
        id: "1",
        type: "article",
        title: `Result for: ${ctx.query}`,
        description: "Tap to send",
        content: { text: `You searched for: ${ctx.query}` },
        replyMarkup: sdk.bot.keyboard([
          [
            { text: "Like", callback: "like:1", style: "success" },
            { text: "Dislike", callback: "dislike:1", style: "danger" },
          ],
        ]).toTL(), // .toTL() for GramJS colored buttons, .toGrammy() for Bot API
      },
    ];
  });

  // Register callback handler — fires on button presses matching the glob pattern
  sdk.bot.onCallback("like:*", async (ctx) => {
    // ctx.data    — full callback data (e.g. "like:1")
    // ctx.userId  — who pressed
    // ctx.match   — regex match groups (string[])
    await ctx.answer("Liked!"); // toast notification
    await ctx.editMessage("You liked this result.");
  });

  sdk.bot.onCallback("dislike:*", async (ctx) => {
    await ctx.answer("Disliked!");
    await ctx.editMessage("You disliked this result.");
  });

  // Optional: track which results users select
  sdk.bot.onChosenResult(async (ctx) => {
    sdk.log.info(`Chose result ${ctx.resultId} for query "${ctx.query}"`);
  });

  // Return tools array — can be empty if plugin is purely inline-driven
  return [
    {
      name: "myinline_stats",
      description: "Show inline bot usage stats",
      parameters: { type: "object", properties: {} },
      category: "data-bearing",
      execute: async (params, context) => {
        return { success: true, data: { botUsername: sdk.bot.username } };
      },
    },
  ];
};
```

**Key rules for inline mode:**
- `sdk.bot` is `null` unless manifest declares `bot` — always check or declare it
- Callback patterns are **glob-matched** and auto-prefixed with plugin name (no conflicts)
- Button styles: `"success"` (green), `"danger"` (red), `"primary"` (blue) — GramJS only, graceful fallback on Bot API
- `.toTL()` for GramJS styled buttons, `.toGrammy()` for standard Bot API keyboard

## Styled Keyboard Buttons

```javascript
// Build a keyboard with colored buttons
const kb = sdk.bot.keyboard([
  [
    { text: "Buy", callback: "buy", style: "success" },     // green
    { text: "Sell", callback: "sell", style: "danger" },     // red
  ],
  [
    { text: "Details", callback: "details", style: "primary" }, // blue
    { text: "Cancel", callback: "cancel" },                     // default
  ],
]);

// Use in inline results
return [{ id: "1", type: "article", title: "Trade", content: { text: "Choose action" }, replyMarkup: kb.toTL() }];

// Use in sendMessage (via inlineKeyboard option)
// Note: sendMessage uses raw button arrays, not sdk.bot.keyboard
await sdk.telegram.sendMessage(chatId, "Choose:", {
  inlineKeyboard: [
    [{ text: "Option A", callback_data: "a" }, { text: "Option B", callback_data: "b" }],
  ],
});
```

## Database + Storage Patterns

### When to use which

| Need | Use | Why |
|------|-----|-----|
| Structured data, queries, relations | `sdk.db` + `migrate()` | Full SQL power |
| Simple cache, rate limits, TTL | `sdk.storage` | No migration needed |
| Counters, scores, leaderboards | `sdk.db` | Aggregation queries |
| API response caching | `sdk.storage` with TTL | Auto-expiry |

### Database (sdk.db)

```javascript
export function migrate(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS scores (
    user_id TEXT PRIMARY KEY,
    points INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  )`);
}

export const tools = (sdk) => [{
  name: "myplugin_score",
  execute: async (params, context) => {
    const userId = String(context.senderId);
    sdk.db.prepare(
      `INSERT INTO scores (user_id, points) VALUES (?, 1)
       ON CONFLICT(user_id) DO UPDATE SET points = points + 1, updated_at = unixepoch()`
    ).run(userId);
    const row = sdk.db.prepare("SELECT points FROM scores WHERE user_id = ?").get(userId);
    return { success: true, data: { points: row.points } };
  },
}];
```

### Storage (sdk.storage)

```javascript
// Cache with 1-hour TTL (milliseconds)
const cached = sdk.storage.get("price_data");
if (cached) return { success: true, data: cached };

const fresh = await fetchPrice();
sdk.storage.set("price_data", fresh, { ttl: 3_600_000 });
return { success: true, data: fresh };

// Rate limiting
const key = `rate:${context.senderId}`;
if (sdk.storage.has(key)) {
  return { success: false, error: "Rate limited. Try again in 1 minute." };
}
sdk.storage.set(key, true, { ttl: 60_000 });
```

## Secret Management

**Declare secrets in manifest.json:**

```json
{
  "secrets": {
    "api_key": { "required": true, "description": "API key for the service" },
    "webhook_url": { "required": false, "description": "Optional webhook endpoint" }
  }
}
```

**Use in code:**

```javascript
// Throws SECRET_NOT_FOUND if missing — fail fast
const apiKey = sdk.secrets.require("api_key");

// Returns undefined if not set — for optional secrets
const webhook = sdk.secrets.get("webhook_url");

// Check existence
if (sdk.secrets.has("premium_key")) { /* premium features */ }
```

**Resolution order:** ENV variable (`YOURPLUGIN_API_KEY`) → secrets store (`~/.teleton/plugins/data/<name>.secrets.json`) → pluginConfig fallback.

## Scheduled Messages

```javascript
// Schedule a message for later
const msgId = await sdk.telegram.scheduleMessage(
  context.chatId,
  "Reminder: meeting in 5 minutes!",
  Math.floor(Date.now() / 1000) + 3600 // Unix timestamp, 1 hour from now
);

// List scheduled messages
const scheduled = await sdk.telegram.getScheduledMessages(context.chatId);

// Send a scheduled message immediately
await sdk.telegram.sendScheduledNow(context.chatId, msgId);

// Delete a scheduled message
await sdk.telegram.deleteScheduledMessage(context.chatId, msgId);
```

## Media Handling

```javascript
// Send photo with caption
await sdk.telegram.sendPhoto(context.chatId, "/path/to/image.jpg", {
  caption: "Check this out!",
});

// Send file
await sdk.telegram.sendFile(context.chatId, "/path/to/document.pdf", {
  caption: "Here's the report",
});

// Download media from a message
const buffer = await sdk.telegram.downloadMedia(context.chatId, messageId);
if (buffer) {
  // Process the buffer...
}

// Send typing indicator
await sdk.telegram.setTyping(context.chatId);
```

## Error Handling Patterns

### Standard pattern (all tools)

```javascript
execute: async (params, context) => {
  try {
    const result = await doSomething(params);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: String(err.message || err).slice(0, 500) };
  }
}
```

### SDK write methods (ton.sendTON, telegram.sendMessage, etc.)

```javascript
execute: async (params, context) => {
  try {
    await sdk.ton.sendTON(params.address, params.amount);
    return { success: true, data: { sent: true } };
  } catch (err) {
    if (err.name === "PluginSDKError") {
      // Known error codes: WALLET_NOT_INITIALIZED, INVALID_ADDRESS,
      // BRIDGE_NOT_CONNECTED, SECRET_NOT_FOUND, OPERATION_FAILED
      return { success: false, error: `${err.code}: ${err.message}` };
    }
    return { success: false, error: String(err.message || err).slice(0, 500) };
  }
}
```

### SDK read methods (getBalance, getMessages, etc.)

Read methods **never throw** — they return `null` or `[]`:

```javascript
const balance = await sdk.ton.getBalance();
if (!balance) {
  return { success: false, error: "Could not fetch balance" };
}
return { success: true, data: { balance: balance.balance } };
```

## Anti-Patterns

**Do NOT:**

```javascript
// WRONG: || for defaults (fails on 0, "", false)
const limit = params.limit || 10;
// CORRECT: ?? (nullish coalescing)
const limit = params.limit ?? 10;

// WRONG: fetch without timeout
const res = await fetch(url);
// CORRECT: always use AbortSignal.timeout
const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });

// WRONG: import GramJS as ESM
import { Api } from "telegram";
// CORRECT: createRequire
const { Api } = _require("telegram");

// WRONG: module.exports (CJS)
module.exports = { tools };
// CORRECT: ESM exports
export const tools = [...];

// WRONG: context.bridge when SDK available
await context.bridge.sendMessage(chatId, text);
// CORRECT: prefer SDK
await sdk.telegram.sendMessage(chatId, text);

// WRONG: context.db (shared, no isolation)
context.db.prepare("INSERT INTO ...").run();
// CORRECT: sdk.db (isolated per plugin)
sdk.db.prepare("INSERT INTO ...").run();

// WRONG: unsliced error messages (can flood LLM context)
return { success: false, error: err.message };
// CORRECT: slice to 500 chars
return { success: false, error: String(err.message || err).slice(0, 500) };

// WRONG: using sdk.bot without declaring bot in manifest
sdk.bot.onInlineQuery(...); // sdk.bot is null!
// CORRECT: declare bot capabilities in manifest first
export const manifest = { bot: { inline: true, callbacks: true } };
```
