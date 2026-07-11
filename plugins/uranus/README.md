# Uranus Meme Launchpad

Production-oriented Teleton SDK v2.1 plugin for the Uranus Meme lifecycle on TON mainnet. It verifies contract code before financial actions and delegates every signature to Teleton's protected transaction broker.

## Tools

| Tool | Access | Purpose |
|---|---|---|
| `uranus_protocol_info` | Public read | Deployments, hashes, presets and limits |
| `uranus_recent_launches` | Public read | Decode recent known-factory launches |
| `uranus_meme_info` | Public read | Meme, curve, partner and metadata state |
| `uranus_wallet_info` | Public read | Derived Meme Wallet and verified balance |
| `uranus_portfolio` | Admin read | Code-verified Uranus holdings |
| `uranus_quote` | Public read | Fresh curve or migrated DeDust quote |
| `uranus_recent_trades` | Public read | Decoded Buy/Sell events and fees |
| `uranus_buy` / `uranus_sell` | Admin + approval | Curve or DeDust trade |
| `uranus_launch_preset` / `uranus_launch_custom` | Admin + approval | v3.1 factory launch |
| `uranus_claim_creator_fee` / `uranus_claim_partner_fee` | Admin + approval | Claim to verified on-chain destination |

## Configuration

```yaml
plugins:
  uranus:
    maxActionTon: "50"
    defaultSlippageBps: 500
    partnerId: null
    partnerFeeBps: 0
    referrerId: null
    referrerFeeBps: 0
    allowThirdPartyPartnerClaim: false
```

`toncenter_api_key` is an optional plugin secret. Public reads still work without it, subject to Toncenter rate limits. Affiliate IDs are trusted static configuration and cannot be supplied by a tool call.

`allowThirdPartyPartnerClaim` remains fail-closed in v1: current mainnet evidence proves claims sent by the stored partner, but does not prove permissionless third-party triggering. Enabling the setting cannot redirect payouts or bypass this proof gate.

## Safety model

- Mainnet only; deployments always target the active Uranus v3.1 factory.
- Amounts are decimal strings and contract calculations use `bigint`.
- The plugin generates query IDs and minimum outputs internally.
- Code hash, wallet owner/master and payout authorization are checked before writes.
- A Teleton wallet commit is not treated as downstream completion: curve balances, fee state or factory output are polled for up to 30 seconds.
- A timeout returns `submitted_unsettled`, never a false confirmed result.
- Graduated and migrated tokens route only through DeDust CPMM.
- Metadata responses are capped at 2 MiB, time out after 10 seconds and reject local/private redirect targets.

Observed conservative attached-value budgets are 0.10 TON for buys, 0.12 TON for sells, 0.50 TON for launches, 0.10 TON for creator claims and 0.30 TON for partner claims. These are safe message budgets, not Uranus protocol fees; unused value may be refunded by the contracts.

Uranus reference documentation is currently marked under construction. The plugin combines documented layouts with verified mainnet code hashes and fails closed on unsupported identity or state.
