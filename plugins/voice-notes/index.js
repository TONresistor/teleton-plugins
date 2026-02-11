import { createRequire } from "node:module";

const require = createRequire(process.argv[1] || process.cwd() + "/index.js");
const { Api } = require("telegram");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const tools = [
  {
    name: "transcribe_voice",
    description:
      "Transcribe a voice message or video note using Telegram Premium speech-to-text. " +
      "ALWAYS use this when you see [🎤 voice msg_id=...] or [🎬 video_note msg_id=...]. " +
      "Pass the msg_id number from the tag as message_id.",
    parameters: {
      type: "object",
      properties: {
        message_id: {
          type: "number",
          description: "The msg_id number from the [🎤 voice msg_id=...] tag",
        },
      },
      required: ["message_id"],
    },
    execute: async (params, context) => {
      try {
        const { message_id } = params;
        const chatId = context.chatId;
        const gramJsClient = context.bridge.getClient().getClient();

        const result = await gramJsClient.invoke(
          new Api.messages.TranscribeAudio({
            peer: chatId,
            msgId: message_id,
          })
        );

        if (!result.pending && result.text) {
          return {
            success: true,
            data: {
              text: result.text,
              message: `User said: ${result.text}`,
            },
          };
        }

        if (result.pending) {
          for (let attempt = 0; attempt < 10; attempt++) {
            await sleep(1500);

            try {
              const check = await gramJsClient.invoke(
                new Api.messages.TranscribeAudio({
                  peer: chatId,
                  msgId: message_id,
                })
              );

              if (!check.pending && check.text) {
                return {
                  success: true,
                  data: {
                    text: check.text,
                    message: `User said: ${check.text}`,
                  },
                };
              }
            } catch {
              // Ignore poll errors, keep trying
            }
          }

          return {
            success: false,
            error:
              "Transcription is still processing after 15 seconds. " +
              (result.text ? `Partial: ${result.text}` : "Try again later."),
          };
        }

        return {
          success: false,
          error: "Transcription returned empty result. The message may not contain audio.",
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);

        if (msg.includes("PREMIUM_ACCOUNT_REQUIRED")) {
          return {
            success: false,
            error: "Telegram Premium is required for voice transcription.",
          };
        }
        if (msg.includes("MSG_ID_INVALID")) {
          return {
            success: false,
            error: "Invalid message ID. Make sure the message exists and contains audio.",
          };
        }

        return { success: false, error: msg };
      }
    },
  },
];
