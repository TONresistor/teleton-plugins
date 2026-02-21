# dedust

Swap tokens, browse pools, and trade on [DeDust](https://dedust.io) -- TON's #2 decentralized exchange.

Read tools use the DeDust REST API. Swap tools use the `@dedust/sdk` for on-chain estimation and transaction building, signed from the agent wallet.

## Tools

| Tool | Description |
|------|-------------|
| `dedust_assets` | Search or list tokens by symbol, name, or address |
| `dedust_pools` | List top liquidity pools sorted by reserves, volume, or fees |
| `dedust_pool_trades` | Get recent trades for a specific pool |
| `dedust_pool_info` | Get detailed pool info including metadata, reserves, and fees |
| `dedust_jetton_info` | Get jetton metadata, top holders, and top traders |
| `dedust_prices` | Get prices and liquidity data from DeDust CoinGecko tickers |
| `dedust_swap_estimate` | Estimate swap output using on-chain pool get-methods |
| `dedust_swap` | Execute a swap from the agent wallet |

## Install

```bash
mkdir -p ~/.teleton/plugins
cp -r plugins/dedust ~/.teleton/plugins/
```

## Usage

Ask the AI:

- "Search for USDT on DeDust"
- "Show me the top DeDust pools by volume"
- "Get recent trades for this pool: EQC..."
- "Get details on this DeDust pool"
- "Show me the top holders of this jetton"
- "What's the price of TON on DeDust?"
- "Estimate swapping 10 TON to USDT on DeDust"
- "Swap 5 TON to USDT on DeDust"

## Trading flow

1. Search tokens with `dedust_assets` to find addresses
2. Estimate the swap with `dedust_swap_estimate` to preview output and fees
3. Execute with `dedust_swap` to send the swap transaction
4. Confirmation typically takes ~30 seconds on TON

## Dependencies

Requires at runtime (provided by teleton):
- `@ton/core` -- Address, beginCell, toNano, fromNano, SendMode
- `@ton/ton` -- WalletContractV5R1, TonClient
- `@ton/crypto` -- mnemonicToPrivateKey
- `@dedust/sdk` -- required for `dedust_swap_estimate` and `dedust_swap` (on-chain estimation and transaction building)

Agent wallet at `~/.teleton/wallet.json` is used for signing all on-chain transactions.

> **Note:** The `@dedust/sdk` package must be installed in the teleton runtime for swap tools to work. Install with: `npm install @dedust/sdk`

## Schemas

### dedust_assets

Search or list tokens available on DeDust by symbol name or address. Returns token metadata including address, name, symbol, decimals, image, and type.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `search` | string | Yes | Token symbol (e.g. "USDT", "TON") or address (e.g. "EQCxE6...") |

### dedust_pools

List top DeDust liquidity pools sorted by reserves, volume, or fees. Optionally filter by token symbol or address.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `search` | string | No | -- | Filter pools by token symbol or address |
| `limit` | integer | No | 10 | Number of results (1-50) |
| `sort_by` | string | No | "reserves" | Sort by: "reserves", "volume", or "fees" |

### dedust_pool_trades

Get recent trades for a specific DeDust pool by its address.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `pool_address` | string | Yes | -- | Pool contract address |
| `limit` | integer | No | 20 | Number of trades to return (1-100) |

### dedust_pool_info

Get detailed info for a specific DeDust pool including metadata, reserves, volume, fees, and trade fee.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `pool_address` | string | Yes | Pool contract address |

### dedust_jetton_info

Get jetton (token) metadata, top holders, and top traders from DeDust.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `address` | string | Yes | Jetton minter address (e.g. EQCxE6...) |

### dedust_prices

Get prices and liquidity data for tokens from DeDust CoinGecko tickers. Use "native" for TON.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `tokens` | array | Yes | Token addresses to look up (use "native" for TON) |

### dedust_swap_estimate

Estimate swap output on DeDust using on-chain pool get-methods. Returns expected output amount and trade fee. Use "native" for TON or a jetton address.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `input_token` | string | Yes | Input token address or "native" for TON |
| `output_token` | string | Yes | Output token address or "native" for TON |
| `input_amount` | string | Yes | Amount to swap in human-readable units (e.g. "10") |

### dedust_swap

Execute a swap on DeDust from the agent wallet. Supports TON->Jetton and Jetton->TON swaps. Use "native" for TON. Call `dedust_swap_estimate` first to preview the output.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `input_token` | string | Yes | -- | Input token address or "native" for TON |
| `output_token` | string | Yes | -- | Output token address or "native" for TON |
| `input_amount` | string | Yes | -- | Amount to swap in human-readable units (e.g. "10") |
| `slippage` | number | No | 0.05 | Slippage tolerance (0.05 = 5%, range 0.001-0.5) |
