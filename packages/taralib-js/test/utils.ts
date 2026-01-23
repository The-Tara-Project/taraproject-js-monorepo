import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SettingsHandler, HomeHandler } from "../src";
import { exit } from 'process';

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

    const settings = new SettingsHandler();
    settings.refresh();
    const home = new HomeHandler(settings);

    console.log(`Test TARA_HOME set to: ${home.getPath()}`);

    const testDir = home.getPath();
    const defaultDir = home.defaultPath();
    if (testDir === defaultDir) {
        console.error('Refusing to work in default TARA_HOME directory during test setup');
        exit(1);
    }
}

export function teardownTestEnv(): void {
    // delete test dir
    const settings = new SettingsHandler();
    settings.refresh();
    const home = new HomeHandler(settings);

    const testDir = home.getPath();
    const defaultDir = home.defaultPath();
    if (testDir === defaultDir) {
        console.error('Refusing to delete default TARA_HOME directory during test teardown');
        exit(1);
    }
    fs.rmSync(testDir, { recursive: true, force: true });

    // clean up home dir env var
    delete process.env.TARA_HOME;
}