import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TaraStack } from '../src';
import { setupTestEnv, teardownTestEnv } from './utils';

describe('SettingsManager', () => {
    let tara: TaraStack;

    beforeEach(() => {
        tara = setupTestEnv();
    });

    afterEach(() => {
        teardownTestEnv(tara);
    });

    describe('getSetting', () => {
        it('should return setting values', () => {
            expect(tara.settings.isLoaded()).toBe(true);
            const value = tara.settings.getSetting('writer');
            expect(typeof value).toBe('string');
        });

        it('should return default value when not found', () => {
            const result = tara.settings.getSetting('NON_EXISTENT', 'default-value');
            expect(result).toBe('default-value');
        });

        it('should return undefined when not found and no default', () => {
            const result = tara.settings.getSetting('NON_EXISTENT');
            expect(result).toBeUndefined();
        });

        it('should handle different default value types', () => {
            expect(tara.settings.getSetting('NON_EXISTENT', false)).toBe(false);
            expect(tara.settings.getSetting('NON_EXISTENT', 123)).toBe(123);
            expect(tara.settings.getSetting('NON_EXISTENT', {})).toEqual({});
        });
    });

    describe('getRawValue', () => {
        it('should return value from specific source', () => {
            process.env.TEST_ENV_VAR = 'test-value';

            tara.settings.refresh();

            const value = tara.settings.getRawValue('TEST_ENV_VAR', 'env');
            expect(value).toBe('test-value');

            delete process.env.TEST_ENV_VAR;
        });

        it('should return undefined for missing keys', () => {
            tara.settings.refresh();

            expect(tara.settings.getRawValue('NON_EXISTENT', 'env')).toBeUndefined();
            expect(tara.settings.getRawValue('NON_EXISTENT', 'project')).toBeUndefined();
            expect(tara.settings.getRawValue('NON_EXISTENT', 'global')).toBeUndefined();
        });
    });

    describe('isLoaded', () => {
        it('should return true after TaraStack initialization', () => {
            expect(tara.settings.isLoaded()).toBe(true);
        });

        it('should remain true after refresh', () => {
            expect(tara.settings.isLoaded()).toBe(true);
            tara.settings.refresh();
            expect(tara.settings.isLoaded()).toBe(true);
        });
    });

    describe('refresh', () => {
        it('should reload settings from sources', () => {
            process.env.TEST_REFRESH = 'original-value';
            tara.settings.refresh();

            let value = tara.settings.getRawValue('TEST_REFRESH', 'env');
            expect(value).toBe('original-value');

            process.env.TEST_REFRESH = 'updated-value';
            tara.settings.refresh();

            value = tara.settings.getRawValue('TEST_REFRESH', 'env');
            expect(value).toBe('updated-value');

            delete process.env.TEST_REFRESH;
        });

        it('should accept runtime options', () => {
            tara.settings.refresh({ testOption: 'test-value' });

            const value = tara.settings.getRawValue('testOption', 'runtime');
            expect(value).toBe('test-value');
        });
    });

    describe('getRawSource', () => {
        it('should return entire source object', () => {
            const runtime = tara.settings.getRawSource('runtime');
            expect(typeof runtime).toBe('object');
        });

        it('should allow inspecting all values from a source', () => {
            process.env.INSPECT_TEST = 'inspect-value';
            tara.settings.refresh();

            const envSource = tara.settings.getRawSource('env');
            expect(envSource['INSPECT_TEST']).toBe('inspect-value');

            delete process.env.INSPECT_TEST;
        });
    });

    describe('Alias resolution', () => {
        it('should resolve taraHome aliases', () => {
            // taraHome is already set by setupTestEnv, just verify it resolves correctly
            // taraHome aliases: ['taraHome', 'TARA_HOME', 'TARAPROJECT_HOME']
            const value = tara.settings.getSetting('taraHome');
            expect(typeof value).toBe('string');
            expect(value.length).toBeGreaterThan(0);
        });

        it('should resolve writer aliases', () => {
            process.env.TARA_WRITER = 'test-writer';
            tara.settings.refresh();

            // writer aliases: ['writer', 'TARA_WRITER']
            const value = tara.settings.getSetting('writer');
            expect(value).toBe('test-writer');

            delete process.env.TARA_WRITER;
        });

        it('should resolve debug with custom source priority', () => {
            // debug has custom sources: ['project', 'env', 'global']
            process.env.DEBUG = 'env-debug';
            tara.settings.refresh();

            const value = tara.settings.getSetting('debug');
            expect(value).toBe('env-debug');

            delete process.env.DEBUG;
        });
    });

    describe('Integration with TaraStack', () => {
        it('should provide settings from TaraStack constructor', () => {
            const customTara = new TaraStack({ writer: 'custom-writer' });
            expect(customTara.settings.getSetting('writer')).toBe('custom-writer');
        });

        it('should handle bootstrap values when settings not found', () => {
            const customTara = new TaraStack({ writer: 'bootstrap-writer' });
            const value = customTara.settings.getSetting('writer');
            expect(value).toBe('bootstrap-writer');
        });
    });
});
