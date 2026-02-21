# geckoterminal

TON DEX pool and token data from the [GeckoTerminal API](https://api.geckoterminal.com) -- trending pools, new listings, trades, OHLCV candles, token info, and batch price lookups.

## Tools

| Tool | Description |
|------|-------------|
| `gecko_trending_pools` | Trending pools on TON by activity |
| `gecko_new_pools` | Newly created pools (last 48h) |
| `gecko_top_pools` | Top pools by liquidity and volume |
| `gecko_search_pools` | Search pools by name, symbol, or address |
| `gecko_pool_info` | Detailed info for a specific pool |
| `gecko_pool_trades` | Recent trades for a pool |
| `gecko_pool_ohlcv` | OHLCV candlestick data |
| `gecko_token_info` | Full token data (price, volume, FDV, supply) |
| `gecko_token_pools` | All pools trading a token |
| `gecko_token_prices` | Batch price lookup (up to 30 tokens) |

## Install

```bash
mkdir -p ~/.teleton/plugins
cp -r plugins/geckoterminal ~/.teleton/plugins/
```

## Usage

Ask the AI:

- "What are the trending pools on TON?"
- "Show me newly launched pools"
- "Find pools for STON token"
- "Get detailed info on this pool: EQC..."
- "Show recent trades for this pool"
- "Get daily candles for this pool"
- "What's the price and volume for this token?"
- "Which pools trade this token?"
- "Get prices for these 5 token addresses"
- "What are the top pools by liquidity on TON?"

## Schemas

### gecko_trending_pools

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `page` | integer | No | 1 | Page number (1-indexed) |

### gecko_new_pools

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `page` | integer | No | 1 | Page number (1-indexed) |

### gecko_top_pools

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `page` | integer | No | 1 | Page number (1-indexed) |

### gecko_search_pools

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `query` | string | Yes | -- | Search query (token name, symbol, or address) |
| `page` | integer | No | 1 | Page number (1-indexed) |

### gecko_pool_info

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `pool_address` | string | Yes | -- | Pool contract address |

### gecko_pool_trades

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `pool_address` | string | Yes | -- | Pool contract address |
| `min_usd` | number | No | -- | Minimum trade volume in USD |

### gecko_pool_ohlcv

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `pool_address` | string | Yes | -- | Pool contract address |
| `timeframe` | string | No | day | day, hour, minute |
| `aggregate` | integer | No | -- | Periods per candle (e.g. 4 with hour = 4h candles) |
| `limit` | integer | No | -- | Number of candles (max 1000) |
| `before_timestamp` | integer | No | -- | Unix timestamp, return candles before this time |
| `currency` | string | No | usd | usd, token |

### gecko_token_info

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `token_address` | string | Yes | -- | Token contract address |

### gecko_token_pools

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `token_address` | string | Yes | -- | Token contract address |
| `page` | integer | No | 1 | Page number (1-indexed) |

### gecko_token_prices

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `addresses` | string | Yes | -- | Comma-separated token addresses (max 30) |

## API reference

This plugin wraps the [GeckoTerminal API](https://api.geckoterminal.com/api/v2). Free tier: 30 calls/minute, no API key required.
