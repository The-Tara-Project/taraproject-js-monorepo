/**
 * Request to collect context from a specific provider
 */
export interface ContextRequest {
    /** Name of the provider to collect from */
    provider: string;
    /** Items to collect from the provider */
    items: string[];
    /** Provider-specific options (e.g., vscode API for vscode-session) */
    options?: Record<string, unknown>;
}

/**
 * Result of a context collection request
 */
export interface ContextRequestResult {
    /** Name of the provider that was queried */
    provider: string;
    /** Execution status */
    status: 'success' | 'partial' | 'error';
    /** Items that were successfully collected */
    collectedItems: string[];
    /** Items that failed to collect */
    failedItems: string[];
    /** Minimal inline context - keys match requested items */
    liteContext: LiteContext;
}

/**
 * Minimal inline context - keys match requested item names
 */
export type LiteContext = Record<string, unknown>;

/**
 * Options for Contextor initialization
 */
export interface ContextorOptions {
    /** Timeout for capture operations in milliseconds */
    captureTimeoutMs?: number;
}

/**
 * Metadata describing a provider's capabilities
 */
export interface ProviderMetadata {
    /** Provider name/identifier */
    name: string;
    /** Items this provider can collect */
    supportedItems: readonly string[];
}
