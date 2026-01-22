import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { SettingSource, SettingsState } from './types';

// Built-in registry mapping internal keys to source aliases
const SETTING_REGISTRY: Record<string, {
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
};

// Priority order for source resolution
const SOURCES_PRIORITY: Array<SettingSource> = ['env', 'project', 'global'];

/**
 * SettingsHandler manages settings with cascade resolution from multiple sources.
 *
 * This is a base primitive with zero TaraStack dependency. It can be used standalone
 * or composed into higher-level workflows.
 *
 * @example
 * ```typescript
 * const settings = new SettingsHandler();
 * settings.refresh('/path/to/project');
 * const debug = settings.getSetting('debug', false);
 * ```
 */
export class SettingsHandler {
    private state: SettingsState;

    constructor() {
        this.state = this.createInitialState();
    }

    /**
     * Load settings from all sources.
     * Wipes previous state and reloads fresh.
     *
     * @param workingDir - Optional working directory. Defaults to process.cwd()
     */
    refresh(workingDir?: string): void {
        // 1. Wipe previous state
        this.resetState();

        // Set working directory
        this.state.workingDir = workingDir ? path.resolve(workingDir) : process.cwd();

        // 2. Load ENV variables (all of them)
        this.state.sources.env = { ...process.env };

        // 3. Load project config
        const projectPath = path.join(this.state.workingDir, 'taraproject.json');
        try {
            const content = fs.readFileSync(projectPath, 'utf-8');
            this.state.sources.project = JSON.parse(content);
        } catch (error) {
            console.warn(`[taralib-settings] Project config not found: ${projectPath}`);
        }

        // 4. Load global config
        const globalPath = this.getGlobalConfigPath();
        try {
            const content = fs.readFileSync(globalPath, 'utf-8');
            this.state.sources.global = JSON.parse(content);
        } catch (error) {
            console.warn(`[taralib-settings] Global config not found: ${globalPath}`);
        }

        // 5. Mark as loaded
        this.state.loaded = true;
    }

    /**
     * Get a setting value with resolution cascade.
     * Returns defaultValue if not found.
     *
     * Resolution order:
     * 1. Look up entry for key in SETTING_REGISTRY (if not found, use [key] as single alias)
     * 2. Use custom source priority from registry entry, or default: env > project > global
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
        const entry = SETTING_REGISTRY?.[key];
        const aliases = entry?.aliases || [key];
        const sources = entry?.sources || SOURCES_PRIORITY;

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

    /**
     * Check if settings have been loaded.
     *
     * @returns true if refresh() has been called, false otherwise
     */
    isLoaded(): boolean {
        return this.state.loaded;
    }

    /**
     * Get the current working directory.
     *
     * @returns The working directory path
     */
    getWorkingDir(): string {
        return this.state.workingDir;
    }

    /**
     * Create the initial state object.
     * @private
     */
    private createInitialState(): SettingsState {
        return {
            loaded: false,
            workingDir: '',
            sources: {
                env: {},
                project: {},
                global: {},
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

    /**
     * Get the global config file path.
     * Uses TARA_HOME environment variable if set, otherwise defaults to ~/.taraproject
     *
     * Note: We check environment variable directly here (not via settings system) to avoid
     * chicken-and-egg problem: global config location must be determinable without loading settings.
     * @private
     */
    private getGlobalConfigPath(): string {
        const taraHome = process.env.TARA_HOME || path.join(os.homedir(), '.taraproject');
        return path.join(taraHome, 'config.json');
    }
}

