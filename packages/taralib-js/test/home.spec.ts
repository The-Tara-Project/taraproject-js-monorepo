import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TaraStack, HomeManager } from '../src';
import { setupTestEnv, teardownTestEnv } from './utils';


describe('HomeManager', () => {
    let tara: TaraStack;

    beforeEach(() => {
        tara = setupTestEnv();
    });

    afterEach(() => {
        teardownTestEnv(tara);
    });

    describe('getPath', () => {
        it('returns path from settings', () => {
            const customPath = '/tmp/custom-tara';
            process.env.TARA_HOME = customPath;
            const customTara = new TaraStack();
            const result = customTara.global.home.getPath();
            expect(result).toBe(path.resolve(customPath));
        });

        it('returns default path when TARA_HOME not set', () => {
            const savedTaraHome = process.env.TARA_HOME;
            delete process.env.TARA_HOME;
            const freshTara = new TaraStack();
            const result = freshTara.global.home.getPath();
            expect(result).toBe(HomeManager.defaultPath());
            process.env.TARA_HOME = savedTaraHome;
        });
    });

    describe('getTapesPath', () => {
        it('returns tapes subfolder', () => {
            const result = tara.global.home.getTapesPath();
            expect(result).toContain('tapes');
            expect(result).toBe(path.join(tara.global.home.getPath(), 'tapes'));
        });
    });

    describe('getAppsPath', () => {
        it('returns apps subfolder', () => {
            const result = tara.global.home.getAppsPath();
            expect(result).toContain('apps');
            expect(result).toBe(path.join(tara.global.home.getPath(), 'apps'));
        });
    });

    describe('getSubPath', () => {
        it('returns custom subfolder', () => {
            const result = tara.global.home.getSubPath('custom');
            expect(result).toContain('custom');
            expect(result).toBe(path.join(tara.global.home.getPath(), 'custom'));
        });
    });

    describe('ensure', () => {
        it('creates tapes directory', () => {
            tara.global.home.ensure();
            const tapesPath = tara.global.home.getTapesPath();
            expect(fs.existsSync(tapesPath)).toBe(true);
            expect(fs.statSync(tapesPath).isDirectory()).toBe(true);
        });

        it('succeeds if directories already exist', () => {
            tara.global.home.ensure();
            expect(() => tara.global.home.ensure()).not.toThrow();
        });
    });

    describe('defaultPath', () => {
        it('returns ~/.taraproject', () => {
            const result = HomeManager.defaultPath();
            expect(result).toBe(path.join(os.homedir(), '.taraproject'));
        });
    });
});
