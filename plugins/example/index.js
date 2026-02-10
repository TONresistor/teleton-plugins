/**
 * Example plugin — simple ping/pong tool
 *
 * Install: cp -r plugins/example ~/.teleton/plugins/
 */

export const tools = [
  {
    name: "ping",
    description: "Replies with pong. Use this to test if plugins are working.",
    parameters: {
      type: "object",
      properties: {},
    },
    execute: async (_params, _context) => {
      return { success: true, data: { message: "pong" } };
    },
  },
];
