# gaspump

Token launcher and trader for [Gas111](https://gas111.com) on TON -- create, trade, and monitor meme tokens.

Auth is handled automatically via Telegram WebApp -- no manual tokens needed.

## Tools

| Tool | Description |
|------|-------------|
| `gas_launch_token` | Launch a new token (login, upload, deploy, register -- all in one) |
| `gas_buy` | Buy tokens on a bonding curve |
| `gas_sell` | Sell tokens back to bonding curve |
| `gas_portfolio` | Agent's token portfolio and balances |
| `gas_token_info` | Get token details and status |
| `gas_token_search` | Search and list tokens |
| `gas_user_tokens` | List tokens created by a user |
| `gas_token_stats` | Get trading stats for a token |
| `gas_holders` | List token holders |
| `gas_top_traders` | Top traders for a token (PnL, volume) |
| `gas_price_chart` | Price history chart data |
| `gas_king` | Current King of the Hill token |
| `gas_update_token` | Update social links on a token |

## Install

```bash
mkdir -p ~/.teleton/plugins
cp -r plugins/gaspump ~/.teleton/plugins/
```

## Usage

Ask the AI:

- "Launch a token called PEPE with this image"
- "Buy 2 TON of token EQx..."
- "Sell all my tokens on EQx..."
- "Show my portfolio"
- "Who are the top traders on EQx...?"
- "What's the current King of the Hill?"
- "Check the status of token EQx..."
- "Search for tokens sorted by 24h volume"

## Token launch flow

1. Provide name, ticker, image (base64 or URL), and optional description
2. `gas_launch_token` does everything: login, upload image, deploy on-chain, register on API
3. Monitor with `gas_token_info` (check status after ~15 seconds)
4. Add social links with `gas_update_token`
5. Buy more with `gas_buy`, sell with `gas_sell`

## Dependencies

Requires at runtime (provided by teleton):
- `@ton/core` — Cell building, address computation
- `@ton/ton` — Wallet contract, TonClient
- `@ton/crypto` — Mnemonic to private key
- `@orbs-network/ton-access` (optional) — Decentralized RPC endpoint
- `telegram` (GramJS) — Telegram MTProto client

Agent wallet at `~/.teleton/wallet.json` is used for signing all on-chain transactions.

## Schemas

### gas_launch_token

Signs and sends the deploy transaction from the agent's wallet. All-in-one pipeline.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | Yes | -- | Token name |
| `ticker` | string | Yes | -- | Token ticker symbol |
| `image_base64` | string | No | -- | Base64-encoded image (use this OR image_url) |
| `image_url` | string | No | -- | Already-hosted image URL (use this OR image_base64) |
| `description` | string | No | "" | Token description (suffix added auto) |
| `dex_type` | string | No | "dedust" | "dedust" or "stonfi" |
| `nonce` | integer | No | 0 | Increment on address collision |
| `buy_ton` | string | No | "5" | TON amount for initial buy (min 0.3) |
| `tg_channel_link` | string | No | -- | Telegram channel link |
| `tg_chat_link` | string | No | -- | Telegram chat link |
| `twitter_link` | string | No | -- | Twitter/X link |
| `website_link` | string | No | -- | Website URL |

### gas_buy

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `token_address` | string | Yes | -- | Token contract address |
| `buy_ton` | string | No | "1" | TON amount to spend |

### gas_sell

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `token_address` | string | Yes | Token contract address |
| `sell_amount` | string | Yes | Amount of jettons to sell (in base units) |

### gas_portfolio

No parameters. Uses the agent's Telegram identity automatically.

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

### gas_holders

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `token_address` | string | Yes | -- | Token contract address |
| `limit` | integer | No | 50 | Max results |

### gas_top_traders

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `token_address` | string | Yes | -- | Token contract address |
| `limit` | integer | No | 20 | Max results |

### gas_price_chart

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `token_address` | string | Yes | Token contract address |

### gas_king

No parameters.

### gas_update_token

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `token_address` | string | Yes | Token contract address |
| `tg_channel_link` | string | No | Telegram channel link |
| `tg_chat_link` | string | No | Telegram chat link |
| `twitter_link` | string | No | Twitter/X link |
| `website_link` | string | No | Website URL |

## API reference

This plugin wraps the [Gas111 API](https://api.gas111.com). Documentation: [api.gas111.com/docs](https://api.gas111.com/docs)
