# @vid — Inline YouTube Search

Search and send YouTube videos using Telegram's [@vid](https://t.me/vid) inline bot. Videos are sent directly in the chat and appear "via @vid", exactly like typing `@vid query` in the Telegram input field.

| Tool | Description |
|------|-------------|
| `vid` | Search YouTube videos via @vid and send one to the current chat |

## Install

```bash
mkdir -p ~/.teleton/plugins
cp -r plugins/vid ~/.teleton/plugins/
```

## Usage examples

- "Send me a YouTube video about TON blockchain"
- "Find a video of a cooking tutorial"
- "Send the second result for 'funny cat compilation'"

## Tool schema

### vid

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `query` | string | Yes | — | YouTube video search query (e.g. "funny cat", "cooking tutorial") |
| `index` | integer | No | 0 | Which result to send (0 = first, 1 = second, etc.) |
