# sbt

Deploy and mint Soulbound Tokens ([TEP-85](https://github.com/ton-blockchain/TEPs/blob/master/text/0085-sbt-standard.md)) on TON.

## Tools

| Tool | Description |
|------|-------------|
| `sbt_deploy_collection` | Deploy a new SBT collection on TON |
| `sbt_mint` | Mint a soulbound token in a collection |

## Install

```bash
mkdir -p ~/.teleton/plugins
cp -r plugins/sbt ~/.teleton/plugins/
```

## Usage

Ask the AI:

- "Deploy an SBT collection called Event Badges with image https://example.com/badge.png"
- "Mint an SBT VIP Badge to EQ... in collection EQ..."

## Schemas

### sbt_deploy_collection

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | Yes | -- | Collection name |
| `description` | string | Yes | -- | Collection description |
| `image` | string | Yes | -- | URL to collection image |

Deploys from the agent wallet at `~/.teleton/wallet.json`. Cost: ~0.05 TON.

### sbt_mint

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `collection_address` | string | Yes | -- | Address of SBT collection to mint from |
| `owner_address` | string | Yes | -- | Who receives the SBT (permanent, non-transferable) |
| `name` | string | Yes | -- | SBT item name |
| `description` | string | No | -- | SBT item description |
| `image` | string | No | -- | URL to SBT item image |
| `authority_address` | string | No | agent wallet | Who can revoke the SBT |

Sends mint message to the collection contract. Cost: ~0.1 TON.

## SBT reference

Soulbound Tokens ([TEP-85](https://github.com/ton-blockchain/TEPs/blob/master/text/0085-sbt-standard.md)) are non-transferable NFTs permanently bound to their owner.

- **Non-transferable** -- transfer always rejected (error 413)
- **Authority** -- optional address that can revoke the SBT via `revoke` opcode
- **Destroyable** -- the owner can self-destruct their SBT
- **On-chain proofs** -- `prove_ownership` for smart contract verification

Contract BOCs extracted from [@ton-community/assets-sdk](https://github.com/ton-community/assets-sdk) v0.0.5.
