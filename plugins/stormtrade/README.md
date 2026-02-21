# stormtrade

Perpetual futures trading on [Storm Trade](https://stormtrade.dev) DEX -- crypto, stocks, forex, and commodities on TON.

Read tools use the Storm Trade REST API. Write tools sign transactions from the agent wallet via the Storm Trade SDK.

## Tools

| Tool | Description |
|------|-------------|
| `storm_markets` | List all available markets with prices, funding rates, and open interest |
| `storm_market_info` | Get detailed info for a specific market |
| `storm_positions` | List trader's open positions with unrealized P&L |
| `storm_orders` | List active and historical orders |
| `storm_trader_stats` | Get trader performance statistics and leaderboard |
| `storm_open_position` | Open a new perpetual position (long or short) |
| `storm_close_position` | Close an existing position (full or partial) |
| `storm_add_margin` | Add margin to an existing position |
| `storm_remove_margin` | Remove excess margin from a position |
| `storm_create_order` | Create a limit, stop-limit, take-profit, or stop-loss order |
| `storm_cancel_order` | Cancel a pending order |
| `storm_stake` | Stake USDT/TON/NOT in a vault to earn trading fees |
| `storm_unstake` | Unstake from a vault |

## Install

```bash
mkdir -p ~/.teleton/plugins
cp -r plugins/stormtrade ~/.teleton/plugins/
```

## Usage

Ask the AI:

- "Show me all available crypto markets"
- "Open a 10x long on BTC/USD with 100 USDT margin"
- "Close my ETH/USD short position"
- "Add 50 USDT margin to my BTC/USD long"
- "Create a limit buy for BTC/USD at $60,000"
- "Cancel my pending stop-loss on ETH/USD"
- "Show my open positions and P&L"
- "Stake 500 USDT in the vault"
- "Show the top traders leaderboard"

## Trading flow

1. Browse markets with `storm_markets` or `storm_market_info`
2. Open a position with `storm_open_position` (set direction, leverage, margin)
3. Monitor with `storm_positions` to track unrealized P&L
4. Manage risk: `storm_add_margin` / `storm_remove_margin` to adjust collateral
5. Set automated exits with `storm_create_order` (take-profit, stop-loss)
6. Close with `storm_close_position` (full or partial)
7. Earn passive yield by staking in vaults with `storm_stake`

## Dependencies

Requires at runtime (provided by teleton):
- `@ton/core` -- Cell building, address computation
- `@ton/ton` -- Wallet contract, TonClient
- `@ton/crypto` -- Mnemonic to private key
- `@storm-trade/sdk` -- Position/order building, vault configs

Agent wallet at `~/.teleton/wallet.json` is used for signing all on-chain transactions.

## Schemas

### storm_markets

List all available markets with prices, funding rates, and open interest.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `vault` | string | No | -- | Filter by vault: "usdt", "not", "native" |

### storm_market_info

Get detailed info for a specific market including price, funding rate, open interest, and trading limits.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `market` | string | Yes | Market pair (e.g. "BTC/USD", "ETH/USD", "AAPL/USD") |

### storm_positions

List trader's open positions with entry price, size, leverage, margin, and unrealized P&L.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `trader_address` | string | No | agent wallet | TON address of the trader |
| `asset` | string | No | -- | Filter by asset (e.g. "BTC") |

### storm_orders

List active and historical orders for a trader.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `trader_address` | string | No | agent wallet | TON address of the trader |
| `asset` | string | No | -- | Filter by asset (e.g. "BTC") |
| `status` | string | No | "active" | "active" or "history" |

### storm_trader_stats

Get trader performance statistics, P&L history, or the leaderboard.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `trader_address` | string | No | agent wallet | TON address of the trader (ignored for leaderboard) |
| `view` | string | No | "stats" | "stats", "pnl_history", or "leaderboard" |
| `period` | integer | No | 7 | Time period in days |

### storm_open_position

Open a new perpetual position. Signs and sends the transaction from the agent wallet.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `market` | string | Yes | -- | Market pair (e.g. "BTC/USD") |
| `direction` | string | Yes | -- | "long" or "short" |
| `amount` | string | Yes | -- | Margin amount in vault currency (USDT/TON/NOT) |
| `leverage` | string | Yes | -- | Leverage multiplier (e.g. "10") |
| `vault` | string | No | "usdt" | Vault: "usdt", "not", "native" |
| `stop_loss` | string | No | -- | Stop-loss trigger price |
| `take_profit` | string | No | -- | Take-profit trigger price |

### storm_close_position

Close an existing position fully or partially.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `market` | string | Yes | -- | Market pair |
| `direction` | string | Yes | -- | "long" or "short" |
| `size` | string | No | full close | Base asset size to close (e.g. "0.5" for 0.5 BTC). Omit for full close |
| `vault` | string | No | "usdt" | Vault: "usdt", "not", "native" |

### storm_add_margin

Add margin to an existing position to reduce liquidation risk.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `market` | string | Yes | -- | Market pair |
| `direction` | string | Yes | -- | "long" or "short" |
| `amount` | string | Yes | -- | Amount to add in vault currency |
| `vault` | string | No | "usdt" | Vault: "usdt", "not", "native" |

### storm_remove_margin

Remove excess margin from a position.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `market` | string | Yes | -- | Market pair |
| `direction` | string | Yes | -- | "long" or "short" |
| `amount` | string | Yes | -- | Amount to remove |
| `vault` | string | No | "usdt" | Vault: "usdt", "not", "native" |

### storm_create_order

Create a limit, stop-limit, stop-loss, or take-profit order.

**For stopLoss / takeProfit orders:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `market` | string | Yes | Market pair |
| `direction` | string | Yes | "long" or "short" |
| `order_type` | string | Yes | "stopLoss" or "takeProfit" |
| `amount` | string | Yes | Base asset size to close (e.g. "0.5") |
| `trigger_price` | string | Yes | Trigger price (e.g. "50000") |
| `expiration` | integer | No | Order expiration in seconds (default: 30 days) |
| `vault` | string | No | Vault: "usdt", "not", "native" |

**For stopLimit / market orders:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `market` | string | Yes | Market pair |
| `direction` | string | Yes | "long" or "short" |
| `order_type` | string | Yes | "stopLimit" or "market" |
| `amount` | string | Yes | Margin amount in vault currency |
| `leverage` | string | Yes | Leverage multiplier (e.g. "10") |
| `limit_price` | string | Yes | Limit price (e.g. "60000") |
| `stop_price` | string | No | Stop price (for stopLimit only) |
| `stop_trigger_price` | string | No | Auto stop-loss trigger price |
| `take_trigger_price` | string | No | Auto take-profit trigger price |
| `expiration` | integer | No | Order expiration in seconds (default: 30 days) |
| `vault` | string | No | Vault: "usdt", "not", "native" |

### storm_cancel_order

Cancel a pending order.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `market` | string | Yes | -- | Market pair |
| `direction` | string | Yes | -- | "long" or "short" |
| `order_type` | string | Yes | -- | "stopLoss", "takeProfit", "stopLimit", or "market" |
| `order_index` | integer | No | 0 | Index of the order to cancel |
| `vault` | string | No | "usdt" | Vault: "usdt", "not", "native" |

### storm_stake

Stake in a vault to earn a share of trading fees.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `amount` | string | Yes | -- | Amount to stake in vault currency |
| `vault` | string | No | "usdt" | Vault: "usdt", "not", "native" |

### storm_unstake

Unstake from a vault. Omit amount to unstake full balance.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `amount` | string | No | full unstake | LP token amount to unstake |
| `vault` | string | No | "usdt" | Vault: "usdt", "not", "native" |
