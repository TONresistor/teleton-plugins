# Teleton Casino

Slot machine and dice games with TON payments and auto-payout.

| Tool | Description |
|------|-------------|
| `casino_balance` | Check casino bankroll and betting limits |
| `casino_spin` | Execute a slot machine spin |
| `casino_dice` | Execute a dice roll |
| `casino_my_stats` | Show player's personal statistics |

## Install

```bash
mkdir -p ~/.teleton/plugins
cp -r plugins/casino ~/.teleton/plugins/
```

## Usage examples

- "Check the casino balance"
- "I want to play slots, bet 1 TON"
- "Roll the dice for 0.5 TON"
- "Show my casino stats"

## Payout tables

### Slots (🎰)

| Value | Result | Multiplier |
|-------|--------|------------|
| 64 | 777 | 5x |
| 60-63 | Big win | 2.5x |
| 55-59 | Medium win | 1.8x |
| 43-54 | Small win | 1.2x |
| 1-42 | No win | 0x |

### Dice (🎲)

| Value | Result | Multiplier |
|-------|--------|------------|
| 6 | Top roll | 2.5x |
| 5 | Big win | 1.8x |
| 4 | Small win | 1.3x |
| 1-3 | No win | 0x |

## How it works

1. Player sends TON to the casino wallet with their username as memo
2. System verifies the payment on-chain (1% amount tolerance, 10-min time window)
3. Dice/slot animation is sent in Telegram
4. If the player wins, payout is sent automatically to the sender's wallet

## Security

- **Replay protection**: Composite key `from:amount:date` prevents double-spend
- **Rate limiting**: 5 attempts per minute, 5-min block on abuse
- **Cooldown**: 30 seconds between spins per user (DB-backed, atomic)
- **Max bet**: Limited to 5% of bankroll and max-multiplier coverage

## Configuration

In your `config.yaml` under `plugins.casino`:

```yaml
plugins:
  casino:
    min_bet: 0.1
    max_bet_percent: 5
    min_bankroll: 10
    cooldown_seconds: 30
    max_payment_age_minutes: 10
```

## Tool schema

### casino_spin / casino_dice

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `chat_id` | string | Yes | — | Telegram chat ID |
| `bet_amount` | number | Yes | — | Bet amount in TON (min 0.1) |
| `player_username` | string | Yes | — | Player's username (no @) |
| `reply_to` | integer | No | — | Message ID to reply to |
