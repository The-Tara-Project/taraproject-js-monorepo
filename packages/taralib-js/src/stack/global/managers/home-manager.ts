import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { TaraStack } from '../../tara-stack';

const TARA_HOME_DIR = '.taraproject';
const TAPES_DIR = 'tapes';
const APPS_DIR = 'apps';

/**
 * HomeManager manages Tara home directory operations.
 *
 * Bootstrap pattern: Constructor only uses context.bootstrap (no cross-manager dependencies).
 * After construction, uses settings cascade which includes bootstrap as fallback source.
 *
 * @example
 * ```typescript
 * const tara = new TaraStack({ taraHome: '/custom/path' });
 * const path = tara.global.home.getPath(); // Uses settings cascade
 * ```
 */
export class HomeManager {

    readonly CONFIG_FILE_NAME = 'config.json';

    constructor(
        private context: TaraStack
    ) {
        // Bootstrap: No logic needed - defaultPath() is pure
    }

    /**
     * Get the Tara project home directory path.
     *
     * Resolution order (via settings cascade):
     * 1. runtime > env > project > global > bootstrap > defaultPath()
     *
     * @returns Absolute path to Tara home directory
     */
    getPath(): string {
        // Check settings system (includes bootstrap as fallback)
        const settingsPath = this.context.settings.getSetting('taraHome');
        if (settingsPath) {
            return path.resolve(settingsPath as string);
        }

        // Final fallback
        return HomeManager.defaultPath();
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
    static defaultPath(): string {
        return path.join(os.homedir(), TARA_HOME_DIR);
    }

    /**
     * Get the global config file path.
     * Uses bootstrap.taraHome as fallback via settings cascade.
     */
    getConfigFilePath(): string {
        return this.getSubPath(this.CONFIG_FILE_NAME)
    }
}
