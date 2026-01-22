import * as os from 'os';
import * as path from 'path';
import { getDefaultSettingsHandler } from './settings';
import { HomeHandler } from './home-handler';

const TARA_HOME_DIR = '.taraproject';

// ===== Backward Compatibility Layer =====
// These functions use a default singleton instance for backward compatibility.
// New code should use HomeHandler class or TaraStack.global.home instead.

let defaultHomeHandler: HomeHandler | null = null;

function getDefaultHomeHandler(): HomeHandler {
    if (!defaultHomeHandler) {
        const settings = getDefaultSettingsHandler();
        defaultHomeHandler = new HomeHandler(settings);
    }
    return defaultHomeHandler;
}

/**
 * Reset the default home handler (for testing purposes only).
 * @internal
 */
export function resetHomeHandler(): void {
    defaultHomeHandler = null;
}

/**
 * Get the default Tara home path.
 *
 * @returns Default path: ~/.taraproject
 * @deprecated Use HomeHandler.defaultPath() or TaraStack.global.home instead
 */
export function defaultTaraHomePath(): string {
    return path.join(os.homedir(), TARA_HOME_DIR);
}

/**
 * Get the Tara project home directory path.
 *
 * @returns Absolute path to Tara home directory
 * @deprecated Use HomeHandler or TaraStack.global.home.getPath() instead
 * @example
 * ```typescript
 * // Old way (deprecated)
 * import { getTaraHomePath } from '@jose_pereiro/taralib-js';
 * const path = getTaraHomePath();
 *
 * // New way (base layer)
 * import { SettingsHandler, HomeHandler } from '@jose_pereiro/taralib-js';
 * const settings = new SettingsHandler();
 * settings.refresh();
 * const home = new HomeHandler(settings);
 * const path = home.getPath();
 *
 * // New way (stack layer - recommended)
 * import { TaraStack } from '@jose_pereiro/taralib-js';
 * const tara = new TaraStack();
 * const path = tara.global.home.getPath();
 * ```
 */
export function getTaraHomePath(): string {
    return getDefaultHomeHandler().getPath();
}

/**
 * Get path to subdirectory in TARA_HOME.
 *
 * @param subfolder - The subfolder name
 * @returns Absolute path to the subfolder
 * @deprecated Use HomeHandler.getSubPath() or TaraStack.global.home.getSubPath() instead
 */
export function getHomeSubPath(subfolder: string): string {
    return getDefaultHomeHandler().getSubPath(subfolder);
}

/**
 * Get tapes folder path.
 *
 * @returns Absolute path to the tapes folder
 * @deprecated Use HomeHandler.getTapesPath() or TaraStack.global.home.getTapesPath() instead
 */
export function getTapesFolderPath(): string {
    return getDefaultHomeHandler().getTapesPath();
}

/**
 * Get apps folder path.
 *
 * @returns Absolute path to the apps folder
 * @deprecated Use HomeHandler.getAppsPath() or TaraStack.global.home.getAppsPath() instead
 */
export function getAppsFolderPath(): string {
    return getDefaultHomeHandler().getAppsPath();
}

/**
 * Ensure the Tara home directory and tapes folder exist.
 * Creates directories if they don't exist.
 *
 * @throws Error if TARA_HOME exists but is not a directory
 * @deprecated Use HomeHandler.ensure() or TaraStack.global.home.ensure() instead
 */
export function ensureTaraHome(): void {
    getDefaultHomeHandler().ensure();
}
