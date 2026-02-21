# giftstat

Telegram gift market data from the [Giftstat API](https://api.giftstat.app) -- collections, floor prices, models, stats, and price history.

## Tools

| Tool | Description |
|------|-------------|
| `gift_collections` | List all gift collections with supply and pricing |
| `gift_floor_prices` | Floor prices by marketplace |
| `gift_models` | Gift model variants and rarities |
| `gift_model_stats` | Statistics per model (count, share, rarity) |
| `gift_model_floor` | Floor price per model |
| `gift_backdrops` | Gift background variants |
| `gift_symbols` | Gift symbol/pattern variants |
| `gift_thematics` | Thematic gift categories |
| `gift_thematic_lines` | Gift lines grouped by thematic category |
| `gift_ton_rate` | Current TON/USDT rate |
| `gift_price_history` | Historical floor prices |

## Install

```bash
mkdir -p ~/.teleton/plugins
cp -r plugins/giftstat ~/.teleton/plugins/
```

## Usage

Ask the AI:

- "What gift collections are available?"
- "Show floor prices on Getgems"
- "What's the cheapest model in the Plush Pepe collection?"
- "Compare floor prices between Portals and Tonnel"
- "What's the current TON price in USDT?"
- "Show price history for the last 7 days"
- "Which gift models have the highest rarity?"
- "List all thematic categories"

## Schemas

### gift_collections

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `fields` | string | No | -- | Comma-separated list of fields to return |
| `limit` | integer | No | 200 | Items to return |
| `offset` | integer | No | 0 | Pagination offset |

### gift_floor_prices

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `marketplace` | string | No | portals | portals, tonnel, fragment, getgems |
| `limit` | integer | No | 200 | Items to return |
| `offset` | integer | No | 0 | Pagination offset |

### gift_models

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `limit` | integer | No | 200 | Items to return |
| `offset` | integer | No | 0 | Pagination offset |

### gift_model_stats

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `limit` | integer | No | 200 | Items to return |
| `offset` | integer | No | 0 | Pagination offset |

### gift_model_floor

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `limit` | integer | No | 200 | Items to return |
| `offset` | integer | No | 0 | Pagination offset |

### gift_backdrops

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `limit` | integer | No | 200 | Items to return |
| `offset` | integer | No | 0 | Pagination offset |

### gift_symbols

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `limit` | integer | No | 200 | Items to return |
| `offset` | integer | No | 0 | Pagination offset |

### gift_thematics

No parameters.

### gift_thematic_lines

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `limit` | integer | No | 10000 | Items to return |
| `offset` | integer | No | 0 | Pagination offset |

### gift_ton_rate

No parameters.

### gift_price_history

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `marketplace` | string | No | portals | portals, tonnel, getgems |
| `scale` | string | No | day | day, hour |
| `days` | integer | No | -- | Number of days to retrieve |
| `limit` | integer | No | 200 | Items to return |
| `offset` | integer | No | 0 | Pagination offset |

## Supported marketplaces

- portals (default)
- tonnel
- fragment
- getgems

## API reference

This plugin wraps the [Giftstat API](https://api.giftstat.app). Documentation: [wiki.giftstat.app](https://wiki.giftstat.app/en/indexes/giftindex)
