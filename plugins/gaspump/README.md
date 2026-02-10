# gaspump

Token launcher for [Gas111](https://gas111.com) on TON -- create, configure, and monitor meme tokens.

## Tools

| Tool | Description |
|------|-------------|
| `gas_login` | Log in with Telegram credentials |
| `gas_upload_image` | Upload token image (base64) |
| `gas_create_token` | Launch a new token |
| `gas_update_token` | Update social links on a token |
| `gas_token_info` | Get token details and status |
| `gas_token_search` | Search and list tokens |
| `gas_user_tokens` | List tokens created by a user |
| `gas_token_stats` | Get trading stats for a token |

## Install

```bash
mkdir -p ~/.teleton/plugins
cp -r plugins/gaspump ~/.teleton/plugins/
```

## Usage

Ask the AI:

- "Create a new token called PEPE with ticker $PEPE"
- "Upload this image for my token"
- "Check the status of token EQx..."
- "Search for tokens sorted by 24h volume"
- "Show all my tokens"
- "What are the trading stats for token EQx..."
- "Update the Twitter link on my token to https://x.com/mytoken"

## Token launch flow

1. Log in with `gas_login` (required for write operations)
2. Upload your token image with `gas_upload_image`
3. Create the token with `gas_create_token` (name, ticker, address, image URL)
4. Monitor with `gas_token_info` (check status, market cap, holders)
5. Add social links with `gas_update_token`

## Schemas

### gas_login

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `auth` | string | Yes | Telegram authorization token |
| `image_url` | string | No | Profile image URL |
| `ref_user_id` | integer | No | Referral user ID |

### gas_upload_image

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `auth` | string | Yes | Authorization token |
| `image_base64` | string | Yes | Base64-encoded image data |

### gas_create_token

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `auth` | string | Yes | Authorization token |
| `name` | string | Yes | Token name |
| `ticker` | string | Yes | Token ticker symbol |
| `token_address` | string | Yes | TON contract address |
| `image_url` | string | Yes | Image URL from gas_upload_image |
| `contract_version` | integer | Yes | Contract version number |
| `audio_url` | string | No | Audio URL for audio tokens |
| `description` | string | No | Token description |
| `tg_channel_link` | string | No | Telegram channel link |
| `tg_chat_link` | string | No | Telegram chat link |
| `twitter_link` | string | No | Twitter/X link |
| `website_link` | string | No | Website URL |
| `dextype` | string | No | DEX type |

### gas_update_token

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `auth` | string | Yes | Authorization token |
| `token_address` | string | Yes | Token contract address |
| `tg_channel_link` | string | No | Telegram channel link |
| `tg_chat_link` | string | No | Telegram chat link |
| `twitter_link` | string | No | Twitter/X link |
| `website_link` | string | No | Website URL |

### gas_token_info

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `token_address` | string | Yes | Token contract address |

### gas_token_search

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `search` | string | No | -- | Search by name or ticker |
| `sorting_field` | string | No | market_cap | market_cap, volume_24h, volume_1h, created_at, last_traded_at |
| `limit` | integer | No | 100 | Max results |
| `offset` | integer | No | 0 | Pagination offset |
| `telegram_id` | integer | No | -- | Filter by creator |
| `is_audio` | boolean | No | -- | Audio tokens only |
| `is_full` | boolean | No | -- | Fully bonded tokens only |

### gas_user_tokens

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `telegram_id` | integer | Yes | -- | Telegram user ID |
| `limit` | integer | No | 100 | Max results |
| `offset` | integer | No | 0 | Pagination offset |

### gas_token_stats

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `token_address` | string | Yes | Token contract address |

## API reference

This plugin wraps the [Gas111 API](https://api.gas111.com). Documentation: [api.gas111.com/docs](https://api.gas111.com/docs)
