import { ACTIVE_FACTORY, DOCS, FACTORIES, FEE_PRESETS, GAS_NANO, MEME_CODE_HASHES, MEME_LIBRARY_HASHES, NETWORK, PRESET_DEPLOYS, TOTAL_SUPPLY_PRESETS, WALLET_CODE_HASHES, WALLET_LIBRARY_HASHES } from "./constants.js";
import { createHttp } from "./http.js";
import { createState } from "./state.js";
import { createQuote } from "./quote.js";
import { createHistory } from "./history.js";
import { createActions } from "./actions.js";
import { errorResult, UranusError } from "./errors.js";

export const manifest = {
  name: "uranus",
  version: "1.0.0",
  sdkVersion: "^2.1.0",
  description: "Uranus Meme launchpad on TON — inspect, quote, trade, deploy and claim fees.",
  defaultConfig: {
    maxActionTon: "50",
    defaultSlippageBps: 500,
    partnerId: null,
    partnerFeeBps: 0,
    referrerId: null,
    referrerFeeBps: 0,
    allowThirdPartyPartnerClaim: false,
  },
  secrets: {
    toncenter_api_key: { required: false, description: "Optional Toncenter v3 key for launch/trade history rate limits" },
  },
};

const object = (properties, required = []) => ({ type: "object", properties, required, additionalProperties: false });
const address = (description) => ({ type: "string", minLength: 48, maxLength: 80, description });
const decimal = (description) => ({ type: "string", pattern: "^(0|[1-9][0-9]*)(\\.[0-9]+)?$", description });
const slippage = { type: "integer", minimum: 1, maximum: 5000, default: 500, description: "Slippage tolerance in basis points" };
const memeAddress = address("Uranus Meme master contract address");

function publicInfo(info) {
  const { _raw, ...result } = info;
  return result;
}

function publicQuote(quote) {
  const { _raw, _info, ...result } = quote;
  return result;
}

function safe(sdk, name, execute) {
  return async (params = {}, context = {}) => {
    try {
      return { success: true, data: await execute(params, context) };
    } catch (error) {
      return errorResult(error, sdk.log, name);
    }
  };
}

function isAdminContext(context) {
  return Boolean(context?.config?.telegram?.admin_ids?.includes(context.senderId));
}

