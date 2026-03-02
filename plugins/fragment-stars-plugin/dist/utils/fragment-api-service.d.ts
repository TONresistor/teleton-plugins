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
export declare function executeFragmentQuote(sdk: RuntimeSdk, payload: FragmentApiQuotePayload): Promise<FragmentApiQuoteResult>;
export declare function executeFragmentCreateOrder(sdk: RuntimeSdk, payload: FragmentApiCreateOrderPayload): Promise<FragmentApiCreateOrderResult>;
export declare function executeFragmentProcessOrder(sdk: RuntimeSdk, payload: FragmentApiProcessOrderPayload): Promise<FragmentApiProcessOrderResult>;
export {};
