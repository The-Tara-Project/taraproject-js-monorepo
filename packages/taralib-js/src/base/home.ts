import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

const TARA_HOME_DIR = '.taraproject';
const TAPES_DIR = 'tapes';

export function getTaraHomePath(): string {
    return path.join(os.homedir(), TARA_HOME_DIR);
}

export function getTapesFolderPath(): string {
    return path.join(getTaraHomePath(), TAPES_DIR);
}

export function ensureTaraHome(): void {
    const tapesPath = getTapesFolderPath();
    if (!fs.existsSync(tapesPath)) {
        fs.mkdirSync(tapesPath, { recursive: true });
    }
}
