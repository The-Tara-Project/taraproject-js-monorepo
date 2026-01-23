import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HomeHandler, SettingsHandler } from '../src';
import { setupTestEnv, teardownTestEnv } from './utils';


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
