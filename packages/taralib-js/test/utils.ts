import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { TaraStack, HomeManager } from "../src";
import { exit } from 'process';

export function randomTestDir(
    label: string = 'taratest'
) {
    const timetag = Date.now().toString();
    const randomTag = Math.random().toString(36).substring(7);
    const dirName = `${label}-${timetag}-${randomTag}`;
    return path.join(os.tmpdir(), dirName);
}

export function setupTestEnv(options?: {
    taraHome?: string;
    writer?: string;
    silent?: boolean;
}): TaraStack {

    const tara = new TaraStack({
        writer: options?.writer || 'test-runner',
        taraHome: options?.taraHome || randomTestDir(),
        silent: options?.silent ?? true
    });

    const testDir = tara.global.home.getHomePath();
    const defaultDir = HomeManager.defaultPath();
    if (testDir === defaultDir) {
        console.error('Refusing to work in default TARA_HOME directory during test setup');
        exit(1);
    }

    return tara;
}

export function teardownTestEnv(
    tara: TaraStack
): void {

    const testDir = tara.global.home.getHomePath();
    const defaultDir = HomeManager.defaultPath();
    if (testDir === defaultDir) {
        console.error('Refusing to delete default TARA_HOME directory during test teardown');
        exit(1);
    }
    fs.rmSync(testDir, { recursive: true, force: true });

    // clean up home dir env var
    delete process.env.TARA_HOME;
}