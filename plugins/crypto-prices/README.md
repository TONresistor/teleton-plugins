# crypto-prices

Real-time cryptocurrency prices and comparison via [CryptoCompare API](https://min-api.cryptocompare.com/) — free, no API key required. Supports 5000+ coins with USD and RUB prices.

## Tools

| Tool | Description |
|------|-------------|
| `crypto_price` | Get current price for any coin in USD and RUB with 24h/1h change, market cap and volume |
| `crypto_compare` | Compare up to 5 cryptocurrencies side by side |

## Install

```bash
mkdir -p ~/.teleton/plugins
cp -r plugins/crypto-prices ~/.teleton/plugins/
```

## Usage

Ask the AI:

- "What's the price of Bitcoin?"
- "How much is ETH right now?"
- "TON price in USD and RUB"
- "Compare BTC, ETH and TON"
- "Show me SOL and DOGE prices"
- "Is Bitcoin up or down today?"

## Schemas

### crypto_price

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `coin` | string | yes | -- | Coin name or ticker symbol (e.g. "BTC", "bitcoin", "ETH", "TON", "SOL", "DOGE") |

**Returns:** price in USD and RUB, 24h and 1h change, 24h high/low, market cap, 24h volume.

### crypto_compare

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `coins` | string | yes | -- | Comma-separated coin names or symbols, up to 5 (e.g. "BTC,ETH,TON") |

**Returns:** price, 24h change and market cap for each coin.

## Supported coins

5000+ coins via CryptoCompare including all major tokens: BTC, ETH, TON, SOL, DOGE, XRP, BNB, ADA, DOT, MATIC, AVAX, LINK, UNI, USDT, USDC and more.

## API reference

- [CryptoCompare API](https://min-api.cryptocompare.com/) — free tier, no key required
- [CryptoCompare documentation](https://min-api.cryptocompare.com/documentation)
