import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { getTaraHomePath, refreshSettings } from "../src";
import { dir } from 'console';
import { defaultTaraHomePath } from '../src/base/home';
import { exit } from 'process';
import { resetSettings } from '../src/base/settings';

export function randomTestDir(
    label: string = 'taratest'
) {
    const timetag = Date.now().toString();
    const randomTag = Math.random().toString(36).substring(7);
    const dirName = `${label}-${timetag}-${randomTag}`;
    return path.join(os.tmpdir(), dirName);
}

export function setupTestEnv(
    dir: string = randomTestDir()
): void {
    // set up home dir
    process.env.TARA_HOME = dir;
    refreshSettings();

    console.log(`Test TARA_HOME set to: ${getTaraHomePath()}`);

    const testDir = getTaraHomePath();
    const defaultDir = defaultTaraHomePath();
    if (testDir === defaultDir) {
        console.error('Refusing to work in default TARA_HOME directory during test setup');
        exit(1);
    }

}

export function teardownTestEnv(): void {
    // delete test dir
    const testDir = getTaraHomePath();
    const defaultDir = defaultTaraHomePath();
    if (testDir === defaultDir) {
        console.error('Refusing to delete default TARA_HOME directory during test teardown');
        exit(1);
    }
    fs.rmSync(testDir, { recursive: true, force: true });

    // clean up home dir env var
    delete process.env.TARA_HOME;
    resetSettings();
}