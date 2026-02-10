# example

A randomness toolkit plugin that demonstrates the full Teleton plugin API.

| Tool | Description |
|------|-------------|
| `dice_roll` | Roll configurable dice (sides, count, modifier) |
| `random_pick` | Pick a random item from a list of choices |

## What this example demonstrates

- **Parameters**: required vs optional, defaults, different types (integer, string, array)
- **Context**: using `senderId`, `chatId`, and `isGroup` from the execution context
- **Error handling**: returning `{ success: false, error: "..." }` for invalid input
- **Multiple tools**: exporting more than one tool from a single plugin

## Install

```bash
mkdir -p ~/.teleton/plugins
cp -r plugins/example ~/.teleton/plugins/
```

## Usage examples

Ask the AI:

- "Roll 2d20+5"
- "Roll a d100"
- "Pick randomly between pizza, sushi, and tacos"
- "Choose someone for the task: Alice, Bob, Charlie"

## Tool schemas

### dice_roll

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `sides` | integer | No | 6 | Sides per die (2-100) |
| `count` | integer | No | 1 | Number of dice (1-20) |
| `modifier` | integer | No | 0 | Bonus/penalty on total |

### random_pick

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `choices` | string[] | **Yes** | Options to choose from (min 2) |
