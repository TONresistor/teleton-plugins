# EVAA Protocol

Lending and borrowing on TON via EVAA. Supply assets to earn interest, borrow against collateral, and liquidate undercollateralized positions across 4 pools (Main, LP, Alts, Stable).

| Tool | Description |
|------|-------------|
| `evaa_markets` | Market data: supply/borrow APY, utilization, TVL per asset |
| `evaa_assets` | Asset configs: collateral factor, liquidation threshold, reserve factor |
| `evaa_prices` | Current oracle prices (Pyth/Classic) for all pool assets |
| `evaa_user_position` | User position: supply/borrow balances, health factor, limits |
| `evaa_predict` | Simulate health factor impact of supply/withdraw/borrow/repay |
| `evaa_liquidations` | Check if a position is liquidatable with amounts |
| `evaa_supply` | Supply TON or jetton to a lending pool |
| `evaa_withdraw` | Withdraw supplied assets from a pool |
| `evaa_borrow` | Borrow an asset against your collateral |
| `evaa_repay` | Repay borrowed assets to reduce debt |
| `evaa_liquidate` | Liquidate an undercollateralized position |

## Pools

| Pool | Assets | Oracle |
|------|--------|--------|
| main | TON, jUSDT, jUSDC, stTON, tsTON, USDT, USDe, tsUSDe | Pyth |
| lp | TON, USDT, TONUSDT_DEDUST, TON_STORM, USDT_STORM, TONUSDT_STONFI | Classic |
| alts | TON, USDT, CATI, NOT, DOGS | Classic |
| stable | USDT, USDe, tsUSDe, PT_tsUSDe_01Sep2025, PT_tsUSDe_18Dec2025 | Classic |

## Install

```bash
mkdir -p ~/.teleton/plugins
cp -r plugins/evaa ~/.teleton/plugins/
```

Requires `@evaafi/sdk` and `crypto-js` installed in the teleton runtime's `node_modules/`:

```bash
cd /path/to/teleton-agent && npm install @evaafi/sdk crypto-js --legacy-peer-deps
```

> **Note:** `crypto-js` is an undeclared dependency of `@evaafi/sdk` — it must be installed manually.

## Usage examples

- "What are the current EVAA lending rates?"
- "Show my EVAA position"
- "Supply 10 TON to EVAA"
- "Borrow 500 USDT from EVAA"
- "What would happen to my health factor if I withdraw 5 TON?"
- "Check if this address is liquidatable on EVAA"
- "Withdraw all my USDT from EVAA"
- "Repay 200 USDT on EVAA"

## Tool schemas

### evaa_markets

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `pool` | string | No | all | Pool: main, lp, alts, stable |

### evaa_assets

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `pool` | string | No | main | Pool to query |

### evaa_prices

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `pool` | string | No | main | Pool to query |

### evaa_user_position

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `address` | string | No | agent wallet | TON wallet address |
| `pool` | string | No | main | Pool to query |

### evaa_predict

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `action` | string | Yes | -- | supply, withdraw, borrow, repay |
| `asset` | string | Yes | -- | Asset name (TON, USDT, etc.) |
| `amount` | string | Yes | -- | Amount in human units |
| `address` | string | No | agent wallet | TON wallet address |
| `pool` | string | No | main | Pool to query |

### evaa_liquidations

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `address` | string | Yes | -- | TON wallet address to check |
| `pool` | string | No | main | Pool to query |

### evaa_supply

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `asset` | string | Yes | -- | Asset name (TON, USDT, stTON, etc.) |
| `amount` | string | Yes | -- | Amount in human units |
| `pool` | string | No | main | Pool to use |

### evaa_withdraw

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `asset` | string | Yes | -- | Asset name to withdraw |
| `amount` | string | Yes | -- | Amount or "max" for maximum |
| `pool` | string | No | main | Pool to use |

### evaa_borrow

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `asset` | string | Yes | -- | Asset name to borrow |
| `amount` | string | Yes | -- | Amount in human units |
| `pool` | string | No | main | Pool to use |

### evaa_repay

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `asset` | string | Yes | -- | Asset name to repay |
| `amount` | string | Yes | -- | Amount in human units |
| `pool` | string | No | main | Pool to use |

### evaa_liquidate

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `borrower_address` | string | Yes | -- | Address of undercollateralized borrower |
| `pool` | string | No | main | Pool to use |
