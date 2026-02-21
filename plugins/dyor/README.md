# dyor

TON jetton analytics from the [DYOR.io API](https://dyor.io) -- search, token details, trust scores, pricing, charts, metrics, statistics, holder data, DEX transactions, market pools, and trending discovery.

## Tools

| Tool | Description |
|------|-------------|
| `dyor_search` | Search TON jettons by name or symbol |
| `dyor_details` | Get full token details and metadata by address |
| `dyor_trust_score` | Get trust score (0-100) for scam detection |
| `dyor_price` | Get current price in TON/USD |
| `dyor_price_chart` | Get price chart data points over time |
| `dyor_metrics` | Get consolidated metrics (price, holders, liquidity, FDMC, mcap) |
| `dyor_stats` | Get percent change statistics by time period |
| `dyor_holders` | Get holder count and optional history ticks |
| `dyor_transactions` | Get recent DEX swap transactions |
| `dyor_markets` | Get DEX pools/markets for a token |
| `dyor_trending` | Get trending tokens by chosen metric |

## Install

```bash
mkdir -p ~/.teleton/plugins
cp -r plugins/dyor ~/.teleton/plugins/
```

## Usage

Ask the AI:

- "Search for the DOGS token on TON"
- "What's the trust score of EQC..."
- "Show me the price chart for NOT token"
- "What are the trending tokens on TON right now?"
- "Show me recent buys and sells for this token"
- "What DEX pools exist for DOGS?"

## Schemas

### dyor_search

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `search` | string | Yes | -- | Search query (token name or symbol, min 3 characters) |
| `sort` | string | No | fdmc | Sort field (createdAt, fdmc, tvl, liquidityUsd, trustScore, volume24h, holders, traders24h, transactions24h, tonPriceChangeDay) |
| `order` | string | No | desc | Sort order (asc, desc) |
| `limit` | integer | No | 20 | Number of results, 1-100 |
| `excludeScam` | boolean | No | true | Exclude tokens flagged as scam |

### dyor_details

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `address` | string | Yes | -- | Jetton contract address |

### dyor_trust_score

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `address` | string | Yes | -- | Jetton contract address |

### dyor_price

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `address` | string | Yes | -- | Jetton contract address |
| `currency` | string | No | usd | Additional currency code |

### dyor_price_chart

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `address` | string | Yes | -- | Jetton contract address |
| `resolution` | string | No | hour1 | Chart resolution (min1, min15, hour1, day1). Max ranges: min1=24h, min15=7d, hour1=30d, day1=365d |
| `from` | string | No | -- | Start time as ISO 8601 datetime |
| `to` | string | No | -- | End time as ISO 8601 datetime |
| `currency` | string | No | usd | Price currency |

### dyor_metrics

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `address` | string | Yes | -- | Jetton contract address |
| `currency` | string | No | usd | Currency for values |

### dyor_stats

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `address` | string | Yes | -- | Jetton contract address |

### dyor_holders

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `address` | string | Yes | -- | Jetton contract address |
| `history` | boolean | No | false | If true, return holder count history ticks instead of current count |
| `limit` | integer | No | -- | Number of history ticks (only used when history=true) |

### dyor_transactions

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `address` | string | Yes | -- | Jetton contract address |
| `limit` | integer | No | 20 | Number of transactions, 1-100 |
| `type` | string | No | -- | Filter by type (buy, sell, liquidity_deposit, liquidity_withdraw) |
| `exchangeId` | string | No | -- | Filter by DEX (dedust, stonfi, tonco) |
| `who` | string | No | -- | Filter by wallet address |

### dyor_markets

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `address` | string | Yes | -- | Jetton contract address |
| `exchangeId` | string | No | -- | Filter by DEX (dedust, stonfi, tonco) |
| `limit` | integer | No | 20 | Number of markets, 1-100 |

### dyor_trending

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `sort` | string | No | volume24h | Metric to sort by (volume24h, tonPriceChangeHour, tonPriceChangeDay, tonPriceChangeWeek, holders, trustScore, fdmc) |
| `order` | string | No | desc | Sort order (asc, desc) |
| `limit` | integer | No | 20 | Number of results, 1-100 |
| `excludeScam` | boolean | No | true | Exclude tokens flagged as scam |

## API reference

This plugin wraps the [DYOR.io API](https://api.dyor.io). No API key required.
