/**
 * Example plugin — randomness toolkit (dice + picker)
 *
 * Demonstrates:
 *  - Parameters with JSON Schema (required, optional, defaults, types)
 *  - Using context (senderId, chatId, isGroup)
 *  - Success and error return patterns
 *  - Multiple tools in a single plugin
 *
 * Install: cp -r plugins/example ~/.teleton/plugins/
 */

// ── Tool 1: dice_roll ───────────────────────────────────────────────

const diceRoll = {
  name: "dice_roll",
  description:
    "Roll one or more dice with configurable sides. Useful for games, decisions, or tabletop RPGs.",
  parameters: {
    type: "object",
    properties: {
      sides: {
        type: "integer",
        description: "Number of sides per die (2-100)",
        minimum: 2,
        maximum: 100,
      },
      count: {
        type: "integer",
        description: "Number of dice to roll (1-20)",
        minimum: 1,
        maximum: 20,
      },
      modifier: {
        type: "integer",
        description: "Bonus or penalty added to the total (can be negative)",
      },
    },
  },

  execute: async (params, context) => {
    const sides = params.sides ?? 6;
    const count = params.count ?? 1;
    const modifier = params.modifier ?? 0;

    if (sides < 2 || sides > 100) {
      return { success: false, error: `sides must be between 2 and 100 (got ${sides})` };
    }
    if (count < 1 || count > 20) {
      return { success: false, error: `count must be between 1 and 20 (got ${count})` };
    }

    const rolls = [];
    for (let i = 0; i < count; i++) {
      rolls.push(Math.floor(Math.random() * sides) + 1);
    }

    const rawTotal = rolls.reduce((sum, r) => sum + r, 0);
    const total = rawTotal + modifier;

    let formula = `${count}d${sides}`;
    if (modifier > 0) formula += `+${modifier}`;
    else if (modifier < 0) formula += `${modifier}`;

    return {
      success: true,
      data: {
        formula,
        rolls,
        total,
        rolledBy: context.senderId,
        isGroupRoll: context.isGroup,
      },
    };
  },
};

// ── Tool 2: random_pick ─────────────────────────────────────────────

const randomPick = {
  name: "random_pick",
  description:
    "Randomly pick one item from a list of choices. Use for decisions, assignments, or draws.",
  parameters: {
    type: "object",
    properties: {
      choices: {
        type: "array",
        items: { type: "string" },
        minItems: 2,
        description: "List of options to choose from (minimum 2)",
      },
    },
    required: ["choices"],
  },

  execute: async (params, context) => {
    const { choices } = params;

    if (!Array.isArray(choices) || choices.length < 2) {
      return { success: false, error: "choices must be an array with at least 2 items" };
    }

    const valid = choices.filter((c) => typeof c === "string" && c.trim().length > 0);
    if (valid.length < 2) {
      return { success: false, error: "Need at least 2 non-empty choices" };
    }

    const picked = valid[Math.floor(Math.random() * valid.length)];

    return {
      success: true,
      data: {
        picked,
        totalChoices: valid.length,
        chatId: context.chatId,
      },
    };
  },
};

// ── Export ─────────────────────────────────────────────────────────

export const tools = [diceRoll, randomPick];
