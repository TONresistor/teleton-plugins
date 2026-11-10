# GroypFi Groypad Plugin for Teleton Agent

Enable AI agents to deploy and trade tokens on Groypad, a bonding-curve memecoin launchpad on TON.

Website: [https://groypfi.io](https://groypfi.io)
Docs: [https://groypfi.io/docs/groypad](https://groypfi.io/docs/groypad)
Telegram Bot: [@groypfi_bot](https://t.me/groypfi_bot)
DefiLlama: [https://defillama.com/protocol/fees/groypfi](https://defillama.com/protocol/fees/groypfi)

## Install

Option 1 (WebUI Marketplace):
- Start Teleton with `teleton start --webui`
- Open `Plugins -> Marketplace`
- Install `GroypFi Groypad`

Option 2 (Manual):

```bash
git clone https://github.com/TONresistor/teleton-plugins.git
cp -r teleton-plugins/plugins/groypfi-groypad ~/.teleton/plugins/

/plugin set groypfi-groypad SUPABASE_ANON_KEY <your-key>
/plugin set groypfi-groypad TONCENTER_API_KEY <your-key>
```

Requirements:
- Teleton SDK v1.0.0+
- TON wallet configured

## Available Tools

- `groypad_deploy`: Deploy a new memecoin with metadata and initial buy (minimum 10 TON).
- `groypad_list_tokens`: List active Groypad tokens with market cap and progress.
- `groypad_token_info`: Get on-chain bonding curve data (price, supply, progress).
- `groypad_get_quote`: Preview buy/sell quote without executing a trade.
- `groypad_buy`: Buy tokens on the bonding curve.
- `groypad_sell`: Sell tokens back to the bonding curve.
- `groypad_claim_fee`: Claim accumulated creator trading fees.

## Usage Examples

- "Deploy a token called Pepe with ticker PEPE and 20 TON initial buy"
- "How many tokens would I get for 10 TON on EQ...?"
- "List trending Groypad tokens"
- "Buy 5 TON of PEPE on Groypad"
- "Sell all my DOGE tokens on Groypad"
- "Claim my creator fees from EQ..."

## Notes

Both Groypad and Uranus use the same MemeFactory contract (`EQAO4cYq...`).
Groypad deployments are identifiable by the `Groypad` memo attached to the Deployer Wallet transaction.

## License

MIT
