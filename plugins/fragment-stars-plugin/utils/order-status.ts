import type { RuntimeSdk } from "./types.js";

export function setOrderStatus(
  sdk: RuntimeSdk,
  refId: string,
  status: string,
  extra: Record<string, unknown> = {},
  ttlMs = 24 * 60 * 60 * 1000,
): void {
  const current = (sdk.storage.get(`order:${refId}`) as Record<string, unknown> | null) || {};
  const next = {
    ...current,
    ...extra,
    refId,
    status,
    updatedAt: new Date().toISOString(),
  };
  sdk.storage.set(`order:${refId}`, next, { ttl: ttlMs });
}
