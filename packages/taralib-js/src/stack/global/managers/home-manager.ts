import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { TaraStack } from '../../tara-stack';

const TARA_HOME_DIR = '.taraproject';
const TAPES_DIR = 'tapes';
const APPS_DIR = 'apps';
const DEV_DIR = 'dev';

/**
 * HomeManager manages Tara home directory operations.
 *
 * Bootstrap pattern: Constructor only uses context.bootstrap (no cross-manager dependencies).
 * After construction, uses settings cascade which includes bootstrap as fallback source.
 *
 * @example
 * ```typescript
 * const tara = new TaraStack({ taraHome: '/custom/path' });
 * const path = tara.global.home.getHomePath(); // Uses settings cascade
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
    getHomePath(...subfolders: string[]): string {
        // Check settings system (includes bootstrap as fallback)
        let home = null;
        const settingsPath = this.context.settings.getSetting('taraHome');
        if (settingsPath) {
            home = path.resolve(settingsPath as string);
        } else {
            home = HomeManager.defaultPath();
        }

        return path.join(home, ...subfolders);
    }

    /**
     * Get tapes folder path.
     *
     * @returns Absolute path to the tapes folder
     */
    getTapesPath(...subfolders: string[]): string {
        return this.getHomePath(TAPES_DIR, ...subfolders);
    }

    /**
     * Get apps folder path.
     *
     * @returns Absolute path to the apps folder
     */
    getAppsPath(...subfolders: string[]): string {
        return this.getHomePath(APPS_DIR, ...subfolders);
    }
    
    /**
     * Get git-storage folder path.
     *
     * @returns Absolute path to the git-storage folder (~/.taraproject/git-storage/)
     */
    getGitStoragePath(...subfolders: string[]): string {
        return this.getHomePath('git-storage', ...subfolders);
    }

    /**
     * Get dev folder path for experimental/testing purposes.
     *
     * @returns Absolute path to the dev folder (~/.taraproject/dev/)
     */
    getDevPath(...subfolders: string[]): string {
        return this.getHomePath(DEV_DIR, ...subfolders);
    }

    /**
     * Ensure the Tara home directory and tapes folder exist.
     * Creates directories if they don't exist.
     *
     * @throws Error if TARA_HOME exists but is not a directory
     */
    instantiate(): void {
        const taraHome = this.getHomePath();

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
        return this.getHomePath(this.CONFIG_FILE_NAME)
    }
}
