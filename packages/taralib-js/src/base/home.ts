import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { getSetting } from './settings';

const TARA_HOME_DIR = '.taraproject';
const TAPES_DIR = 'tapes';

export function defaultTaraHomePath(): string {
    return path.join(os.homedir(), TARA_HOME_DIR);
}

/**
 * Get the Tara project home directory path.
 *
 * Resolution order:
 * 1. TARA_HOME environment variable (highest priority)
 * 2. taraHome setting (if settings loaded)
 * 3. Default: ~/.taraproject
 *
 * @returns Absolute path to Tara home directory
 */
export function getTaraHomePath(): string {

    // 1. Check settings system
    const settingsPath = getSetting('taraHome');
    if (settingsPath) {
        return path.resolve(settingsPath as string);
    }

    // 3. Default fallback
    return defaultTaraHomePath();
}

export function getHomeSubPath(subfolder: string): string {
    return path.join(getTaraHomePath(), subfolder);
}

export function getTapesFolderPath(): string {
    return getHomeSubPath(TAPES_DIR);
}

/**
 * Ensure the Tara home directory and tapes folder exist.
 * Creates directories if they don't exist.
 *
 * @throws Error if TARA_HOME exists but is not a directory
 */
export function ensureTaraHome(): void {
    const taraHome = getTaraHomePath();

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
    const tapesPath = getTapesFolderPath();
    if (!fs.existsSync(tapesPath)) {
        fs.mkdirSync(tapesPath, { recursive: true });
    }
}
