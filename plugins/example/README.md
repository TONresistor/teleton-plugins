# example

Randomness toolkit -- dice roller and random picker.

Use this plugin as a starting point for your own. Copy the folder, rename it, and replace the tools.

```bash
cp -r plugins/example plugins/your-plugin
```

## Tools

| Tool | Description |
|------|-------------|
| `dice_roll` | Roll configurable dice (sides, count, modifier) |
| `random_pick` | Pick a random item from a list of choices |

## Install

```bash
mkdir -p ~/.teleton/plugins
cp -r plugins/example ~/.teleton/plugins/
```

## Usage

Ask the AI:

- "Roll 2d20+5"
- "Roll a d100"
- "Pick randomly between pizza, sushi, and tacos"
- "Choose someone for the task: Alice, Bob, Charlie"

## Schemas

### dice_roll

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `sides` | integer | No | 6 | Sides per die (2-100) |
| `count` | integer | No | 1 | Number of dice (1-20) |
| `modifier` | integer | No | 0 | Bonus/penalty on total |

### random_pick

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `choices` | string[] | Yes | -- | Options to choose from (min 2) |

## What this demonstrates

- Optional params with defaults vs required params
- Different JSON Schema types: integer, string, array
- Input validation with error returns
- Using context (`senderId`, `chatId`, `isGroup`)
- Multiple tools in a single plugin
