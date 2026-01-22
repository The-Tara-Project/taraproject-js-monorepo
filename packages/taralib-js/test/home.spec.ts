import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { refreshSettings } from '../src';
import { defaultTaraHomePath, ensureTaraHome, getTapesFolderPath, getTaraHomePath } from '../src/base/home';
import { setupTestEnv, teardownTestEnv } from './utils';
import { resetSettings, SettingsHandler } from '../src/base/settings';
import { HomeHandler } from '../src/base/home-handler';

describe('home', () => {

    beforeEach(() => {
        // setup env
        setupTestEnv();
    });

    afterEach(() => {
        // clear env
        teardownTestEnv();
    });

    describe('getTaraHomePath', () => {
        it('returns default path when no override', () => {
            const originalTaraHome = process.env.TARA_HOME;
            // Reset settings so getSetting returns undefined (not loaded)
            // This makes getTaraHomePath fall back to default
            resetSettings();

            const result = getTaraHomePath();
            const defaultPath = defaultTaraHomePath();
            expect(result).toBe(defaultPath);

            // Restore for teardown
            if (originalTaraHome) {
                process.env.TARA_HOME = originalTaraHome;
                refreshSettings();
            }
        });

        it('returns TARA_HOME env var when set', () => {
            const customPath = '/tmp/custom-tara';
            process.env.TARA_HOME = customPath;
            refreshSettings();
            const result = getTaraHomePath();
            expect(result).toBe(path.resolve(customPath));
        });

        it('normalizes relative paths to absolute', () => {
            process.env.TARA_HOME = './relative/path';
            const result = getTaraHomePath();
            expect(path.isAbsolute(result)).toBe(true);
        });
    });

    describe('getTapesFolderPath', () => {
        it('returns tapes subfolder of TARA_HOME', () => {
            const customPath = '/tmp/custom-tara';
            process.env.TARA_HOME = customPath;
            refreshSettings();
            const result = getTapesFolderPath();
            expect(result).toBe(path.join(path.resolve(customPath), 'tapes'));
        });

        it('returns default tapes path when no override', () => {
            const originalTaraHome = process.env.TARA_HOME;
            // Reset settings so getSetting returns undefined (not loaded)
            // This makes getTapesFolderPath use default taraHome path
            resetSettings();

            const result = getTapesFolderPath();
            const defaultPath = defaultTaraHomePath();
            expect(result).toBe(path.join(defaultPath, 'tapes'));

            // Restore for teardown
            if (originalTaraHome) {
                process.env.TARA_HOME = originalTaraHome;
                refreshSettings();
            }
        });
    });

    describe('ensureTaraHome', () => {
        let testDir: string;

        beforeEach(() => {
            testDir = path.join(os.tmpdir(), `tara-home-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
            process.env.TARA_HOME = testDir;
        });

        afterEach(() => {
            if (fs.existsSync(testDir)) {
                fs.rmSync(testDir, { recursive: true, force: true });
            }
        });

        it('creates tapes directory if missing', () => {
            ensureTaraHome();
            const tapesPath = getTapesFolderPath();
            expect(fs.existsSync(tapesPath)).toBe(true);
            expect(fs.statSync(tapesPath).isDirectory()).toBe(true);
        });

        it.skip('throws error if TARA_HOME is a file', () => {
            // Create a file at TARA_HOME path
            fs.mkdirSync(path.dirname(testDir), { recursive: true });
            fs.writeFileSync(testDir, 'not a directory');

            expect(() => ensureTaraHome()).toThrow(/not a directory/);
        });

        it('succeeds if directories already exist', () => {
            ensureTaraHome();
            // Call again - should not throw
            expect(() => ensureTaraHome()).not.toThrow();
        });
    });
});

describe('HomeHandler', () => {
    let settings: SettingsHandler;
    let home: HomeHandler;

    beforeEach(() => {
        setupTestEnv();
        settings = new SettingsHandler();
        settings.refresh();
        home = new HomeHandler(settings);
    });

    afterEach(() => {
        teardownTestEnv();
    });

    describe('getPath', () => {
        it('returns path from settings', () => {
            const customPath = '/tmp/custom-tara';
            process.env.TARA_HOME = customPath;
            settings.refresh();
            const result = home.getPath();
            expect(result).toBe(path.resolve(customPath));
        });

        it('returns default path when settings not loaded', () => {
            const freshSettings = new SettingsHandler();
            const freshHome = new HomeHandler(freshSettings);
            const result = freshHome.getPath();
            expect(result).toBe(home.defaultPath());
        });
    });

    describe('getTapesPath', () => {
        it('returns tapes subfolder', () => {
            const result = home.getTapesPath();
            expect(result).toContain('tapes');
            expect(result).toBe(path.join(home.getPath(), 'tapes'));
        });
    });

    describe('getAppsPath', () => {
        it('returns apps subfolder', () => {
            const result = home.getAppsPath();
            expect(result).toContain('apps');
            expect(result).toBe(path.join(home.getPath(), 'apps'));
        });
    });

    describe('getSubPath', () => {
        it('returns custom subfolder', () => {
            const result = home.getSubPath('custom');
            expect(result).toContain('custom');
            expect(result).toBe(path.join(home.getPath(), 'custom'));
        });
    });

    describe('ensure', () => {
        it('creates tapes directory', () => {
            home.ensure();
            const tapesPath = home.getTapesPath();
            expect(fs.existsSync(tapesPath)).toBe(true);
            expect(fs.statSync(tapesPath).isDirectory()).toBe(true);
        });

        it('succeeds if directories already exist', () => {
            home.ensure();
            expect(() => home.ensure()).not.toThrow();
        });
    });

    describe('defaultPath', () => {
        it('returns ~/.taraproject', () => {
            const result = home.defaultPath();
            expect(result).toBe(path.join(os.homedir(), '.taraproject'));
        });
    });
});
