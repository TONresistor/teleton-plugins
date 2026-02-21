# giftindex

Trade the [GiftIndex](https://giftindex.io) ODROB on TON -- monitor, analyze, and trade the Telegram Gifts index.

Aggregates gift collection floor prices, calculates fair value, and trades GHOLD/FLOOR tokens via on-chain order books.

## Tools

| Tool | Description |
|------|-------------|
| `giftindex_market` | Market overview: TON/USDT rate, fair value, order book corridors, top collections |
| `giftindex_fair_value` | Calculate fair value from aggregated gift collection floor prices |
| `giftindex_place_bid` | Place a BUY limit order (send USDT to buy index tokens) |
| `giftindex_place_ask` | Place a SELL limit order (send index tokens to sell for USDT) |
| `giftindex_cancel` | Cancel an existing order and reclaim tokens |
| `giftindex_portfolio` | View balances, open orders, and P&L summary |

## Install

```bash
mkdir -p ~/.teleton/plugins
cp -r plugins/giftindex ~/.teleton/plugins/
```

## Usage

Ask the AI:

- "Show me the GiftIndex market overview"
- "What's the fair value of the GiftIndex right now?"
- "Place a buy order for 10 USDT on the GHOLD order book at $1.50"
- "Sell 5 FLOOR tokens at $2.00"
- "Cancel my order with query ID 12345 on the GHOLD book"
- "Show my GiftIndex portfolio"

## Order books

Two index tokens are available:

- **GHOLD** -- tracks premium/rare Telegram gift collections
- **FLOOR** -- tracks floor prices across all collections

Each has its own on-chain order book with an oracle price corridor (+-3%).

## Schemas

### giftindex_market

No parameters. Returns market overview with TON/USDT rate, fair value, and order book corridors.

### giftindex_fair_value

No parameters. Calculates fair value by aggregating floor prices from multiple marketplaces.

### giftindex_place_bid

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `order_book` | string | Yes | "GHOLD" or "FLOOR" |
| `amount` | string | Yes | USDT amount in human units (e.g. "10" = 10 USDT) |
| `price` | number | Yes | Price in human units (e.g. 1.5 = $1.50) |

### giftindex_place_ask

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `order_book` | string | Yes | "GHOLD" or "FLOOR" |
| `amount` | string | Yes | Token amount in human units (e.g. "5" = 5 tokens) |
| `price` | number | Yes | Price in human units (e.g. 1.5 = $1.50) |

### giftindex_cancel

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `order_book` | string | Yes | "GHOLD" or "FLOOR" |
| `query_id` | string | Yes | The order's query ID |
| `order_type` | string | Yes | "buy" or "sell" |

### giftindex_portfolio

No parameters. Uses the agent's wallet automatically.

## Dependencies

Requires at runtime (provided by teleton):
- `@ton/core` -- Cell building, address computation
- `@ton/ton` -- Wallet contract, TonClient
- `@ton/crypto` -- Mnemonic to private key

Agent wallet at `~/.teleton/wallet.json` is used for signing all on-chain transactions.
