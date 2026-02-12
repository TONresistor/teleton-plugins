# getgems

Browse, search, and trade NFTs on [Getgems](https://getgems.io) -- TON's largest NFT marketplace. View collections, check floor prices, explore traits, track sales history, and buy or list NFTs from the agent wallet.

## Setup

This plugin requires a Getgems API key for authenticated access.

1. Visit [getgems.io/public-api](https://getgems.io/public-api)
2. Connect your TON wallet via TON Connect
3. Click **Create New Key**
4. Add the key to your Teleton config using one of these methods:

**Option A** -- config.yaml (recommended):

```yaml
# ~/.teleton/config.yaml
getgems_api_key: YOUR_KEY
```

**Option B** -- environment variable:

```bash
export GETGEMS_API_KEY=YOUR_KEY
```

**Option C** -- key file:

```bash
echo "YOUR_KEY" > ~/.teleton/getgems.key
```

## Tools

| Tool | Description |
|------|-------------|
| `getgems_top_collections` | Get top NFT collections by volume |
| `getgems_collection_info` | Get collection details with social links |
| `getgems_collection_stats` | Get collection floor price, volume, and holder stats |
| `getgems_collection_attributes` | Get traits with rarity and floor prices per trait |
| `getgems_collection_history` | Get collection activity -- sales, transfers, mints, listings |
| `getgems_nft_info` | Get full NFT details -- owner, sale data, attributes, image |
| `getgems_nft_history` | Get NFT trade and transfer history |
| `getgems_nfts_on_sale` | Get NFTs currently listed for sale in a collection |
| `getgems_nft_offers` | Get active offers on a specific NFT |
| `getgems_owner_nfts` | Get all NFTs owned by a wallet address |
| `getgems_user_trading` | Get user trading statistics |
| `getgems_gift_collections` | List Telegram Gift NFT collections |
| `getgems_buy_nft` | Buy an NFT listed for sale from the agent wallet |
| `getgems_list_nft` | List an NFT for fixed-price sale from the agent wallet |

## Install

```bash
mkdir -p ~/.teleton/plugins
cp -r plugins/getgems ~/.teleton/plugins/
```

## Usage

Ask the AI:

- "Show the top NFT collections on TON today"
- "Get info about the TON Diamonds collection"
- "What NFTs are for sale in this collection?"
- "Show recent sales for this collection"
- "What NFTs does this wallet own?"
- "Show the rarest traits in this collection"
- "Buy this NFT"
- "List my NFT for sale at 100 TON"
- "Show Telegram Gift collections on Getgems"
- "What offers are on this NFT?"

## Schemas

### getgems_top_collections

Get top NFT collections ranked by trading volume over a given period.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `kind` | string | No | "day" | Time period: "day", "week", "month", or "all" |
| `limit` | integer | No | 10 | Max results (1-100) |

### getgems_collection_info

Get detailed collection information including name, description, cover image, social links, and verified status.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `address` | string | Yes | -- | Collection contract address |

### getgems_collection_stats

Get collection statistics: floor price, total volume, number of items, holders, and listed count.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `address` | string | Yes | -- | Collection contract address |

### getgems_collection_attributes

Get all traits/attributes in a collection with rarity percentages and floor prices per trait value.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `address` | string | Yes | -- | Collection contract address |

### getgems_collection_history

Get collection activity feed -- sales, transfers, mints, listings, auctions, and burns.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `address` | string | Yes | -- | Collection contract address |
| `types` | array | No | -- | Filter by event types: "mint", "transfer", "sold", "cancelSale", "putUpForSale", "putUpForAuction", "cancelAuction", "burn" |
| `limit` | integer | No | 20 | Max results |
| `after` | string | No | -- | Pagination cursor from previous response |

### getgems_nft_info

Get full NFT details including owner, sale status, price, attributes, image URL, and collection info.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `address` | string | Yes | -- | NFT item contract address |

### getgems_nft_history

Get NFT trade and transfer history -- all ownership changes, sales, and listings.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `address` | string | Yes | -- | NFT item contract address |
| `types` | array | No | -- | Filter by event types (same as collection_history) |
| `limit` | integer | No | 20 | Max results |
| `after` | string | No | -- | Pagination cursor |

### getgems_nfts_on_sale

Get all NFTs currently listed for sale in a collection, sorted by price.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `address` | string | Yes | -- | Collection contract address |
| `limit` | integer | No | 20 | Max results |
| `after` | string | No | -- | Pagination cursor |

### getgems_nft_offers

Get all active offers/bids on a specific NFT.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `address` | string | Yes | -- | NFT item contract address |
| `limit` | integer | No | 20 | Max results |

### getgems_owner_nfts

Get all NFTs owned by a wallet address across all collections.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `address` | string | Yes | -- | Wallet address |
| `limit` | integer | No | 20 | Max results |
| `after` | string | No | -- | Pagination cursor |

### getgems_user_trading

Get user trading statistics -- total bought/sold, volume, profit/loss.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `address` | string | Yes | -- | Wallet address |

### getgems_gift_collections

List Telegram Gift NFT collections available on Getgems.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `limit` | integer | No | 20 | Max results |
| `after` | string | No | -- | Pagination cursor |

### getgems_buy_nft

Buy an NFT that is currently listed for sale. Sends a transaction from the agent wallet.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `address` | string | Yes | -- | NFT item contract address |

### getgems_list_nft

List an NFT for fixed-price sale on Getgems. The NFT must be owned by the agent wallet.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `address` | string | Yes | -- | NFT item contract address |
| `price` | string | Yes | -- | Sale price in TON (e.g. "100", "5.5") |
| `currency` | string | No | "TON" | Price currency |
