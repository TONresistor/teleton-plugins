# swapcoffee

Swap tokens on TON via [swap.coffee](https://swap.coffee) DEX aggregator -- finds the best rate across STON.fi, DeDust, Tonco, Coffee DEX, and 15+ other DEXes.

Read tools use the swap.coffee REST API. Write tools sign transactions from the agent wallet.

## Tools

| Tool | Description |
|------|-------------|
| `swap_quote` | Get optimal swap route with expected output, price impact, and gas estimate |
| `swap_execute` | Execute a token swap -- finds best route, signs and sends from agent wallet |
| `swap_status` | Check swap execution status (poll after swap_execute) |
| `swap_tokens` | Search/lookup tokens by symbol or address with USD price |
| `swap_price` | Get current USD prices for multiple tokens |
| `swap_pools` | Browse liquidity pools sorted by TVL, volume, or APR |

## Install

```bash
mkdir -p ~/.teleton/plugins
cp -r plugins/swapcoffee ~/.teleton/plugins/
```

## Usage

Ask the AI:

- "What's the best rate to swap 10 TON to USDT?"
- "Swap 5 TON to USDT"
- "Check the status of my swap" (with route_id)
- "Search for the NOT token"
- "What's the price of TON and USDT?"
- "Show me the top pools by TVL"
- "Show pools on DeDust sorted by APR"

## Trading flow

1. Search tokens with `swap_tokens` to find addresses
2. Get a quote with `swap_quote` to preview the rate
3. Execute with `swap_execute` to send the swap
4. Monitor with `swap_status` until terminal

## Dependencies

Requires at runtime (provided by teleton):
- `@ton/core` -- Cell parsing, Address
- `@ton/ton` -- WalletContractV5R1, TonClient
- `@ton/crypto` -- mnemonicToPrivateKey

Agent wallet at `~/.teleton/wallet.json` is used for signing all on-chain transactions.

## Schemas

### swap_quote

Get optimal swap route with expected output, price impact, and gas estimate.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `input_token` | string | Yes | -- | Input token address or "native" for TON |
| `output_token` | string | Yes | -- | Output token address or "native" for TON |
| `input_amount` | string | Yes | -- | Amount in human-readable units (e.g. "10") |
| `max_splits` | integer | No | 4 | Route splits for better price (1-20) |

### swap_execute

Execute a token swap. Finds the best route, signs and sends the transaction from the agent wallet.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `input_token` | string | Yes | -- | Input token address or "native" for TON |
| `output_token` | string | Yes | -- | Output token address or "native" for TON |
| `input_amount` | string | Yes | -- | Amount in human-readable units |
| `slippage` | number | No | 0.05 | Slippage tolerance (0.05 = 5%) |
| `max_splits` | integer | No | 4 | Route splits (1-20) |

### swap_status

Check swap execution status. Poll after `swap_execute` until terminal.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `route_id` | integer | Yes | Route ID from swap_execute response |

### swap_tokens

Search/lookup tokens by symbol or address.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `search` | string | Yes | Token symbol (e.g. "USDT") or address |

### swap_price

Get current USD prices for multiple tokens.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `tokens` | array | Yes | Token addresses (use "native" for TON) |

### swap_pools

Browse liquidity pools sorted by TVL, volume, or APR.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `search` | string | No | -- | Search by token address or ticker |
| `order` | string | No | "tvl" | Sort by: "tvl", "volume", or "apr" |
| `limit` | integer | No | 10 | Results per page (1-50) |
| `page` | integer | No | 1 | Page number |
| `dexes` | array | No | -- | Filter by DEX names (e.g. ["stonfi", "dedust"]) |
