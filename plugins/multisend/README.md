# Multisend

Batch send TON and jettons to up to 254 recipients in a single transaction via Highload Wallet v3. Ideal for airdrops, mass payments, and rewards distribution.

| Tool | Description |
|------|-------------|
| `multisend_info` | Multisend wallet address, balance, deployment status, sequence state |
| `multisend_fund` | Transfer TON from the agent wallet (V5R1) to fund the multisend wallet |
| `multisend_batch_ton` | Send TON to up to 254 recipients in one transaction |
| `multisend_batch_jetton` | Send jettons to up to 254 recipients in one transaction |
| `multisend_status` | On-chain wallet state: timeout, last cleanup, subwallet ID |

## Architecture

This plugin uses a **two-wallet system**:

1. **Agent wallet** (WalletContractV5R1) -- your main wallet at `~/.teleton/wallet.json`
2. **Multisend wallet** (HighloadWalletV3) -- a separate contract derived from the same mnemonic, at a different address

The multisend wallet can send up to 254 messages in a single transaction, making batch operations ~254x more efficient than sending individually. It auto-deploys on first use (just needs pre-funding).

**Sequence persistence**: Query IDs are stored in `~/.teleton/multisend-sequence.json` to prevent replay collisions.

## First use

1. **Check address**: `multisend_info` shows the multisend wallet address and balance
2. **Fund it**: `multisend_fund` transfers TON from the agent wallet to the multisend address
3. **First batch**: `multisend_batch_ton` auto-deploys the contract on the first call
4. **Jetton batches**: Transfer jettons to the multisend wallet, then use `multisend_batch_jetton`

The multisend wallet auto-deploys when the first batch is sent -- no separate deploy step needed. Forward fees are ~2x a normal wallet (external + internal self-message), but this is offset by batching up to 254 operations.

## Install

```bash
mkdir -p ~/.teleton/plugins
cp -r plugins/multisend ~/.teleton/plugins/
```

Requires `@tonkite/highload-wallet-v3` installed in the teleton runtime's `node_modules/`.

## Usage examples

- "Show my multisend wallet info"
- "Fund my multisend wallet with 5 TON"
- "Send 1 TON to each of these addresses: EQ..., EQ..., EQ..."
- "Airdrop 100 USDT to these 50 addresses"
- "Check multisend wallet status"

## Tool schemas

### multisend_info

No parameters.

### multisend_fund

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `amount` | string | Yes | -- | Amount in TON to transfer (e.g. "5" or "0.5") |

### multisend_batch_ton

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `recipients` | array | Yes | -- | Up to 254 recipients: `[{ address, amount, memo? }]` |

Each recipient object:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `address` | string | Yes | TON wallet address |
| `amount` | string | Yes | Amount in TON |
| `memo` | string | No | Comment to attach |

### multisend_batch_jetton

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `jetton_master` | string | Yes | -- | Jetton master contract address |
| `recipients` | array | Yes | -- | Up to 254 recipients: `[{ address, amount }]` |
| `decimals` | integer | No | 9 | Jetton decimals (6 for USDT, 9 for most tokens) |
| `forward_ton` | string | No | "0.05" | TON to attach per transfer for gas |

### multisend_status

No parameters.
