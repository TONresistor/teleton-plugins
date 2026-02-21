# fragment

Search and browse [Fragment](https://fragment.com) -- Telegram's NFT marketplace for usernames, anonymous numbers, and collectible gifts.

All tools use the Fragment public API. No authentication or wallet required.

## Tools

| Tool | Description |
|------|-------------|
| `fragment_search` | Search usernames, numbers, or gifts on Fragment marketplace |
| `fragment_item` | Get detailed info for a specific item (price, owner, status, attributes) |
| `fragment_history` | Get ownership transfer or bid history |
| `fragment_nft` | Get NFT metadata (name, image, attributes) -- pure JSON |
| `fragment_collections` | List all gift collections with item counts |
| `fragment_rate` | Get current TON/USD rate |

## Install

```bash
mkdir -p ~/.teleton/plugins
cp -r plugins/fragment ~/.teleton/plugins/
```

## Usage

Ask the AI:

- "Search for premium usernames containing 'crypto'"
- "How much is @wallet on Fragment?"
- "Show the cheapest Durov's Cap gifts for sale"
- "What's the current TON/USD rate on Fragment?"
- "Show ownership history for username 'crypto'"
- "List all gift collections on Fragment"
- "Get NFT metadata for username 'crypto'"
- "Find anonymous numbers for sale on Fragment"

## Schemas

### fragment_search

Search usernames, numbers, or gifts on Fragment marketplace. Returns a list of items with prices, status, and basic info.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `type` | string | Yes | -- | Item type: "usernames", "numbers", or "gifts" |
| `query` | string | No | "" | Search text |
| `sort` | string | No | "price_desc" | Sort: "price_desc", "price_asc", "listed", "ending" |
| `filter` | string | No | "sale" | Filter: "sale", "auction", "sold", "available" |
| `collection` | string | No | -- | Gift collection slug (gifts only, e.g. "durovscap") |
| `limit` | integer | No | 20 | Max results |

### fragment_item

Get detailed info for a specific Fragment item including price, owner, status, and attributes.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `type` | string | Yes | -- | "username", "number", or "gift" |
| `id` | string | Yes | -- | Item identifier (e.g. "crypto", "88800869800", "durovscap-9") |

### fragment_history

Get ownership or bid history for a Fragment item.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `type` | string | Yes | -- | "username", "number", or "gift" |
| `id` | string | Yes | -- | Item identifier |
| `history_type` | string | No | "sales" | "sales" (ownership changes) or "bids" (offers) |
| `limit` | integer | No | 20 | Max results |

### fragment_nft

Get NFT metadata (name, image, description, attributes) for a Fragment item.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `type` | string | Yes | -- | "username", "number", or "gift" |
| `id` | string | Yes | -- | Item identifier |

### fragment_collections

List available gift collections on Fragment with item counts.

No parameters required.

### fragment_rate

Get current TON/USD exchange rate from Fragment.

No parameters.
