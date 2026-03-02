import { initSchema } from "./utils/order-repository.js";
import { createTools } from "./utils/tool-definitions.js";
import type { PluginContext, PluginManifest, RuntimeSdk } from "./utils/types.js";

export const manifest: PluginManifest = {
  name: "fragment-stars-plugin",
  version: "1.0.0",
  author: "d1nckache",
  description: "Buy Telegram Stars through TON payment and Fragment API",
  sdkVersion: ">=1.0.0",
  defaultConfig: {
    fragment_api_url: "http://127.0.0.1:8000/api/v1/stars",
    fragment_api_timeout_ms: 240000,
    payment_ttl_minutes: 15,
  },
  secrets: {
    fragment_api_token: {
      required: true,
      description: "Required token for X-Fragment-Api-Token header to Fragment Stars API",
    },
  },
};

const activeChecks = new Set<string>();
let runtimeSdk: RuntimeSdk | null = null;

export function migrate(db: RuntimeSdk["db"]): void {
  initSchema(db);
}

export async function start(ctx: PluginContext): Promise<void> {

}

export const tools = (sdk: RuntimeSdk) => {
  runtimeSdk = sdk;
  return createTools(sdk, activeChecks);
};
