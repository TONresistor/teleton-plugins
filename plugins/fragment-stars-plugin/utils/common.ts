const NANO = 1_000_000_000;

export function toNano(ton: number | string): string {
  return String(Math.round(Number(ton) * NANO));
}

export function createRefId(senderId: string | number): string {
  return `stars-${senderId}-${Date.now()}`;
}

export function getConfig<T>(
  context: { pluginConfig?: Record<string, unknown>; config?: Record<string, unknown> } | undefined,
  key: string,
  fallback: T,
): T {
  const raw = context?.pluginConfig?.[key] ?? context?.config?.[key];
  return (raw === undefined ? fallback : raw) as T;
}

export function getPluginConfig<T>(
  sdk: { pluginConfig?: Record<string, unknown> } | undefined,
  key: string,
  fallback: T,
): T {
  const raw = sdk?.pluginConfig?.[key];
  return (raw === undefined ? fallback : raw) as T;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
