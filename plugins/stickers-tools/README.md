# stickers-tools

Telegram sticker NFT market data from [stickers.tools](https://stickers.tools) — stats, floor prices, sales history, charts, burns, digest, search.

| Tool | Description |
|------|-------------|
| `sticker_search` | Search sticker NFTs by name — use this first to find valid IDs |
| `sticker_summary` | Complete sticker info in one call: stats, floors, recent trades |
| `sticker_stats` | Overall market statistics (supply, volume, mcap, fees) |
| `sticker_floor` | Floor prices by platform (Fragment, Getgems, etc.) |
| `sticker_metadata` | Metadata for a specific sticker (name, image, rarity) |
| `sticker_history` | Sales history with filtering and sorting |
| `sticker_digest` | Market digest: top movers, burns, price changes |
| `sticker_chart_marketcap` | Daily market cap chart |
| `sticker_chart_volume` | Daily volume chart by platform |
| `sticker_chart_collection_mcap` | Collection market cap chart |
| `sticker_chart_sales` | Daily sales chart for a sticker |
| `sticker_burn_history` | Burn history with filtering |
| `sticker_burn_stats` | Burn statistics summary |
| `sticker_burn_user` | Burns by a specific wallet address |
| `sticker_burn_collections` | Burn stats grouped by collection |
| `sticker_chart_burns` | Burn chart for a sticker (4h intervals) |
| `sticker_burn_statistics` | Detailed burn rankings (top packs, collections, burners) |
| `sticker_metadata_all` | Metadata for all collections (large response) |

## Install

```bash
mkdir -p ~/.teleton/plugins
cp -r plugins/stickers-tools ~/.teleton/plugins/
```

## Usage examples

- "Find the sticker Duck and show its price"
- "What's the floor price for Blue Pengu?"
- "Show sticker market stats"
- "Show the sticker market digest for the last 24 hours"
- "Who burned the most stickers?"
- "Show sales history for DOGS OG collection"
- "Compare floor prices of Skull and Flame"

## Tool schemas

### sticker_search

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `q` | string | Yes | — | Search query in English (min 2 chars) |
| `limit` | integer | No | 20 | Max results (1-100) |

### sticker_summary

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `collection_id` | string | Yes | — | Numeric collection ID from sticker_search |
| `sticker_id` | string | Yes | — | Numeric sticker ID from sticker_search |
| `trades_limit` | integer | No | 10 | Recent trades to include (1-50) |

### sticker_stats

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `include` | string | No | all | Sections to include (comma-separated) |
| `exclude` | string | No | — | Sections to exclude. Use `collections` to reduce size |
| `currencies` | string | No | both | Filter: `usd`, `ton`, or both |
| `issuers` | string | No | — | `Goodies` or `Sticker Pack` |

### sticker_floor / sticker_metadata

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `collection_id` | string | Yes | — | Numeric collection ID from sticker_search |
| `sticker_id` | string | Yes | — | Numeric sticker ID from sticker_search |

### sticker_history

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `limit` | integer | No | 50 | Number of records |
| `offset` | integer | No | 0 | Pagination offset (max 5000) |
| `sort` | string | No | block_time | `block_time`, `amount_usd`, `amount_ton`, `sticker_number` |
| `order` | string | No | DESC | `ASC` or `DESC` |
| `collections` | string | No | — | Collection IDs (comma-separated) |
| `packs` | string | No | — | Pack IDs (format: collectionId-stickerId) |
| `issuers` | string | No | — | `Goodies` or `Sticker Pack` |

### sticker_digest

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `period` | string | No | 4h | `4h`, `24h`, `7d` |
| `limit` | integer | No | 10 | Number of top items |
| `hours` | integer | No | — | Custom period in hours |
| `days` | integer | No | — | Custom period in days |
| `from` | string | No | — | Start date (YYYY-MM-DD HH:MM:SS) |
| `to` | string | No | — | End date (YYYY-MM-DD HH:MM:SS) |

### sticker_burn_history

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `limit` | integer | No | 50 | Number of records |
| `offset` | integer | No | 0 | Pagination offset (max 5000) |
| `sort` | string | No | burn_time | `burn_time`, `floor_price_ton`, `floor_price_usd`, `sticker_number`, `amount_ton`, `amount_usd` |
| `order` | string | No | DESC | `ASC` or `DESC` |
| `collections` | string | No | — | Collection IDs (comma-separated) |

### sticker_burn_user

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `burned_by` | string | Yes | — | TON wallet address |
| `limit` | integer | No | 50 | Number of records |
| `offset` | integer | No | 0 | Pagination offset |

## API

All data comes from the public [stickers.tools](https://stickers.tools) API. No authentication required.

## License

MIT
