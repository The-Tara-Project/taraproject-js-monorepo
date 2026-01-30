import type { TaraStack } from '@jose_pereiro/taralib-js';
import type { ContextRequest, ContextRequestResult, ContextorOptions } from '../base/types';
import { ProviderRegistry } from './provider-registry';

/**
 * Main Contextor class - orchestrates context collection from providers.
 */
export class Contextor {
    private readonly registry: ProviderRegistry;
    private readonly options: Required<ContextorOptions>;

    constructor(
        readonly stack: TaraStack,
        options?: ContextorOptions
    ) {
        this.options = {
            captureTimeoutMs: options?.captureTimeoutMs ?? 3000,
        };
        this.registry = new ProviderRegistry(this);
    }

    /**
     * Collect context from multiple provider requests (sequentially).
     * @param requests Array of context requests
     * @returns Array of results, one per request
     */
    async collect(requests: ContextRequest[]): Promise<ContextRequestResult[]> {
        const results: ContextRequestResult[] = [];

        for (const request of requests) {
            const result = await this.collectSingle(request);
            results.push(result);
        }

        return results;
    }

    /**
     * List all available provider names
     */
    listProviders(): string[] {
        return this.registry.listProviders();
    }

    /**
     * Get supported items for a specific provider
     */
    getProviderItems(name: string): readonly string[] | undefined {
        return this.registry.getProviderItems(name);
    }

    /**
     * Collect from a single provider request
     */
    private async collectSingle(request: ContextRequest): Promise<ContextRequestResult> {
        const provider = this.registry.resolve(request.provider);

        // Provider not found
        if (!provider) {
            return {
                provider: request.provider,
                status: 'error',
                collectedItems: [],
                failedItems: [...request.items],
                liteContext: {},
            };
        }

        // Execute with timeout
        try {
            const result = await this.withTimeout(
                provider.collect(request),
                this.options.captureTimeoutMs
            );
            return result;
        } catch (error) {
            // Timeout or provider error
            return {
                provider: request.provider,
                status: 'error',
                collectedItems: [],
                failedItems: [...request.items],
                liteContext: {},
            };
        }
    }

    /**
     * Wrap a promise with a timeout
     */
    private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`Timeout after ${ms}ms`));
            }, ms);

            promise
                .then((result) => {
                    clearTimeout(timer);
                    resolve(result);
                })
                .catch((error) => {
                    clearTimeout(timer);
                    reject(error);
                });
        });
    }
}
