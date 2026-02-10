# Contributing

Plugins are single folders with an `index.js` that exports a `tools` array. Fork, add your plugin, open a PR.

## Steps

1. Fork this repo
2. Create `plugins/your-plugin/index.js`
3. Export a `tools` array (ESM — `export const tools`)
4. Add a `README.md` in your plugin folder
5. Open a PR

## Plugin structure

```
plugins/your-plugin/
├── index.js       # exports tools[]
└── README.md      # what it does, how to use it
```

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

## Rules

- **ESM only** — use `export const tools`, not `module.exports`
- **JS only at runtime** — the loader only reads `.js` files. Write TypeScript if you want, but compile to `.js` first
- Tool `name` must be globally unique — if it collides with a built-in or another plugin, yours is silently skipped
- Your tools are available in both DMs and group chats (no scope filtering for plugins)

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
