import type { PluginContext, RuntimeSdk } from "./types.js";
export declare function createTools(sdk: RuntimeSdk, activeChecks: Set<string>): ({
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: {
            username: {
                type: string;
                description: string;
            };
            quantity: {
                type: string;
                description: string;
            };
            stars: {
                type: string;
                description: string;
            };
            show_sender: {
                type: string;
                description: string;
            };
            lang: {
                type: string;
                description: string;
                enum: string[];
            };
            ref_id?: undefined;
        };
        required: string[];
    };
    execute(params: {
        username: string;
        quantity?: number;
        stars?: number;
        show_sender?: boolean;
        lang?: "ru" | "en";
    }, context: PluginContext): Promise<{
        success: boolean;
        error: string;
        data?: undefined;
    } | {
        success: boolean;
        data: {
            ref_id: string;
            status: string;
            message: string;
            force_user_message: boolean;
        };
        error?: undefined;
    }>;
} | {
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: {
            ref_id: {
                type: string;
                description: string;
            };
            lang: {
                type: string;
                description: string;
                enum: string[];
            };
            username?: undefined;
            quantity?: undefined;
            stars?: undefined;
            show_sender?: undefined;
        };
        required: string[];
    };
    execute(params: {
        ref_id?: string;
        lang?: "ru" | "en";
    }, context: PluginContext): Promise<{
        success: boolean;
        error: string;
        data?: undefined;
    } | {
        success: boolean;
        data: {
            ref_id: string;
            status: string;
            fragment_order: Record<string, unknown> | null;
            message: string;
            force_user_message?: undefined;
        };
        error?: undefined;
    } | {
        success: boolean;
        data: {
            ref_id: string;
            status: string;
            message: string;
            force_user_message: boolean;
            fragment_order?: undefined;
        };
        error?: undefined;
    }>;
})[];
