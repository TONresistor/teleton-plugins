const NANO = 1_000_000_000;
export function toNano(ton) {
    return String(Math.round(Number(ton) * NANO));
}
export function createRefId(senderId) {
    return `stars-${senderId}-${Date.now()}`;
}
export function getConfig(context, key, fallback) {
    const raw = context?.pluginConfig?.[key] ?? context?.config?.[key];
    return (raw === undefined ? fallback : raw);
}
export function getPluginConfig(sdk, key, fallback) {
    const raw = sdk?.pluginConfig?.[key];
    return (raw === undefined ? fallback : raw);
}
export function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
//# sourceMappingURL=common.js.map