# Multisend

Batch send TON and jettons to up to 254 recipients through Highload Wallet v3. Ideal for airdrops, mass payments, and rewards distribution.

| Tool | Description |
|------|-------------|
| `multisend_info` | Highload wallet address, balance, deployment, and query sequence |
| `multisend_fund` | Fund the Highload wallet from the agent's main wallet |
| `multisend_batch_ton` | Send TON to up to 254 recipients in one transaction |
| `multisend_batch_jetton` | Send jettons to up to 254 recipients in one transaction |
| `multisend_status` | Highload timeout, cleanup, subwallet, balance, and sequence state |

## Architecture

The agent's main Wallet V5 and the Highload Wallet v3 keep their original distinct addresses. Teleton core derives both from the configured wallet, owns signing, serializes broadcasts, and persists Highload query IDs in private global state. The plugin never receives the mnemonic, private key, or sequence store.

## First use

1. Use `multisend_info` to inspect the Highload address.
2. Fund it with `multisend_fund`.
3. Send a first TON batch to deploy the Highload contract.
4. For jetton batches, transfer jettons to that Highload address first.

## Install

```bash
mkdir -p ~/.teleton/plugins
cp -r plugins/multisend ~/.teleton/plugins/
```

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

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `amount` | string | Yes | Amount in TON to fund the Highload wallet |

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