export const tools = (sdk) => {
  const config = { ...manifest.defaultConfig, ...(sdk.pluginConfig ?? {}) };
  const http = createHttp(sdk);
  const state = createState(sdk, http);
  const quote = createQuote(sdk, state, config);
  const history = createHistory(sdk, http);
  const actions = createActions(sdk, { config, state, quote, history });
  return [
    {
      name: "uranus_protocol_info",
      description: "Return verified Uranus deployments, code hashes, presets, validation ranges, gas budgets and documentation links.",
      scope: "always", category: "data-bearing", parameters: object({}),
      execute: safe(sdk, "uranus_protocol_info", async () => ({
        network: NETWORK,
        active_factory: ACTIVE_FACTORY,
        factories: { ...FACTORIES },
        meme_code_hashes: { ...MEME_CODE_HASHES }, meme_library_hashes: { ...MEME_LIBRARY_HASHES },
        wallet_code_hashes: { ...WALLET_CODE_HASHES }, wallet_library_hashes: { ...WALLET_LIBRARY_HASHES },
        preset_deploys: PRESET_DEPLOYS.map((value) => ({ ...value })),
        total_supply_presets: TOTAL_SUPPLY_PRESETS.map((value) => ({ ...value })),
        fee_presets: FEE_PRESETS.map((value) => ({ ...value })),
        custom_ranges: { raising_funds_ton: ["800", "1000000"], on_sell_supply_percent: [60, 80], partner_fee_bps: [0, 6000], pool_partner_fee_bps: [0, 4000] },
        observed_safe_budget_ton: Object.fromEntries(Object.entries(GAS_NANO).filter(([key]) => key !== "ACTION_HEADROOM").map(([key, value]) => [key.toLowerCase(), (Number(value) / 1e9).toString()])),
        documentation: { ...DOCS },
        warning: "Uranus Developer Hub reference pages are marked under construction; actions also verify current on-chain identity and state.",
      })),
    },
    {
      name: "uranus_recent_launches", description: "Discover and decode recent Uranus factory launches from Toncenter v3.",
      scope: "always", category: "data-bearing",
      parameters: object({ limit: { type: "integer", minimum: 1, maximum: 50, default: 10 }, factory_version: { type: "string", enum: ["v3.1", "v3.0", "v2", "all"], default: "v3.1" } }),
      execute: safe(sdk, "uranus_recent_launches", (params) => history.recentLaunches(params)),
    },
    {
      name: "uranus_meme_info", description: "Inspect and verify Uranus Meme identity, jetton metadata, curve state, lifecycle and accrued fees.",
      scope: "always", category: "data-bearing", parameters: object({ meme_address: memeAddress }, ["meme_address"]),
      execute: safe(sdk, "uranus_meme_info", async ({ meme_address }) => publicInfo(await state.memeInfo(meme_address))),
    },
    {
      name: "uranus_wallet_info", description: "Resolve an owner's Uranus Meme Wallet and verify its owner, master and balance.",
      scope: "always", category: "data-bearing", parameters: object({ meme_address: memeAddress, owner_address: address("Owner address; omit only in an admin context to inspect the Teleton wallet") }, ["meme_address"]),
      execute: safe(sdk, "uranus_wallet_info", async (params, context) => {
        if (!params.owner_address && !isAdminContext(context)) throw new UranusError("SENDER_UNAUTHORIZED", "owner_address is required outside an admin context");
        const { _rawBalance, ...result } = await state.walletInfo(params.meme_address, params.owner_address);
        return result;
      }),
    },
    {
      name: "uranus_portfolio", description: "List only code-verified Uranus holdings in the configured Teleton wallet.",
      scope: "admin-only", category: "data-bearing", parameters: object({ include_zero: { type: "boolean", default: false }, limit: { type: "integer", minimum: 1, maximum: 100, default: 50 } }),
      execute: safe(sdk, "uranus_portfolio", (params) => state.portfolio(params)),
    },
    {
      name: "uranus_quote", description: "Quote a Uranus curve trade from fresh on-chain state, or DeDust after migration, with internal slippage protection.",
      scope: "always", category: "data-bearing", parameters: object({ meme_address: memeAddress, direction: { type: "string", enum: ["buy", "sell"] }, amount: decimal("TON for buy, token units for sell"), slippage_bps: slippage }, ["meme_address", "direction", "amount"]),
      execute: safe(sdk, "uranus_quote", async (params) => publicQuote(await quote(params))),
    },
    {
      name: "uranus_recent_trades", description: "Decode recent Uranus BuyEvent and SellEvent records with their complete fee breakdown.",
      scope: "always", category: "data-bearing", parameters: object({ meme_address: memeAddress, limit: { type: "integer", minimum: 1, maximum: 50, default: 10 } }, ["meme_address"]),
      execute: safe(sdk, "uranus_recent_trades", (params) => history.recentTrades(params)),
    },
    {
      name: "uranus_buy", description: "Buy a verified Uranus Meme on its curve or DeDust after migration; quote and destination are derived internally.",
      scope: "admin-only", category: "action", requiresApproval: true,
      parameters: object({ meme_address: memeAddress, amount_ton: decimal("TON amount to spend"), slippage_bps: slippage }, ["meme_address", "amount_ton"]),
      execute: safe(sdk, "uranus_buy", actions.buy),
    },
    {
      name: "uranus_sell", description: "Sell a verified Uranus Meme on its curve or DeDust after migration; minimum output is derived internally.",
      scope: "admin-only", category: "action", requiresApproval: true,
      parameters: object({ meme_address: memeAddress, amount_tokens: decimal("Human-readable token amount to sell"), slippage_bps: slippage }, ["meme_address", "amount_tokens"]),
      execute: safe(sdk, "uranus_sell", actions.sell),
    },
    {
      name: "uranus_launch_preset", description: "Launch a Uranus v3.1 Meme with preset economics and an already-published metadata URI.",
      scope: "admin-only", category: "action", requiresApproval: true,
      parameters: object({ preset_id: { type: "integer", minimum: 3, maximum: 9 }, metadata_uri: { type: "string", minLength: 1, maxLength: 1024 }, initial_buy_ton: decimal("Optional initial TON buy; defaults to zero") }, ["preset_id", "metadata_uri"]),
      execute: safe(sdk, "uranus_launch_preset", actions.launchPreset),
    },
    {
      name: "uranus_launch_custom", description: "Launch a customized Uranus v3.1 Meme with validated factory economics and fixed payout addresses.",
      scope: "admin-only", category: "action", requiresApproval: true,
      parameters: object({
        total_supply_preset_id: { type: "integer", minimum: 0, maximum: 2 }, base_fee_preset_id: { type: "integer", minimum: 0, maximum: 7 },
        raising_funds_ton: decimal("Raise target from 800 to 1,000,000 TON"), on_sell_supply_percent: { type: "integer", minimum: 60, maximum: 80 },
        partner_address: address("Partner payout address; defaults to the Teleton wallet"), partner_fee_bps: { type: "integer", minimum: 0, maximum: 6000 },
        pool_partner_fee_bps: { type: "integer", minimum: 0, maximum: 4000 }, pool_base_fee_preset_id: { type: "integer", minimum: 0, maximum: 7 },
        pool_liquidity_owner_address: address("Optional post-migration liquidity owner"), metadata_uri: { type: "string", minLength: 1, maxLength: 1024 },
        initial_buy_ton: decimal("Optional initial TON buy; defaults to zero"),
      }, ["total_supply_preset_id", "base_fee_preset_id", "raising_funds_ton", "on_sell_supply_percent", "partner_fee_bps", "pool_partner_fee_bps", "pool_base_fee_preset_id", "metadata_uri"]),
      execute: safe(sdk, "uranus_launch_custom", actions.launchCustom),
    },
    {
      name: "uranus_claim_creator_fee", description: "Claim accrued creator fees when the Teleton wallet matches the verified on-chain creator.",
      scope: "admin-only", category: "action", requiresApproval: true, parameters: object({ meme_address: memeAddress }, ["meme_address"]),
      execute: safe(sdk, "uranus_claim_creator_fee", actions.claimCreatorFee),
    },
    {
      name: "uranus_claim_partner_fee", description: "Claim accrued partner fees to the immutable on-chain partner destination when sender policy permits.",
      scope: "admin-only", category: "action", requiresApproval: true, parameters: object({ meme_address: memeAddress }, ["meme_address"]),
      execute: safe(sdk, "uranus_claim_partner_fee", actions.claimPartnerFee),
    },
  ];
};
