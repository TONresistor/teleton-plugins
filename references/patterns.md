# SDK v2 implementation patterns

These examples use only public Teleton SDK v2 capabilities. The canonical method signatures live in
the [`@teleton-agent/sdk` README](https://github.com/TONresistor/teleton-agent/blob/dev/packages/sdk/README.md).

## External API read

```js
async function fetchJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Upstream returned ${response.status}`);
  return response.json();
}

export const tools = [
  {
    name: "sample_lookup",
    description: "Read a sample record",
    scope: "always",
    category: "data-bearing",
    parameters: {
      type: "object",
      properties: { id: { type: "string", minLength: 1, maxLength: 100 } },
      required: ["id"],
    },
    async execute({ id }) {
      try {
        return {
          success: true,
          data: await fetchJson(`https://api.example.com/items/${encodeURIComponent(id)}`),
        };
      } catch (error) {
        return { success: false, error: String(error?.message ?? error).slice(0, 500) };
      }
    },
  },
];
```

## Declared secret

```js
export const manifest = {
  name: "sample-auth",
  version: "1.0.0",
  sdkVersion: "^2.0.0",
  description: "Authenticated API example",
  secrets: {
    api_key: { required: true, description: "API key for the sample service" },
  },
};

export const tools = (sdk) => [
  {
    name: "sample_auth_profile",
    description: "Read the authenticated profile",
    scope: "admin-only",
    category: "data-bearing",
    parameters: { type: "object", properties: {} },
    async execute() {
      const apiKey = sdk.secrets.get("api_key");
      if (!apiKey) return { success: false, error: "API key is not configured" };
      const response = await fetch("https://api.example.com/profile", {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) return { success: false, error: `Upstream returned ${response.status}` };
      return { success: true, data: await response.json() };
    },
  },
];
```

## Isolated storage

```js
export const tools = (sdk) => [
  {
    name: "sample_counter_increment",
    description: "Increment the caller's isolated counter",
    scope: "always",
    category: "action",
    parameters: { type: "object", properties: {} },
    async execute(_params, context) {
      const key = `counter:${context.senderId}`;
      const value = sdk.storage.get(key) ?? 0;
      sdk.storage.set(key, value + 1);
      return { success: true, data: { count: value + 1 } };
    },
  },
];
```

## Explicit database migration

```js
export function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS records (
      id TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);
}

export const tools = (sdk) => [
  {
    name: "sample_record_get",
    description: "Read one isolated plugin record",
    scope: "admin-only",
    category: "data-bearing",
    parameters: {
      type: "object",
      properties: { id: { type: "string", minLength: 1, maxLength: 100 } },
      required: ["id"],
    },
    async execute({ id }) {
      const record = sdk.db.prepare("SELECT id, value, created_at FROM records WHERE id = ?").get(id);
      return { success: true, data: record ?? null };
    },
  },
];
```

Use placeholders for every value. Plugin databases are isolated; never attach or open Teleton's main
database.

## Telegram message

```js
export const tools = (sdk) => [
  {
    name: "sample_announce",
    description: "Send an announcement to the current chat",
    scope: "admin-only",
    category: "action",
    parameters: {
      type: "object",
      properties: { text: { type: "string", minLength: 1, maxLength: 2000 } },
      required: ["text"],
    },
    async execute({ text }, context) {
      const messageId = await sdk.telegram.sendMessage(context.chatId, text);
      return { success: true, data: { messageId } };
    },
  },
];
```

## TON read and transfer

```js
export const tools = (sdk) => [
  {
    name: "sample_ton_balance",
    description: "Read the configured wallet TON balance",
    scope: "admin-only",
    category: "data-bearing",
    parameters: { type: "object", properties: {} },
    async execute() {
      return { success: true, data: await sdk.ton.getBalance() };
    },
  },
  {
    name: "sample_ton_send",
    description: "Send a bounded TON transfer after explicit owner approval",
    scope: "admin-only",
    category: "action",
    parameters: {
      type: "object",
      properties: {
        to: { type: "string", minLength: 48, maxLength: 80 },
        amount: { type: "number", exclusiveMinimum: 0, maximum: 10 },
      },
      required: ["to", "amount"],
    },
    async execute({ to, amount }) {
      return { success: true, data: await sdk.ton.sendTON(to, amount) };
    },
  },
];
```

Never read or derive the mnemonic. If the public TON SDK cannot express the required transaction,
the plugin is not SDK v2 compatible yet.

## Lifecycle

```js
let timer;

export async function start(ctx) {
  timer = setInterval(() => ctx.log.debug("background tick"), 60_000);
  timer.unref?.();
}

export async function stop() {
  if (timer) clearInterval(timer);
  timer = undefined;
}
```

`start(ctx)` receives `sdk`, isolated `db`, sanitized `config`, `pluginConfig`, and `log`. It does not
receive a raw Telegram bridge.

## Anti-patterns

Do not:

```js
sdk.telegram.getRawClient();
context.bridge.getClient();
ctx.bridge.sendMessage();
readFileSync("~/.teleton/wallet.json");
process.env.UNRELATED_GLOBAL_SECRET;
```

Use public capabilities, declared secrets and isolated state. If a safe capability is unavailable,
quarantine the plugin instead of bypassing the SDK boundary.
