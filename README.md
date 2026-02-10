# teleton-plugins

Community plugin directory for [Teleton](https://github.com/anthropics/tonnet-ai) — the Telegram AI agent on TON.

Drop a plugin in `~/.teleton/plugins/` and it's live. No build step, no config.

## How it works

Teleton loads every `.js` file (or `folder/index.js`) from `~/.teleton/plugins/` at startup.

Each plugin exports a `tools` array:

```js
export const tools = [
  {
    name: "my_tool",
    description: "What this tool does (the LLM reads this)",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" }
      },
      required: ["query"]
    },
    execute: async (params, context) => {
      // context = { bridge, db, chatId, senderId, isGroup, config }
      return { success: true, data: { result: "hello" } };
    }
  }
];
```

That's it. Your tool is now available to the AI agent.

## Install a plugin

```bash
# Copy any plugin from this repo into your plugins folder
cp -r plugins/example ~/.teleton/plugins/

# Restart Teleton
```

## Create a plugin

1. Fork this repo
2. Create `plugins/your-plugin/index.js` (or `index.ts`)
3. Export a `tools` array (see format below)
4. Add a short `README.md` in your plugin folder
5. Open a PR

### Plugin format

```
plugins/your-plugin/
├── index.js       # Required: exports tools[]
└── README.md      # Required: what it does, how to configure
```

### Tool interface

```ts
{
  name: string;            // Unique name, e.g. "weather_forecast"
  description: string;     // LLM-facing description
  parameters: object;      // JSON Schema for params
  execute: (params, context) => Promise<{ success: boolean; data?: any; error?: string }>;
  category?: "data-bearing" | "action";  // Optional
}
```

### Context object

Your `execute` function receives a `context` with:

| Field | Type | Description |
|-------|------|-------------|
| `bridge` | TelegramBridge | Send messages, reactions, media |
| `db` | Database | SQLite instance |
| `chatId` | string | Current chat |
| `senderId` | number | User who triggered the tool |
| `isGroup` | boolean | Group or DM |
| `config` | Config | Agent configuration |

### Rules

- Tool `name` must be unique across all plugins
- `execute` must return `{ success, data?, error? }`
- Keep `description` clear — the LLM uses it to decide when to call your tool
- No build step needed: plain JS works. If you write TypeScript, compile it first

## License

MIT
