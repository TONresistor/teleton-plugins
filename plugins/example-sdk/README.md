# example-sdk

SDK example plugin — demonstrates `tools(sdk)` with database, TON, and Telegram features.

Use this as a starting point for plugins that need blockchain or messaging access.

```bash
cp -r plugins/example-sdk plugins/your-plugin
```

## Tools

| Tool | Description |
|------|-------------|
| `sdk_greet` | Greet a user and track count in isolated database |
| `sdk_balance` | Check TON wallet balance and USD price |
| `sdk_announce` | Send a message with optional inline buttons (DM only) |

## Install

```bash
mkdir -p ~/.teleton/plugins
cp -r plugins/example-sdk ~/.teleton/plugins/
```

## Usage

Ask the AI:

- "Greet me"
- "What's the wallet balance?"
- "Send an announcement saying 'Hello world' with buttons"

## What this demonstrates

- **`tools(sdk)`** — receiving the SDK instead of using a plain array
- **`sdk.db`** — isolated SQLite database via `migrate()` export
- **`sdk.ton`** — wallet address, balance, and price (read methods return null on failure)
- **`sdk.telegram`** — sending messages with inline keyboards
- **`sdk.pluginConfig`** — reading config with defaults from `manifest.defaultConfig`
- **`sdk.log`** — prefixed logging
- **`scope: "dm-only"`** — restricting a tool to DMs only
- **Error handling** — catching `PluginSDKError` from write methods
- **Inline manifest** — `export const manifest` alongside `manifest.json`

## Configuration

Optional overrides in `~/.teleton/config.yaml`:

```yaml
plugins:
  example_sdk:
    greeting: "Hey"
```

Default: `"Hello"` (from `manifest.defaultConfig`).

## Schemas

### sdk_greet

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | Yes | — | Name to greet |

### sdk_balance

No parameters.

### sdk_announce

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `text` | string | Yes | — | Announcement text |
| `with_buttons` | boolean | No | false | Include inline buttons |
