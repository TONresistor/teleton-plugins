# @DeezerMusicBot — Inline Music Search

Search and send music tracks using Telegram's [@DeezerMusicBot](https://t.me/DeezerMusicBot) inline bot. Tracks are sent directly in the chat and appear "via @DeezerMusicBot", exactly like typing `@DeezerMusicBot query` in the Telegram input field.

| Tool | Description |
|------|-------------|
| `deezer` | Search music on Deezer and send a track to the current chat |

## Install

```bash
mkdir -p ~/.teleton/plugins
cp -r plugins/deezer ~/.teleton/plugins/
```

## Usage examples

- "Send me Bohemian Rhapsody by Queen"
- "Find a track by Daft Punk"
- "Send the second result for 'Stromae Papaoutai'"
- "Play some music from The Weeknd"

## Tool schema

### deezer

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `query` | string | Yes | — | Music search query — artist, song title, or album |
| `index` | integer | No | 0 | Which result to send (0 = first, 1 = second, etc.) |
