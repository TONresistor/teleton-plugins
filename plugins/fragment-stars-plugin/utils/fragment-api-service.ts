import { getPluginConfig } from "./common.js";
import type { RuntimeSdk } from "./types.js";

interface FragmentApiQuotePayload {
  username: string;
  quantity: number;
  show_sender: boolean;
}

export interface FragmentApiPurchaseResult {
  ok: boolean;
  status: string;
  message: string;
  purchase_id: string;
  ref_id: string;
  req_id?: string | null;
  cost_ton?: string | null;
  tx_hash?: string | null;
  tx_to?: string | null;
  tx_amount_nano?: string | null;
  refund_address?: string | null;
  refund_amount_nano?: string | null;
  error?: string | null;
}

export interface FragmentApiQuoteResult {
  ok: boolean;
  message: string;
  username: string;
  quantity: number;
  fragment_cost_ton: string;
  pay_amount_ton: string;
  pay_amount_nano: string;
}

export interface FragmentApiCreateOrderPayload {
  username: string;
  quantity: number;
  show_sender: boolean;
  ref_id: string;
  fee_address: string;
}

export interface FragmentApiCreateOrderResult {
  ok: boolean;
  message: string;
  purchase_id: string;
  ref_id: string;
  pay_to_address: string;
  pay_deeplink: string;
  fragment_cost_ton: string;
  pay_amount_ton: string;
  pay_amount_nano: string;
}

export interface FragmentApiProcessOrderPayload {
  ref_id: string;
  fee_address?: string;
}

export interface FragmentApiProcessOrderResult {
  ok: boolean;
  status: string;
  message: string;
  purchase_id: string;
  ref_id: string;
  req_id?: string | null;
  cost_ton?: string | null;
  tx_hash?: string | null;
  tx_to?: string | null;
  tx_amount_nano?: string | null;
  refund_address?: string | null;
  refund_amount_nano?: string | null;
  payment_tx?: string | null;
  payment_from?: string | null;
  error?: string | null;
}

function getStarsBaseUrlFromSdk(sdk: RuntimeSdk): string {
  const raw = String(getPluginConfig(sdk, "fragment_api_url", "http://127.0.0.1:8000/api/v1/stars"));
  const trimmed = raw.replace(/\/$/, "");
  if (trimmed.endsWith("/purchase")) return trimmed.slice(0, -"/purchase".length);
  if (trimmed.endsWith("/quote")) return trimmed.slice(0, -"/quote".length);
  return trimmed;
}

function getApiTimeoutMsFromSdk(sdk: RuntimeSdk): number {
  return Number(getPluginConfig(sdk, "fragment_api_timeout_ms", 240000));
}

function requireApiTokenFromSdk(sdk: RuntimeSdk): string {
  const rawSecret = sdk.secrets?.get("fragment_api_token");
  const tokenFromSecrets = rawSecret ? String(rawSecret).trim() : "";
  if (tokenFromSecrets) {
    return tokenFromSecrets;
  }

  const rawConfig = sdk.pluginConfig?.fragment_api_token;
  const tokenFromConfig = typeof rawConfig === "string" ? rawConfig.trim() : "";
  if (tokenFromConfig) {
    return tokenFromConfig;
  }

  throw new Error("fragment_api_token is required to call Fragment API (set plugin secret or plugin config)");
}

function tokenHint(token: string | null): string {
  if (!token) return "none";
  const trimmed = token.trim();
  if (!trimmed) return "empty";
  const prefix = trimmed.slice(0, 2);
  const suffix = trimmed.slice(-2);
  return `${prefix}…${suffix} (len=${trimmed.length})`;
}

function tokenSource(sdk: RuntimeSdk): "secrets" | "pluginConfig" | "none" {
  if (sdk.secrets?.has("fragment_api_token")) return "secrets";
  if (sdk.pluginConfig?.fragment_api_token !== undefined) return "pluginConfig";
  return "none";
}

