import type { ContextProvider } from './context-provider';
import type { Contextor } from './contextor';
import { GitContainerProvider } from './providers/git-container-provider';
import { VscodeSessionProvider } from './providers/vscode-session-provider';

/** Provider constructor type */
type ProviderConstructor = new (contextor: Contextor) => ContextProvider;

/** Registry of built-in providers */
const builtInProviders: Map<string, ProviderConstructor> = new Map([
    ['vscode-session', VscodeSessionProvider],
    ['git-container', GitContainerProvider],
]);

/**
 * Manages provider registration and resolution.
 * Currently only supports built-in providers.
 */
export class ProviderRegistry {
    private readonly instances: Map<string, ContextProvider> = new Map();

    constructor(private readonly contextor: Contextor) {}

    /**
     * Resolve a provider by name.
     * Creates a new instance if one doesn't exist.
     */
    resolve(name: string): ContextProvider | undefined {
        // Check for existing instance
        const existing = this.instances.get(name);
        if (existing) {
            return existing;
        }

        // Look up constructor in built-in providers
        const ProviderClass = builtInProviders.get(name);
        if (!ProviderClass) {
            return undefined;
        }

        // Create and cache new instance
        const instance = new ProviderClass(this.contextor);
        this.instances.set(name, instance);
        return instance;
    }

    /**
     * List all available provider names
     */
    listProviders(): string[] {
        return Array.from(builtInProviders.keys());
    }

    /**
     * Get supported items for a specific provider
     */
    getProviderItems(name: string): readonly string[] | undefined {
        const provider = this.resolve(name);
        return provider?.supportedItems;
    }
}
