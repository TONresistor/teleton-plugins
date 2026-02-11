# Contributing

Plugins are single folders with an `index.js` that exports a `tools` array. Fork, add your plugin, open a PR.

## Steps

1. Fork this repo
2. Create `plugins/your-plugin/index.js`
3. Add a `manifest.json` in your plugin folder (see below)
4. Export a `tools` array (ESM — `export const tools`)
5. Add a `README.md` in your plugin folder
6. Open a PR

## Plugin structure

```
plugins/your-plugin/
├── index.js         # Required — exports tools[]
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

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | **Yes** | Unique plugin identifier (lowercase, hyphens). Must match the folder name. |
| `name` | string | **Yes** | Human-readable display name shown in the registry. |
| `version` | string | **Yes** | Semver version string (e.g. `"1.0.0"`, `"2.3.1"`). |
| `description` | string | **Yes** | One-line description of what the plugin does. |
| `author` | object | **Yes** | Object with `name` (string) and `url` (string) fields. |
| `license` | string | **Yes** | SPDX license identifier (e.g. `"MIT"`, `"Apache-2.0"`). |
| `entry` | string | **Yes** | Entry point filename. Almost always `"index.js"`. |
| `teleton` | string | **Yes** | Minimum teleton version required (semver range, e.g. `">=1.0.0"`). |
| `tools` | array | **Yes** | Array of objects, each with `name` and `description` for every tool the plugin exports. |
| `permissions` | array | **Yes** | Empty array `[]` by default. Add `"bridge"` if the plugin uses `context.bridge`. |
| `tags` | array | No | Categories for discovery (e.g. `["defi", "ton", "trading"]`). |
| `repository` | string | No | URL to the plugin's source repository. |
| `funding` | string\|null | No | Funding URL or `null`. |

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

## Tool fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | **Yes** | Unique name across all plugins (e.g. `"weather_forecast"`) |
| `description` | string | **Yes** | LLM reads this to decide when to call your tool |
| `parameters` | object | No | JSON Schema for params. Defaults to empty object if omitted |
| `execute` | async function | **Yes** | `(params, context) => Promise<ToolResult>` |

## Return format

```js
// Success
return { success: true, data: { /* anything — this is what the LLM sees */ } };

// Error
return { success: false, error: "What went wrong" };
```

## Context object

Your `execute` function receives `(params, context)`. The context contains:

| Field | Type | Description |
|-------|------|-------------|
| `bridge` | TelegramBridge | Send messages, reactions, media via Telegram |
| `db` | Database | SQLite instance |
| `chatId` | string | Current chat ID |
| `senderId` | number | Telegram user ID of who triggered the tool |
| `isGroup` | boolean | `true` if group chat, `false` if DM |
| `config` | Config? | Agent configuration (may be undefined) |

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

### Bridge access

When your plugin needs Telegram MTProto access via the bridge, declare `"permissions": ["bridge"]` in your `manifest.json` and access the GramJS client like this:

```js
const client = context.bridge.getClient().getClient();
```

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
- **No npm deps** — plugins cannot add npm dependencies. Use native `fetch` and packages provided by the teleton runtime (`@ton/core`, `@ton/ton`, `@ton/crypto`, `telegram`)
- **Use `AbortSignal.timeout()`** on all `fetch()` calls — never let a network request hang without a timeout
- **GramJS** — always use `createRequire(realpathSync(process.argv[1]))` to import CJS packages, never `import from "telegram"`
- **Client chain** — `context.bridge.getClient().getClient()` for the raw GramJS MTProto client
- **Declare `permissions: ["bridge"]`** in `manifest.json` if your plugin uses `context.bridge`, otherwise `[]`
- Your tools are available in both DMs and group chats (no scope filtering for plugins)

## Local testing

To test a plugin without restarting Teleton, verify it loads and exports the correct number of tools:

```bash
node -e "import('./plugins/your-plugin/index.js').then(m => console.log(m.tools.length, 'tools exported'))"
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
