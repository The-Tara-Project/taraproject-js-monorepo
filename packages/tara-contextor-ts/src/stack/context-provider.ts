import type { ContextRequest, ContextRequestResult, ProviderMetadata } from '../base/types';
import type { Contextor } from './contextor';

/**
 * Abstract base class for context providers.
 * Providers collect specific slices of context from their respective sources.
 */
export abstract class ContextProvider {
    /** Unique provider identifier */
    abstract readonly name: string;

    /** Items this provider can collect */
    abstract readonly supportedItems: readonly string[];

    constructor(readonly contextor: Contextor) {}

    /**
     * Collect requested context items
     * @param request The collection request
     * @returns Result containing collected items and status
     */
    abstract collect(request: ContextRequest): Promise<ContextRequestResult>;

    /**
     * Get metadata about this provider
     */
    getMetadata(): ProviderMetadata {
        return {
            name: this.name,
            supportedItems: this.supportedItems,
        };
    }
}
