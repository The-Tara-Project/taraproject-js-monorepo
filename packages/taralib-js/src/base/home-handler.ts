import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { SettingsHandler } from './settings';

const TARA_HOME_DIR = '.taraproject';
const TAPES_DIR = 'tapes';
const APPS_DIR = 'apps';

/**
 * HomeHandler manages Tara home directory operations.
 *
 * This is a base primitive with minimal dependencies. It accepts a SettingsHandler
 * via dependency injection and uses it to resolve the taraHome setting.
 *
 * @example
 * ```typescript
 * const settings = new SettingsHandler();
 * settings.refresh();
 * const home = new HomeHandler(settings);
 * const path = home.getPath();
 * ```
 */
export class HomeHandler {
    constructor(private settings: SettingsHandler) {}

    /**
     * Get the Tara project home directory path.
     *
     * Resolution order:
     * 1. taraHome setting from SettingsHandler (cascades: env > project > global)
     * 2. Default: ~/.taraproject
     *
     * @returns Absolute path to Tara home directory
     */
    getPath(): string {
        // 1. Check settings system
        const settingsPath = this.settings.getSetting('taraHome');
        if (settingsPath) {
            return path.resolve(settingsPath as string);
        }

        // 2. Default fallback
        return this.defaultPath();
    }

    /**
     * Get path to subdirectory in TARA_HOME.
     *
     * @param subfolder - The subfolder name
     * @returns Absolute path to the subfolder
     */
    getSubPath(subfolder: string): string {
        return path.join(this.getPath(), subfolder);
    }

    /**
     * Get tapes folder path.
     *
     * @returns Absolute path to the tapes folder
     */
    getTapesPath(): string {
        return this.getSubPath(TAPES_DIR);
    }

    /**
     * Get apps folder path.
     *
     * @returns Absolute path to the apps folder
     */
    getAppsPath(): string {
        return this.getSubPath(APPS_DIR);
    }

    /**
     * Ensure the Tara home directory and tapes folder exist.
     * Creates directories if they don't exist.
     *
     * @throws Error if TARA_HOME exists but is not a directory
     */
    ensure(): void {
        const taraHome = this.getPath();

        // Validate that taraHome is not a file
        if (fs.existsSync(taraHome)) {
            const stats = fs.statSync(taraHome);
            if (!stats.isDirectory()) {
                throw new Error(
                    `TARA_HOME exists but is not a directory: ${taraHome}\n` +
                    `Please remove the file or set TARA_HOME to a different location.`
                );
            }
        }

        // Ensure tapes directory exists
        const tapesPath = this.getTapesPath();
        if (!fs.existsSync(tapesPath)) {
            fs.mkdirSync(tapesPath, { recursive: true });
        }
    }

    /**
     * Get the default Tara home path.
     *
     * @returns Default path: ~/.taraproject
     */
    defaultPath(): string {
        return path.join(os.homedir(), TARA_HOME_DIR);
    }
}
