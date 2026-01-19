import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

type SettingSource = 'env' | 'project' | 'global';

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

// Internal state (module-scoped)
let settingsState: {
    loaded: boolean;
    workingDir: string;
    sources: {
        env: Record<string, any>;
        project: Record<string, any>;
        global: Record<string, any>;
    };
} = {
    loaded: false,
    workingDir: '',
    sources: {
        env: {},
        project: {},
        global: {},
    },
};

/**
 * Get the global config file path.
 * Uses TARA_HOME environment variable if set, otherwise defaults to ~/.taraproject
 *
 * Note: We check environment variable directly here (not via settings system) to avoid
 * chicken-and-egg problem: global config location must be determinable without loading settings.
 */
function getGlobalConfigPath(): string {
    const taraHome = process.env.TARA_HOME || path.join(os.homedir(), '.taraproject');
    return path.join(taraHome, 'config.json');
}

/**
 * Load settings from all sources.
 * Wipes previous state and reloads fresh.
 *
 * @param workingDir - Optional working directory. Defaults to process.cwd()
 */
export function refreshSettings(workingDir?: string): void {
    // 1. Wipe previous state
    resetSettings();

    // Set working directory
    settingsState.workingDir = workingDir ? path.resolve(workingDir) : process.cwd();

    // 2. Load ENV variables (all of them)
    settingsState.sources.env = { ...process.env };

    // 3. Load project config
    const projectPath = path.join(settingsState.workingDir, 'taraproject.json');
    try {
        const content = fs.readFileSync(projectPath, 'utf-8');
        settingsState.sources.project = JSON.parse(content);
    } catch (error) {
        console.warn(`[taralib-settings] Project config not found: ${projectPath}`);
    }

    // 4. Load global config
    const globalPath = getGlobalConfigPath();
    try {
        const content = fs.readFileSync(globalPath, 'utf-8');
        settingsState.sources.global = JSON.parse(content);
    } catch (error) {
        console.warn(`[taralib-settings] Global config not found: ${globalPath}`);
    }

    // 5. Mark as loaded
    settingsState.loaded = true;
}

/**
 * Get a raw value from a specific source without resolution.
 * Useful for inspecting where values come from.
 *
 * @param key - The key to look up
 * @param source - The source to query ('env', 'project', or 'global')
 * @returns The value from the specified source, or undefined if not found
 */
export function getRawValue(key: string, source: 'env' | 'project' | 'global'): any {
    return settingsState.sources[source][key];
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
export function getSetting(key: string, defaultValue?: any): any {
    // 0. check loaded state
    if (!isSettingsLoaded()) {
        return defaultValue;
    }

    // 1. Get aliases and source priority for this key
    const entry = SETTING_REGISTRY?.[key];
    const aliases = entry?.aliases || [key];
    const sources = entry?.sources || SOURCES_PRIORITY;

    // 2. Search all sources in priority order, checking all aliases in each source
    for (const alias of aliases) {
        for (const source of sources) {
            const value = getRawValue(alias, source);
            if (value !== undefined) {
                return value;
            }
        }
    }

    // 3. Return default or undefined
    return defaultValue;
}

/**
 * Check if settings have been loaded.
 *
 * @returns true if refreshSettings() has been called, false otherwise
 */
export function isSettingsLoaded(): boolean {
    return settingsState.loaded;
}

/**
 * Reset settings state to initial values.
 * This function is intended for testing purposes only.
 * @internal
 */
export function resetSettings(): void {
    settingsState = {
        loaded: false,
        workingDir: '',
        sources: {
            env: {},
            project: {},
            global: {},
        },
    };
}
