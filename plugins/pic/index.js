/**
 * Pic plugin -- search and send images via the @pic inline bot (Yandex Image Search)
 *
 * Uses GramJS MTProto to query @pic inline results and send them directly in chat.
 * Messages appear "via @pic" just like typing @pic in the Telegram input field.
 */

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const manifest = {
  name: "pic",
  version: "2.0.0",
  sdkVersion: "^2.1.0",
  description: "Search and send images in chat via Telegram's @pic inline bot (Yandex Image Search).",
};

export const tools = (sdk) => [
  {
    name: "pic",
    description:
      "Search and send an image in the current chat using Telegram's @pic inline bot (Yandex Image Search). " +
      "Provide a search query and optionally pick a result by index. The image is sent directly into the chat via @pic.",
    category: "action",
    scope: "always",

    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Image search query (e.g. 'sunset', 'cute cat', 'TON blockchain logo')",
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
          "pic",
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