export async function executeFragmentQuote(
  sdk: RuntimeSdk,
  payload: FragmentApiQuotePayload,
): Promise<FragmentApiQuoteResult> {
  const apiUrl = `${getStarsBaseUrlFromSdk(sdk)}/quote`;
  const timeoutMs = getApiTimeoutMsFromSdk(sdk);
  const token = requireApiTokenFromSdk(sdk);
  const source = tokenSource(sdk);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    console.log("Fragment API request ->", {
      url: apiUrl,
      token_source: source,
      token_hint: tokenHint(token),
      payload,
    });

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-fragment-api-token": token,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const rawText = await response.text();

    console.log("Fragment API response <-", { url: apiUrl, status: response.status, body: rawText });
    
    let parsed: any = {};

    try {
      parsed = rawText ? JSON.parse(rawText) : {};
    } catch {
      parsed = { ok: false, error: `Fragment API returned non-JSON response: ${rawText.slice(0, 200)}` };
    }

    if (!response.ok) {
      const detail = parsed?.detail || parsed?.error || rawText || `HTTP ${response.status}`;
      sdk.log?.warn(
        "quote failed",
        JSON.stringify(
          {
            status: response.status,
            url: apiUrl,
            token_source: source,
            token_hint: tokenHint(token),
            detail: String(detail).slice(0, 200),
          },
          null,
          0,
        ),
      );
      throw new Error(`Fragment API request failed (${response.status}): ${String(detail)}`);
    }

    return parsed as FragmentApiQuoteResult;
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new Error(`Fragment API timed out after ${timeoutMs} ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function executeFragmentCreateOrder(
  sdk: RuntimeSdk,
  payload: FragmentApiCreateOrderPayload,
): Promise<FragmentApiCreateOrderResult> {
  const apiUrl = `${getStarsBaseUrlFromSdk(sdk)}/orders`;
  const timeoutMs = getApiTimeoutMsFromSdk(sdk);
  const token = requireApiTokenFromSdk(sdk);
  const source = tokenSource(sdk);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-fragment-api-token": token,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const rawText = await response.text();
    let parsed: any = {};

    try {
      parsed = rawText ? JSON.parse(rawText) : {};
    } catch {
      parsed = { ok: false, error: `Fragment API returned non-JSON response: ${rawText.slice(0, 200)}` };
    }

    if (!response.ok) {
      const detail = parsed?.detail || parsed?.error || rawText || `HTTP ${response.status}`;
      sdk.log?.warn(
        "order create failed",
        JSON.stringify(
          {
            status: response.status,
            url: apiUrl,
            token_source: source,
            token_hint: tokenHint(token),
            detail: String(detail).slice(0, 200),
          },
          null,
          0,
        ),
      );
      throw new Error(`Fragment API request failed (${response.status}): ${String(detail)}`);
    }

    return parsed as FragmentApiCreateOrderResult;
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new Error(`Fragment API timed out after ${timeoutMs} ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function executeFragmentProcessOrder(
  sdk: RuntimeSdk,
  payload: FragmentApiProcessOrderPayload,
): Promise<FragmentApiProcessOrderResult> {
  const apiUrl = `${getStarsBaseUrlFromSdk(sdk)}/orders/process`;
  const timeoutMs = getApiTimeoutMsFromSdk(sdk);
  const token = requireApiTokenFromSdk(sdk);
  const source = tokenSource(sdk);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-fragment-api-token": token,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const rawText = await response.text();
    let parsed: any = {};

    try {
      parsed = rawText ? JSON.parse(rawText) : {};
    } catch {
      parsed = { ok: false, error: `Fragment API returned non-JSON response: ${rawText.slice(0, 200)}` };
    }

    if (!response.ok) {
      const detail = parsed?.detail || parsed?.error || rawText || `HTTP ${response.status}`;
      sdk.log?.warn(
        "order process failed",
        JSON.stringify(
          {
            status: response.status,
            url: apiUrl,
            token_source: source,
            token_hint: tokenHint(token),
            detail: String(detail).slice(0, 200),
          },
          null,
          0,
        ),
      );
      throw new Error(`Fragment API request failed (${response.status}): ${String(detail)}`);
    }

    return parsed as FragmentApiProcessOrderResult;
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new Error(`Fragment API timed out after ${timeoutMs} ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
