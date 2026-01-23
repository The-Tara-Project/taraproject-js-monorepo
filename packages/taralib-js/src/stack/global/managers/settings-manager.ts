import * as fs from 'fs';
import type { SettingSource, SettingsState } from '../../../base/types';
import { TaraStack } from '../../tara-stack';

/**
 * SettingsManager manages settings with cascade resolution from multiple sources.
 *
 * Bootstrap pattern: Uses context.bootstrap as the bottom-most fallback source.
 * This enables clean construction-time separation - managers can rely on bootstrap
 * values during construction, and settings cascade becomes available after refresh().
 *
 * Priority: runtime > env > project > global > bootstrap
 *
 * @example
 * ```typescript
 * const tara = new TaraStack({ taraHome: '/custom/path' });
 * const debug = tara.settings.getSetting('debug', false);
 * ```
 */
export class SettingsManager {
    /**
     * Built-in registry mapping internal keys to source aliases.
     * Maps canonical keys to their aliases and custom source priority.
     * @private
     */
    private static readonly SETTING_REGISTRY: Record<string, {
        aliases?: string[]
        sources?: SettingSource[]
    }> = {
            debug: {
                aliases: ['debug', 'DEBUG', 'TARA_DEBUG'],
                sources: ['project', 'env', 'global'],
            },
            logLevel: {
                aliases: ['logLevel', 'LOG_LEVEL', 'TARA_LOG_LEVEL'],
            },
            taraHome: {
                aliases: ['taraHome', 'TARA_HOME', 'TARAPROJECT_HOME'],
            },
            writer: {
                aliases: ['writer', 'TARA_WRITER'],
            },
        };

    /**
     * Default priority order for source resolution.
     * @private
     */
    private static readonly SOURCES_PRIORITY: Array<SettingSource> = ['runtime', 'env', 'project', 'global', 'bootstrap'];

    private state: SettingsState;

    constructor(
        private context: TaraStack,
    ) {
        // Initialize state
        this.resetState();
    }

    /**
     * Load settings from all sources.
     * Wipes previous state and reloads fresh.
     *
     * @param options - Optional runtime options to set as runtime source
     */
    refresh(
        options?: Record<string, any>
    ): void {
        // 1. Wipe previous state (also sets bootstrap from context.bootstrap)
        this.resetState();

        // 2. Set runtime source
        this.state.sources.runtime = options || {};

        // 3. Load ENV variables (all of them)
        this.state.sources.env = { ...process.env };

        // 4. Load project config
        // TODO/LATER : implement project config loading
        // - integrate with LocalScope

        // const workingDir = this.getSetting('workingDir');
        // const projectPath = path.join(this.state.workingDir, 'taraproject.json');
        // try {
        //     const content = fs.readFileSync(projectPath, 'utf-8');
        //     this.state.sources.project = JSON.parse(content);
        // } catch (error) {
        //     console.warn(`[taralib-settings] Project config not found: ${projectPath}`);
        // }

        // 5. Load global config
        const globalPath = this.context.global.home.getConfigFilePath();
        try {
            const content = fs.readFileSync(globalPath, 'utf-8');
            this.state.sources.global = JSON.parse(content);
        } catch (error) {
            console.warn(`[taralib-settings] Global config not found: ${globalPath}`);
        }

        // 6. Mark as loaded
        this.state.loaded = true;
    }

    /**
     * Get a setting value with resolution cascade.
     * Returns defaultValue if not found.
     *
     * Resolution order:
     * 1. Look up entry for key in SETTING_REGISTRY (if not found, use [key] as single alias)
     * 2. Use custom source priority from registry entry, or default: runtime > env > project > global > bootstrap
     * 3. For each alias, search across sources in priority order
     * 4. Return default value if provided, otherwise undefined
     *
     * Priority is by alias first, then by source. First alias match wins.
     * Per-key source overrides allow setting-specific source precedence.
     *
     * @param key - The setting key to retrieve
     * @param defaultValue - Optional default value if setting is not found
     * @returns The resolved setting value, default value, or undefined
     */
    getSetting(key: string, defaultValue?: any): any {
        // 0. check loaded state
        if (!this.isLoaded()) {
            return defaultValue;
        }

        // 1. Get aliases and source priority for this key
        const entry = SettingsManager.SETTING_REGISTRY?.[key];
        const aliases = entry?.aliases || [key];
        const sources = entry?.sources || SettingsManager.SOURCES_PRIORITY;

        // 2. Search all sources in priority order, checking all aliases in each source
        for (const alias of aliases) {
            for (const source of sources) {
                const value = this.getRawValue(alias, source);
                if (value !== undefined) {
                    return value;
                }
            }
        }

        // 3. Return default or undefined
        return defaultValue;
    }

    /**
     * Get a raw value from a specific source without resolution.
     * Useful for inspecting where values come from.
     *
     * @param key - The key to look up
     * @param source - The source to query ('env', 'project', or 'global')
     * @returns The value from the specified source, or undefined if not found
     */
    getRawValue(key: string, source: SettingSource): any {
        return this.state.sources[source][key];
    }

    getRawSource(key: string): Record<string, any> {
        return this.state.sources[key]
    }

    /**
     * Check if settings have been loaded.
     *
     * @returns true if refresh() has been called, false otherwise
     */
    isLoaded(): boolean {
        return this.state.loaded;
    }

    /**
     * Create the initial state object.
     * @private
     */
    private createInitialState(): SettingsState {
        return {
            loaded: false,
            sources: {
                runtime: {},
                env: {},
                project: {},
                global: {},
                bootstrap: this.context.bootstrap,
            },
        };
    }

    /**
     * Reset settings state to initial values.
     * @private
     */
    private resetState(): void {
        this.state = this.createInitialState();
    }
}