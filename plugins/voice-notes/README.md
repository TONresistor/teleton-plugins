# voice-notes

Transcribe voice messages and video notes using Telegram Premium built-in speech-to-text — no external APIs or keys required.

## Tools

| Tool | Description |
|------|-------------|
| `voice_transcribe` | Transcribe a voice message or video note to text using Telegram Premium |

## Requirements

- Telegram Premium on the account running teleton

## Install

```bash
mkdir -p ~/.teleton/plugins
cp -r plugins/voice-notes ~/.teleton/plugins/
```

Add to your `IDENTITY.md`:

```
When you see [🎤 voice msg_id=...] or [🎬 video_note msg_id=...], ALWAYS call `voice_transcribe` with the message_id to read what the user said.
```

## Usage

> (send a voice message)

> (send a video note)

The agent automatically transcribes the audio and responds to the content.

## Schemas

### voice_transcribe

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `message_id` | number | yes | -- | The msg_id number from the [🎤 voice msg_id=...] tag |

**Returns:** transcribed text of the voice message.

## How it works

Uses Telegram's native `messages.transcribeAudio` MTProto method available to Premium users. Transcription is done server-side by Telegram — supports all languages, no external APIs needed.
