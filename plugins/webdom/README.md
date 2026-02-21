# webdom

Buy, sell, auction, and manage **.ton domains** and **Telegram usernames** on [webdom.market](https://webdom.market) -- the first dedicated marketplace for TON DNS.

Read tools use the webdom REST API. Action tools sign on-chain transactions from the agent wallet, interacting with the webdom marketplace smart contracts or native TON DNS auctions.

## Tools

| Tool | Description |
|------|-------------|
| `webdom_search_domains` | Search and filter domains by name, price, length, zone, auction status |
| `webdom_domain_info` | Get detailed info about a specific domain (owner, price, sale status) |
| `webdom_my_domains` | List domains owned by a wallet address |
| `webdom_market_stats` | Marketplace statistics: overview, recent sales, top sales, price history |
| `webdom_auction_history` | Bid history for a specific auction |
| `webdom_buy_domain` | Purchase a domain at fixed price |
| `webdom_list_for_sale` | List a domain for sale at a fixed price |
| `webdom_create_auction` | Create an auction for a domain |
| `webdom_place_bid` | Place a bid on an active webdom auction |
| `webdom_make_offer` | Make a purchase offer on a domain |
| `webdom_cancel_deal` | Cancel an active sale, auction, or offer |
| `webdom_dns_bid` | Bid on a native TON DNS auction (registration/expired domain) |

## Install

```bash
mkdir -p ~/.teleton/plugins
cp -r plugins/webdom ~/.teleton/plugins/
```

## Usage

Ask the AI:

- "Search for short .ton domains under 50 TON"
- "Get info on wallet.ton"
- "Show my domains"
- "What are the top domain sales on webdom?"
- "Buy example.ton for 10 TON"
- "List my domain for sale at 100 TON for 30 days"
- "Create an auction for my domain starting at 5 TON"
- "Bid 31.5 TON on the teleton.ton DNS auction"
- "Make an offer of 20 TON on crypto.ton"
- "Cancel my sale on EQ..."

## Trading flow

1. Search domains with `webdom_search_domains` to find listings
2. Get details with `webdom_domain_info` to see price, sale type, and deal address
3. Buy with `webdom_buy_domain` (fixed price) or `webdom_place_bid` (webdom auction) or `webdom_dns_bid` (native DNS auction)
4. List your own domains with `webdom_list_for_sale` or `webdom_create_auction`
5. Monitor the market with `webdom_market_stats`

## DNS auction vs webdom auction

Native TON DNS auctions (domain registration, expired domains) use `webdom_dns_bid` -- sends TON directly to the domain NFT address resolved via TONAPI.

Webdom marketplace auctions (listed by owners on webdom.market) use `webdom_place_bid` -- sends TON to the webdom auction contract address from `webdom_domain_info`.

## Dependencies

Requires at runtime (provided by teleton):
- `@ton/core` -- Address, beginCell, toNano, SendMode
- `@ton/ton` -- WalletContractV5R1, TonClient
- `@ton/crypto` -- mnemonicToPrivateKey

Agent wallet at `~/.teleton/wallet.json` is used for signing all on-chain transactions.

## Fee structure

| Payment | Standard | NFT Holder |
|---------|----------|------------|
| WEB3 | 2% | 0% |
| TON | 4% | 1% |

## Schemas

### webdom_search_domains

Search and filter .ton domains and .t.me usernames listed on the webdom marketplace.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `query` | string | No | -- | Search text to match against domain names |
| `domain_zone` | string | No | -- | `.ton` or `.t.me` |
| `min_price` | number | No | -- | Minimum price in TON |
| `max_price` | number | No | -- | Maximum price in TON |
| `min_length` | integer | No | -- | Minimum domain name length |
| `max_length` | integer | No | -- | Maximum domain name length |
| `on_auction` | boolean | No | -- | Only show domains in auction |
| `sort_by` | string | No | price_desc | `price_asc`, `price_desc`, `name`, `recent` |
| `limit` | integer | No | 20 | Results per page (1-50) |
| `page` | integer | No | 1 | Page number |

### webdom_domain_info

Get detailed information about a specific .ton domain or .t.me username.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Full domain name (e.g. `wallet.ton`, `alice.t.me`) |

### webdom_my_domains

List domains owned by the agent wallet or a specified address.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `address` | string | No | TON wallet address (omit to use agent wallet) |

### webdom_market_stats

Get marketplace statistics from webdom.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `stat_type` | string | Yes | `overview`, `recent_sales`, `top_sales`, or `price_history` |
| `domain_zone` | string | No | `.ton` or `.t.me` |

### webdom_auction_history

Get bid history for a specific domain auction.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `deal_address` | string | Yes | Auction deal contract address |

### webdom_buy_domain

Purchase a domain listed at fixed price. Sends price + 0.07 TON gas to the sale contract.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `sale_address` | string | Yes | Sale contract address (from `webdom_domain_info` deal_address) |
| `price_ton` | number | Yes | Domain price in TON (must match listed price) |

### webdom_list_for_sale

List a domain for sale at a fixed price. Transfers the domain NFT to the marketplace.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `domain_address` | string | Yes | -- | Domain NFT contract address |
| `price_ton` | number | Yes | -- | Sale price in TON |
| `duration_days` | integer | No | 30 | Listing duration in days |

### webdom_create_auction

Create an auction for a domain. Transfers the domain NFT to the marketplace.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `domain_address` | string | Yes | -- | Domain NFT contract address |
| `min_bid_ton` | number | Yes | -- | Minimum starting bid in TON |
| `duration_hours` | integer | No | 24 | Auction duration in hours |

### webdom_place_bid

Place a bid on an active webdom marketplace auction. Sends bid + 0.07 TON gas to the auction contract.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `auction_address` | string | Yes | Auction contract address (from `webdom_domain_info` deal_address) |
| `bid_ton` | number | Yes | Bid amount in TON (must exceed current highest bid) |

### webdom_make_offer

Make a purchase offer on a domain. Sends TON to the marketplace which deploys an offer contract.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `domain_address` | string | Yes | -- | Domain NFT contract address |
| `offer_ton` | number | Yes | -- | Offer amount in TON (locked in contract) |
| `valid_days` | integer | No | 7 | Offer validity in days |

### webdom_cancel_deal

Cancel an active sale, auction, or offer.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `deal_address` | string | Yes | Deal contract address |
| `deal_type` | string | Yes | `sale`, `auction`, or `offer` |

### webdom_dns_bid

Bid on a native TON DNS auction. Resolves domain name to NFT address via TONAPI, then sends TON directly to it. If outbid, your TON is refunded automatically.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `domain_name` | string | No | Domain name (e.g. `teleton.ton`). Provide this or `domain_nft_address` |
| `domain_nft_address` | string | No | Domain NFT address (skips TONAPI resolution) |
| `bid_ton` | number | Yes | Bid amount in TON |

## Key addresses

- **Marketplace**: `EQD7-a6WPtb7w5VgoUfHJmMvakNFgitXPk3sEM8Gf_WEBDOM`
- **TON DNS Collection**: `EQC3dNlesgVD8YbAazcauIrXBPfiVhMMr5YYk2in0Mtsz0Bz`
- **WEB3 Token**: `EQBtcL4JA-PdPiUkB8utHcqdaftmUSTqdL8Z1EeXePLti_nK`
- **Usernames Collection**: `EQCA14o1-VWhS2efqoh_9M1b_A9DtKTuoqfmkn83AbJzwnPi`
