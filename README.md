# teleton-plugins

Community plugin directory for [Teleton](https://github.com/TONresistor/tonnet-ai) — the Telegram AI agent on TON.

Drop a plugin in `~/.teleton/plugins/` and it's live. No build step, no config.

## How it works

```
User message → LLM reads your tool's description
  → LLM decides to call it → execute(params, context) runs
  → result sent back to LLM → LLM responds to user
```

Teleton loads every `.js` file (or `folder/index.js`) from `~/.teleton/plugins/` at startup. Each plugin exports a `tools` array:

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

## Install a plugin

```bash
# Create plugins folder if it doesn't exist
mkdir -p ~/.teleton/plugins

# Copy any plugin from this repo
cp -r plugins/example ~/.teleton/plugins/

# Restart Teleton
```

## Create a plugin

1. Fork this repo
2. Create `plugins/your-plugin/index.js`
3. Export a `tools` array
4. Add a short `README.md` in your plugin folder
5. Open a PR

### Plugin structure

```
plugins/your-plugin/
├── index.js       # Required — exports tools[]
└── README.md      # Required — what it does, how to use it
```

### Tool fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | **Yes** | Unique name across all plugins (e.g. `"weather_forecast"`) |
| `description` | string | **Yes** | LLM reads this to decide when to call your tool |
| `parameters` | object | No | JSON Schema for params. Defaults to empty object if omitted |
| `execute` | async function | **Yes** | `(params, context) => Promise<ToolResult>` |

### Return format

```js
// Success
return { success: true, data: { /* anything — this is what the LLM sees */ } };

// Error
return { success: false, error: "What went wrong" };
```

### Context object

Your `execute` function receives `(params, context)`. The context contains:

| Field | Type | Description |
|-------|------|-------------|
| `bridge` | TelegramBridge | Send messages, reactions, media via Telegram |
| `db` | Database | SQLite instance |
| `chatId` | string | Current chat ID |
| `senderId` | number | Telegram user ID of who triggered the tool |
| `isGroup` | boolean | `true` if group chat, `false` if DM |
| `config` | Config? | Agent configuration (may be undefined) |

### Rules

- **ESM only** — use `export const tools`, not `module.exports`
- **JS only at runtime** — the loader only reads `.js` files. Write TypeScript if you want, but compile to `.js` first
- Tool `name` must be globally unique — if it collides with a built-in or another plugin, yours is silently skipped
- Your tools are available in both DMs and group chats (no scope filtering for plugins)

## Verify it works

After installing a plugin and restarting Teleton, check the console output:

```
🔌 Plugin "example": 2 tools registered     ← success
⚠️  Plugin "my-plugin": no 'tools' array exported, skipping  ← missing export
⚠️  Plugin "my-plugin": tool "foo" missing 'execute' function, skipping  ← bad tool
❌ Plugin "my-plugin" failed to load: <error>  ← syntax error or crash
```

If you see the 🔌 line with your plugin name, you're good.

## License

MIT
