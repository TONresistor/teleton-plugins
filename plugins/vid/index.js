/**
 * Vid plugin -- search and send YouTube videos via the @vid inline bot
 *
 * Uses GramJS MTProto to query @vid inline results and send them directly in chat.
 * Messages appear "via @vid" just like typing @vid in the Telegram input field.
 */

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const manifest = {
  name: "vid",
  version: "2.0.0",
  sdkVersion: "^2.1.0",
  description: "Search and send YouTube videos in chat via Telegram's @vid inline bot.",
};

export const tools = (sdk) => [
  {
    name: "vid",
    description:
      "Search and send a YouTube video in the current chat using Telegram's @vid inline bot (YouTube Search). " +
      "Provide a search query and optionally pick a result by index. The video is sent directly into the chat via @vid.",
    category: "action",
    scope: "always",

    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "YouTube video search query (e.g. 'funny cat', 'TON blockchain', 'cooking tutorial')",
        },
        index: {
          type: "integer",
          description: "Which result to send (0 = first, 1 = second, etc.). Defaults to 0.",
          minimum: 0,
          maximum: 49,
        },
      },
      required: ["query"],
    },

    execute: async (params, context) => {
      try {
        const result = await sdk.telegram.sendInlineBotResult(
          context.chatId,
          "vid",
          params.query,
          params.index
        );

        return {
          success: true,
          data: {
            query: result.query,
            sent_index: result.sentIndex,
            total_results: result.totalResults,
            title: result.title,
            description: result.description,
            type: result.type,
          },
        };
      } catch (err) {
        return { success: false, error: String(err.message || err).slice(0, 500) };
      }
    },
  },
];
