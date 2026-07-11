# @pic — Inline Image Search

Search and send images using Telegram's [@pic](https://t.me/pic) inline bot (Yandex Image Search). Images are sent directly in the chat and appear "via @pic", exactly like typing `@pic query` in the Telegram input field.

| Tool | Description |
|------|-------------|
| `pic` | Search images via @pic and send one to the current chat |

## Install

```bash
mkdir -p ~/.teleton/plugins
cp -r plugins/pic ~/.teleton/plugins/
```

## Usage examples

- "Send me a picture of a sunset"
- "Find an image of the TON blockchain logo"
- "Send the third result for 'cute cat'"
- "Show me a photo of the Eiffel Tower"

## Tool schema

### pic

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `query` | string | Yes | — | Image search query (e.g. "sunset", "cute cat") |
| `index` | integer | No | 0 | Which result to send (0 = first, 1 = second, etc.) |
