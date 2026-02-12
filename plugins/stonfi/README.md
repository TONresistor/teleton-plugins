# stonfi

Swap tokens, browse pools, and farm on [StonFi](https://ston.fi) DEX -- the largest decentralized exchange on TON.

Read tools use the StonFi REST API. Swap execution uses the `@ston-fi/sdk` to build transactions, signed from the agent wallet.

## Tools

| Tool | Description |
|------|-------------|
| `stonfi_search` | Search tokens on StonFi by name, symbol, or contract address |
| `stonfi_price` | Get the current USD price for a token on StonFi |
| `stonfi_pools` | Search and list liquidity pools with reserves, APY, and volume |
| `stonfi_pool_info` | Get detailed info for a specific liquidity pool |
| `stonfi_farms` | List active farming opportunities, optionally filtered by pool |
| `stonfi_dex_stats` | Get overall StonFi DEX statistics (TVL, volume, wallets, trades) |
| `stonfi_swap_quote` | Simulate a swap and get expected output, price impact, and fees |
| `stonfi_swap` | Execute a token swap -- builds tx via SDK, signs with agent wallet |

## Install

```bash
mkdir -p ~/.teleton/plugins
cp -r plugins/stonfi ~/.teleton/plugins/
```

## Usage

Ask the AI:

- "Search for the USDT token on StonFi"
- "What's the price of NOT on StonFi?"
- "Show me the top StonFi pools by volume"
- "Get details on this pool: EQC..."
- "What farms are available on StonFi?"
- "Show StonFi DEX stats"
- "Get a quote for swapping 10 TON to USDT on StonFi"
- "Swap 5 TON to USDT on StonFi"

## Trading flow

1. Search tokens with `stonfi_search` to find addresses
2. Get a quote with `stonfi_swap_quote` to preview the rate and price impact
3. Execute with `stonfi_swap` to send the swap transaction
4. Confirmation typically takes ~30 seconds on TON

## Dependencies

Requires at runtime (provided by teleton):
- `@ton/core` -- Address, SendMode
- `@ton/ton` -- WalletContractV5R1, TonClient
- `@ton/crypto` -- mnemonicToPrivateKey
- `@ston-fi/sdk` -- required for `stonfi_swap` (transaction building)

Agent wallet at `~/.teleton/wallet.json` is used for signing all on-chain transactions.

## Schemas

### stonfi_search

Search tokens on StonFi DEX by name, symbol, or contract address. Returns matching tokens with price and metadata.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `search` | string | Yes | -- | Token name, symbol, or address (e.g. "USDT", "NOT", "EQCxE6...") |
| `limit` | integer | No | 5 | Max results to return (1-50) |

### stonfi_price

Get the current USD price for a token on StonFi. Use `EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c` for native TON.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `address` | string | Yes | Token contract address |

### stonfi_pools

Search and list liquidity pools on StonFi. Returns pool addresses, token pairs, reserves, APY, and volume.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `search` | string | No | -- | Search by token name, symbol, or address |
| `limit` | integer | No | 10 | Max results (1-50) |
| `sort_by` | string | No | "popularity_index:desc" | Sort order: "popularity_index:desc" or "volume_24h_usd:desc" |

### stonfi_pool_info

Get detailed info for a specific StonFi liquidity pool including reserves, fees, APY, and volume.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `pool_address` | string | Yes | Pool contract address |

### stonfi_farms

List active farming opportunities on StonFi. Optionally filter by pool address.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `pool_address` | string | No | Filter farms by pool address |

### stonfi_dex_stats

Get overall StonFi DEX statistics including TVL, total volume, unique wallets, and trade count.

No parameters required.

### stonfi_swap_quote

Get a swap quote on StonFi -- simulates a swap between two tokens and returns expected output, price impact, fees, and gas estimate. Use `EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c` for native TON.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `offer_address` | string | Yes | -- | Source token contract address |
| `ask_address` | string | Yes | -- | Destination token contract address |
| `amount` | string | Yes | -- | Amount to swap in human-readable units (e.g. "10") |
| `slippage` | number | No | 0.01 | Slippage tolerance (0.01 = 1%, range 0.001-0.5) |

### stonfi_swap

Execute a token swap on StonFi DEX. Simulates the swap, builds the transaction via @ston-fi/sdk, and signs with the agent wallet. Call `stonfi_swap_quote` first to preview.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `offer_address` | string | Yes | -- | Source token contract address |
| `ask_address` | string | Yes | -- | Destination token contract address |
| `amount` | string | Yes | -- | Amount to swap in human-readable units (e.g. "10") |
| `slippage` | number | No | 0.01 | Slippage tolerance (0.01 = 1%, range 0.001-0.5) |
