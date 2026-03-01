import type { CheckingOrderRow, Database, OrderRecord } from "./types.js";
export declare function initSchema(db: Database): void;
export declare function getOrderByRef(db: Database, refId: string): OrderRecord | null;
export declare function getLatestActiveOrderForUser(db: Database, chatId: string, senderId: string): OrderRecord | null;
export declare function upsertOrder(db: Database, order: OrderRecord): void;
export declare function updateOrderStatus(db: Database, refId: string, status: OrderRecord["status"], updates?: Partial<OrderRecord>): OrderRecord | null;
export declare function listCheckingOrders(db: Database): CheckingOrderRow[];
