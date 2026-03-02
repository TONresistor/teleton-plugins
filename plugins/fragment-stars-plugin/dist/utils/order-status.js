export function setOrderStatus(sdk, refId, status, extra = {}, ttlMs = 24 * 60 * 60 * 1000) {
    const current = sdk.storage.get(`order:${refId}`) || {};
    const next = {
        ...current,
        ...extra,
        refId,
        status,
        updatedAt: new Date().toISOString(),
    };
    sdk.storage.set(`order:${refId}`, next, { ttl: ttlMs });
}
//# sourceMappingURL=order-status.js.map