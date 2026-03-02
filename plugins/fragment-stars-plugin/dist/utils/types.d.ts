export type OrderStatus = "pending" | "checking" | "paid" | "ordered" | "failed";
export interface OrderRecord {
    refId: string;
    chatId: string;
    senderId: string;
    username: string;
    quantity: number;
    baseAmountTon: number;
    amountTon: number;
    lang?: "ru" | "en";
    refundAddress?: string | null;
    refundAmountNano?: string | null;
    platformFeePercent: number;
    fragmentFeePercent: number;
    show_sender: boolean;
    status: OrderStatus;
    paymentTx?: string | null;
    paymentFrom?: string | null;
    fragmentOrder?: Record<string, unknown> | null;
    error?: string | null;
    createdAt?: string;
    updatedAt?: string;
}
export interface CheckingOrderRow {
    ref_id: string;
    chat_id: string;
}
export interface SqlStatement {
    all(...args: unknown[]): any[];
    get(...args: unknown[]): any;
    run(...args: unknown[]): void;
}
export interface Database {
    exec(sql: string): void;
    prepare(sql: string): SqlStatement;
}
export interface RuntimeSdk {
    config?: Record<string, unknown>;
    pluginConfig?: Record<string, unknown>;
    secrets?: {
        get(key: string): string | undefined;
        require(key: string): string;
        has(key: string): boolean;
    };
    db: Database;
    storage: {
        get(key: string): unknown;
        set(key: string, value: unknown, options?: {
            ttl?: number;
        }): void;
    };
    telegram: {
        sendMessage(chatId: string, text: string, opts?: unknown): Promise<number>;
        editMessage?(chatId: string, messageId: number, text: string, opts?: unknown): Promise<number>;
    };
    ton: {
        getAddress(): string | null;
        getTransactions(address: string, limit?: number): Promise<Array<{
            hash: string;
            amount?: string;
            from?: string;
            to?: string;
            comment?: string | null;
            date: string;
            secondsAgo: number;
        }>>;
        verifyPayment(payload: {
            amount: number;
            memo: string;
            gameType: string;
            maxAgeMinutes: number;
        }): Promise<{
            verified: boolean;
            error?: string;
            txHash?: string;
            playerWallet?: string;
        }>;
        sendTON(address: string, amountTon: number, memo: string): Promise<{
            txHash?: string;
            hash?: string;
        }>;
    };
    log: {
        info(...args: unknown[]): void;
        warn(...args: unknown[]): void;
        error(...args: unknown[]): void;
        debug(...args: unknown[]): void;
    };
}
export interface PluginContext {
    chatId?: string | number;
    senderId?: string | number;
    config?: Record<string, unknown>;
    pluginConfig?: Record<string, unknown>;
    secrets?: Record<string, string | undefined>;
}
export interface PluginManifest {
    name: string;
    version: string;
    author: string;
    description: string;
    sdkVersion: string;
    defaultConfig: Record<string, unknown>;
    secrets: Record<string, {
        required: boolean;
        description: string;
    }>;
}
