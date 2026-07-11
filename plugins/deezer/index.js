/**
 * Deezer plugin -- search and send music via the @DeezerMusicBot inline bot
 *
 * Uses GramJS MTProto to query @DeezerMusicBot inline results and send them directly in chat.
 * Messages appear "via @DeezerMusicBot" just like typing @DeezerMusicBot in the Telegram input field.
 */

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const manifest = {
  name: "deezer",
  version: "2.0.0",
  sdkVersion: "^2.1.0",
  description: "Search and send music tracks in chat via Telegram's @DeezerMusicBot inline bot.",
};

export const tools = (sdk) => [
  {
    name: "deezer",
    description:
      "Search and send a music track in the current chat using Telegram's @DeezerMusicBot inline bot (Deezer). " +
      "Provide a search query (artist, song title, album) and optionally pick a result by index. " +
      "The track is sent directly into the chat via @DeezerMusicBot.",
    category: "action",
    scope: "always",

    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Music search query — artist, song title, or album (e.g. 'Daft Punk', 'Bohemian Rhapsody', 'Stromae Papaoutai')",
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
          "DeezerMusicBot",
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
