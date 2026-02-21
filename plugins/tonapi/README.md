# tonapi

TON blockchain explorer data from [TONAPI](https://tonapi.io) -- account info, jetton balances, NFT data, token prices, transaction lookups, execution traces, DNS resolution, staking pools, and validators.

## Tools

| Tool | Description |
|------|-------------|
| `tonapi_account` | Get TON account info by address or .ton domain |
| `tonapi_account_jettons` | List jetton balances for a TON wallet |
| `tonapi_account_nfts` | List NFTs owned by a TON account |
| `tonapi_account_events` | Get recent events/transactions for a TON account |
| `tonapi_account_search` | Search TON accounts by domain name |
| `tonapi_jetton_info` | Get jetton metadata and stats by master contract address |
| `tonapi_jetton_holders` | List top holders of a jetton |
| `tonapi_rates` | Get current exchange rates for TON tokens |
| `tonapi_rates_chart` | Get historical price chart data for a token |
| `tonapi_nft_collection` | Get NFT collection details by contract address |
| `tonapi_nft_items` | List NFT items in a collection |
| `tonapi_nft_item` | Get detailed info about a single NFT item |
| `tonapi_transaction` | Look up a TON transaction by hash |
| `tonapi_trace` | Get execution trace for a TON transaction |
| `tonapi_validators` | List current TON blockchain validators |
| `tonapi_dns_resolve` | Resolve a .ton domain to wallet/site address |
| `tonapi_dns_info` | Get domain info including owner and expiry |
| `tonapi_dns_auctions` | List active .ton domain auctions |
| `tonapi_staking_pools` | List available TON staking pools |
| `tonapi_staking_pool` | Get detailed info for a specific staking pool |

## Install

```bash
mkdir -p ~/.teleton/plugins
cp -r plugins/tonapi ~/.teleton/plugins/
```

### API key (recommended)

Some endpoints (jetton info, jetton holders) **require** an API key. Without one you'll get 401 errors on those routes, and all requests are rate-limited to one every 4 seconds.

Get a free key from [tonconsole.com](https://tonconsole.com), then add it to your teleton config:

```yaml
# ~/.teleton/config.yaml
tonapi_key: "YOUR_KEY_HERE"
```

The plugin reads the key from `config.yaml` automatically. Alternatively you can set the `TONAPI_KEY` env var (takes priority over config).

With a key, the rate limit drops to 1 request per second and all endpoints are available.

## Usage

Ask the AI:

- "What's the balance of UQCD...abc on TON?"
- "Show me the jetton holdings for wallet.ton"
- "Who are the top holders of the DOGS token?"
- "What's the current price of TON in USD?"
- "Look up transaction 0xabc123... on TON"
- "Trace the execution of this transaction"
- "Resolve foundation.ton to an address"
- "What staking pools are available on TON?"

## Schemas

### tonapi_account

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `account_id` | string | Yes | -- | Wallet/contract address or .ton domain |

### tonapi_account_jettons

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `account_id` | string | Yes | -- | Wallet/contract address or .ton domain |
| `currencies` | string | No | usd | Comma-separated currency codes for price conversion |

### tonapi_account_nfts

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `account_id` | string | Yes | -- | Wallet/contract address or .ton domain |
| `limit` | integer | No | 100 | Number of NFTs to return, 1-1000 |
| `offset` | integer | No | 0 | Pagination offset |

### tonapi_account_events

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `account_id` | string | Yes | -- | Wallet/contract address or .ton domain |
| `limit` | integer | No | 20 | Number of events to return, 1-100 |

### tonapi_account_search

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | Yes | -- | Domain name to search for |

### tonapi_jetton_info

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `account_id` | string | Yes | -- | Jetton master contract address |

### tonapi_jetton_holders

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `account_id` | string | Yes | -- | Jetton master contract address |
| `limit` | integer | No | 100 | Number of holders to return, 1-1000 |
| `offset` | integer | No | 0 | Pagination offset |

### tonapi_rates

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `tokens` | string | Yes | -- | Comma-separated token addresses; use "ton" for native TON |
| `currencies` | string | No | ton,usd | Comma-separated currency codes |

### tonapi_rates_chart

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `token` | string | Yes | -- | Token address or "ton" for native TON |
| `currency` | string | No | usd | Price currency |
| `start_date` | integer | No | -- | Start of range as unix timestamp |
| `end_date` | integer | No | -- | End of range as unix timestamp |

### tonapi_nft_collection

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `account_id` | string | Yes | -- | NFT collection contract address |

### tonapi_nft_items

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `account_id` | string | Yes | -- | NFT collection contract address |
| `limit` | integer | No | 50 | Number of items to return, 1-1000 |
| `offset` | integer | No | 0 | Pagination offset |

### tonapi_nft_item

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `account_id` | string | Yes | -- | NFT item contract address |

### tonapi_transaction

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `transaction_id` | string | Yes | -- | Transaction hash to look up |

### tonapi_trace

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `trace_id` | string | Yes | -- | Trace hash (same as the transaction hash) |

### tonapi_validators

No parameters required.

### tonapi_dns_resolve

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `domain_name` | string | Yes | -- | TON domain name to resolve (e.g. "wallet.ton") |

### tonapi_dns_info

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `domain_name` | string | Yes | -- | TON domain name (e.g. "wallet.ton") |

### tonapi_dns_auctions

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `tld` | string | No | ton | Top-level domain filter |

### tonapi_staking_pools

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `available_for` | string | No | -- | Account address to check staking eligibility for |

### tonapi_staking_pool

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `account_id` | string | Yes | -- | Staking pool contract address |

## API reference

This plugin wraps the [TONAPI v2 REST API](https://tonapi.io). A free API key is recommended — see [Install](#install) for details.
