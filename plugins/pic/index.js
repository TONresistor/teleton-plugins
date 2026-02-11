/**
 * Pic plugin -- search and send images via the @pic inline bot (Yandex Image Search)
 *
 * Uses GramJS MTProto to query @pic inline results and send them directly in chat.
 * Messages appear "via @pic" just like typing @pic in the Telegram input field.
 */

import { createRequire } from "node:module";
import { realpathSync } from "node:fs";

// Resolve "telegram" from teleton's own node_modules (not the plugin directory).
// realpathSync follows the symlink so createRequire looks in the right node_modules.
const _require = createRequire(realpathSync(process.argv[1]));
const { Api } = _require("telegram");

// ---------------------------------------------------------------------------
// Tool: pic
// ---------------------------------------------------------------------------

const pic = {
  name: "pic",
  description:
    "Search and send an image in the current chat using Telegram's @pic inline bot (Yandex Image Search). " +
    "Provide a search query and optionally pick a result by index. The image is sent directly into the chat via @pic.",

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
      const client = context.bridge.getClient().getClient();
      const picBot = await client.getEntity("pic");
      const peer = await client.getInputEntity(context.chatId);

      const results = await client.invoke(
        new Api.messages.GetInlineBotResults({
          bot: picBot,
          peer,
          query: params.query,
          offset: "",
        })
      );

      if (!results.results || results.results.length === 0) {
        return { success: false, error: `No images found for "${params.query}"` };
      }

      const index = params.index ?? 0;
      if (index >= results.results.length) {
        return {
          success: false,
          error: `Only ${results.results.length} results available, index ${index} is out of range`,
        };
      }

      const chosen = results.results[index];

      await client.invoke(
        new Api.messages.SendInlineBotResult({
          peer,
          queryId: results.queryId,
          id: chosen.id,
          randomId: BigInt(Math.floor(Math.random() * 2 ** 62)),
        })
      );

      return {
        success: true,
        data: {
          query: params.query,
          sent_index: index,
          total_results: results.results.length,
          title: chosen.title || null,
          description: chosen.description || null,
          type: chosen.type || null,
        },
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
};

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const tools = [pic];
