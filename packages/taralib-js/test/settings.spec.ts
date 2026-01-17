import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { refreshSettings, getSetting, getRawValue, isLoaded } from '../src';
// @ts-ignore - resetSettings is internal for testing
import { resetSettings } from '../src/base/settings';

describe('Settings System', () => {
    let testDir: string;
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
        // Reset settings state before each test
        resetSettings();

        // Create a temporary test directory
        testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'taralib-settings-test-'));

        // Save original ENV
        originalEnv = { ...process.env };
    });

    afterEach(() => {
        // Restore original ENV
        process.env = originalEnv;

        // Clean up test directory
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }

        // Clean up global config if created
        const globalConfigPath = path.join(os.homedir(), '.taraproject', 'config.json');
        if (fs.existsSync(globalConfigPath)) {
            fs.unlinkSync(globalConfigPath);
        }
    });

    describe('refreshSettings', () => {
        it('should load ENV variables', () => {
            process.env.TEST_KEY = 'test-value';
            refreshSettings(testDir);

            expect(isLoaded()).toBe(true);
            expect(getRawValue('TEST_KEY', 'env')).toBe('test-value');
        });

        it('should load project config', () => {
            const projectConfig = { projectKey: 'project-value' };
            fs.writeFileSync(
                path.join(testDir, 'taraproject.json'),
                JSON.stringify(projectConfig)
            );

            refreshSettings(testDir);

            expect(getRawValue('projectKey', 'project')).toBe('project-value');
        });

        it('should load global config', () => {
            const globalDir = path.join(os.homedir(), '.taraproject');
            if (!fs.existsSync(globalDir)) {
                fs.mkdirSync(globalDir, { recursive: true });
            }

            const globalConfig = { globalKey: 'global-value' };
            fs.writeFileSync(
                path.join(globalDir, 'config.json'),
                JSON.stringify(globalConfig)
            );

            refreshSettings(testDir);

            expect(getRawValue('globalKey', 'global')).toBe('global-value');
        });

        it('should warn on missing project config', () => {
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            refreshSettings(testDir);

            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining('[taralib-settings] Project config not found')
            );

            warnSpy.mockRestore();
        });

        it('should warn on missing global config', () => {
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            refreshSettings(testDir);

            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining('[taralib-settings] Global config not found')
            );

            warnSpy.mockRestore();
        });

        it('should use process.cwd() when workingDir not provided', () => {
            const originalCwd = process.cwd();
            process.chdir(testDir);

            const projectConfig = { key: 'value' };
            fs.writeFileSync(
                path.join(testDir, 'taraproject.json'),
                JSON.stringify(projectConfig)
            );

            refreshSettings();

            expect(getRawValue('key', 'project')).toBe('value');

            process.chdir(originalCwd);
        });

        it('should wipe previous state on reload', () => {
            process.env.TEST_KEY = 'first-value';
            refreshSettings(testDir);
            expect(getRawValue('TEST_KEY', 'env')).toBe('first-value');

            process.env.TEST_KEY = 'second-value';
            refreshSettings(testDir);
            expect(getRawValue('TEST_KEY', 'env')).toBe('second-value');
        });
    });

    describe('getSetting', () => {
        it('should resolve with priority: ENV > project > global', () => {
            // Setup all three sources with same key
            process.env.SHARED_KEY = 'env-value';

            fs.writeFileSync(
                path.join(testDir, 'taraproject.json'),
                JSON.stringify({ SHARED_KEY: 'project-value' })
            );

            const globalDir = path.join(os.homedir(), '.taraproject');
            if (!fs.existsSync(globalDir)) {
                fs.mkdirSync(globalDir, { recursive: true });
            }
            fs.writeFileSync(
                path.join(globalDir, 'config.json'),
                JSON.stringify({ SHARED_KEY: 'global-value' })
            );

            refreshSettings(testDir);

            // ENV should win
            expect(getSetting('SHARED_KEY')).toBe('env-value');
        });

        it('should fall back to project when ENV missing', () => {
            fs.writeFileSync(
                path.join(testDir, 'taraproject.json'),
                JSON.stringify({ PROJECT_ONLY: 'project-value' })
            );

            const globalDir = path.join(os.homedir(), '.taraproject');
            if (!fs.existsSync(globalDir)) {
                fs.mkdirSync(globalDir, { recursive: true });
            }
            fs.writeFileSync(
                path.join(globalDir, 'config.json'),
                JSON.stringify({ PROJECT_ONLY: 'global-value' })
            );

            refreshSettings(testDir);

            expect(getSetting('PROJECT_ONLY')).toBe('project-value');
        });

        it('should fall back to global when ENV and project missing', () => {
            const globalDir = path.join(os.homedir(), '.taraproject');
            if (!fs.existsSync(globalDir)) {
                fs.mkdirSync(globalDir, { recursive: true });
            }
            fs.writeFileSync(
                path.join(globalDir, 'config.json'),
                JSON.stringify({ GLOBAL_ONLY: 'global-value' })
            );

            refreshSettings(testDir);

            expect(getSetting('GLOBAL_ONLY')).toBe('global-value');
        });

        it('should resolve aliases correctly', () => {
            // taraHome has aliases: ['taraHome', 'TARA_HOME', 'TARAPROJECT_HOME']
            process.env.TARA_HOME = '/tmp/env-home';

            fs.writeFileSync(
                path.join(testDir, 'taraproject.json'),
                JSON.stringify({ taraHome: '/tmp/project-home' })
            );

            refreshSettings(testDir);

            // ENV alias should win
            expect(getSetting('taraHome')).toBe('/tmp/env-home');
        });

        it('should search all aliases across all sources', () => {
            // Set different aliases in different sources
            fs.writeFileSync(
                path.join(testDir, 'taraproject.json'),
                JSON.stringify({ TARAPROJECT_HOME: '/tmp/project-home' })
            );

            refreshSettings(testDir);

            // Should find TARAPROJECT_HOME in project config via taraHome aliases
            expect(getSetting('taraHome')).toBe('/tmp/project-home');
        });

        it('should return default value when not found', () => {
            refreshSettings(testDir);

            expect(getSetting('NON_EXISTENT', 'default-value')).toBe('default-value');
            expect(getSetting('NON_EXISTENT', false)).toBe(false);
            expect(getSetting('NON_EXISTENT', 123)).toBe(123);
        });

        it('should return undefined when not found and no default', () => {
            refreshSettings(testDir);

            expect(getSetting('NON_EXISTENT')).toBeUndefined();
        });

        it('should handle complex object values', () => {
            const complexValue = {
                nested: {
                    deep: 'value',
                },
                array: [1, 2, 3],
            };

            fs.writeFileSync(
                path.join(testDir, 'taraproject.json'),
                JSON.stringify({ complexKey: complexValue })
            );

            refreshSettings(testDir);

            expect(getSetting('complexKey')).toEqual(complexValue);
        });

        it('should keep ENV values as strings', () => {
            process.env.BOOL_STRING = 'true';
            process.env.NUM_STRING = '123';
            process.env.JSON_STRING = '["a","b"]';

            refreshSettings(testDir);

            expect(getSetting('BOOL_STRING')).toBe('true');
            expect(getSetting('NUM_STRING')).toBe('123');
            expect(getSetting('JSON_STRING')).toBe('["a","b"]');
        });

        it('should search raw key as-is when no alias found', () => {
            process.env.CUSTOM_KEY = 'custom-value';

            refreshSettings(testDir);

            // CUSTOM_KEY has no aliases in registry
            expect(getSetting('CUSTOM_KEY')).toBe('custom-value');
        });
    });

    describe('getRawValue', () => {
        it('should return value from specific source', () => {
            process.env.ENV_KEY = 'env-value';

            fs.writeFileSync(
                path.join(testDir, 'taraproject.json'),
                JSON.stringify({ PROJECT_KEY: 'project-value' })
            );

            refreshSettings(testDir);

            expect(getRawValue('ENV_KEY', 'env')).toBe('env-value');
            expect(getRawValue('PROJECT_KEY', 'project')).toBe('project-value');
        });

        it('should return undefined for missing keys', () => {
            refreshSettings(testDir);

            expect(getRawValue('NON_EXISTENT', 'env')).toBeUndefined();
            expect(getRawValue('NON_EXISTENT', 'project')).toBeUndefined();
            expect(getRawValue('NON_EXISTENT', 'global')).toBeUndefined();
        });

        it('should not use alias resolution', () => {
            // Set value using an alias
            process.env.TARA_HOME = '/tmp/home';

            refreshSettings(testDir);

            // getRawValue should not resolve aliases
            expect(getRawValue('taraHome', 'env')).toBeUndefined();
            expect(getRawValue('TARA_HOME', 'env')).toBe('/tmp/home');
        });
    });

    describe('isLoaded', () => {
        it('should return false before loading', () => {
            expect(isLoaded()).toBe(false);
        });

        it('should return true after loading', () => {
            refreshSettings(testDir);
            expect(isLoaded()).toBe(true);
        });

        it('should return true after reload', () => {
            refreshSettings(testDir);
            expect(isLoaded()).toBe(true);

            refreshSettings(testDir);
            expect(isLoaded()).toBe(true);
        });
    });

    describe('Integration scenarios', () => {
        it('should handle realistic multi-source scenario', () => {
            // ENV: production overrides
            process.env.DEBUG = 'true';
            process.env.TARA_HOME = '/prod/home';

            // Project: project-specific settings
            fs.writeFileSync(
                path.join(testDir, 'taraproject.json'),
                JSON.stringify({
                    taraHome: '/project/home',
                    logLevel: 'info',
                    customSetting: 'project-value',
                })
            );

            // Global: user defaults
            const globalDir = path.join(os.homedir(), '.taraproject');
            if (!fs.existsSync(globalDir)) {
                fs.mkdirSync(globalDir, { recursive: true });
            }
            fs.writeFileSync(
                path.join(globalDir, 'config.json'),
                JSON.stringify({
                    taraHome: '/global/home',
                    logLevel: 'warn',
                    globalDefault: 'global-value',
                })
            );

            refreshSettings(testDir);

            // Verify resolution
            expect(getSetting('debug')).toBe('true'); // ENV wins
            expect(getSetting('taraHome')).toBe('/prod/home'); // ENV wins via alias
            expect(getSetting('logLevel')).toBe('info'); // Project wins
            expect(getSetting('customSetting')).toBe('project-value'); // Only in project
            expect(getSetting('globalDefault')).toBe('global-value'); // Only in global
        });
    });
});
