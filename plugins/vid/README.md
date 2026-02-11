# @vid — Inline Video Search

Search and send videos using Telegram's [@vid](https://t.me/vid) inline bot. Videos are sent directly in the chat and appear "via @vid", exactly like typing `@vid query` in the Telegram input field.

| Tool | Description |
|------|-------------|
| `vid` | Search videos via @vid and send one to the current chat |

## Install

```bash
mkdir -p ~/.teleton/plugins
cp -r plugins/vid ~/.teleton/plugins/
```

## Usage examples

- "Send me a video of a cute cat"
- "Find a video about TON blockchain"
- "Send the second result for 'cooking tutorial'"

## Tool schema

### vid

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `query` | string | Yes | — | Video search query (e.g. "funny cat", "cooking tutorial") |
| `index` | integer | No | 0 | Which result to send (0 = first, 1 = second, etc.) |
