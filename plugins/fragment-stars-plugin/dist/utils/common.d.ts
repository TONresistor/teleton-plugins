export declare function toNano(ton: number | string): string;
export declare function createRefId(senderId: string | number): string;
export declare function getConfig<T>(context: {
    pluginConfig?: Record<string, unknown>;
    config?: Record<string, unknown>;
} | undefined, key: string, fallback: T): T;
export declare function getPluginConfig<T>(sdk: {
    pluginConfig?: Record<string, unknown>;
} | undefined, key: string, fallback: T): T;
export declare function sleep(ms: number): Promise<void>;
