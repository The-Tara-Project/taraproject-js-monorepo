import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getRawValue, getSetting, isSettingsLoaded, refreshSettings } from '../src';
// @ts-ignore - resetSettings is internal for testing
import { resetSettings } from '../src/base/settings-handler';
import { randomTestDir } from './utils';

describe('Settings System', () => {
    
    let workingDir: string;

    beforeEach(() => {
        // Reset settings state before each test
        resetSettings();
        workingDir = randomTestDir()
        fs.mkdirSync(workingDir, { recursive: true });
    });

    afterEach(() => {
        // Clean up environment variables that tests may have set
        const testEnvVars = ['TEST_KEY', 'SHARED_KEY', 'PROJECT_ONLY', 'GLOBAL_ONLY',
                             'TARA_HOME', 'DEBUG', 'BOOL_STRING', 'NUM_STRING',
                             'JSON_STRING', 'CUSTOM_KEY', 'logLevel', 'LOG_LEVEL', 'TARA_DEBUG'];
        testEnvVars.forEach(key => delete process.env[key]);

        resetSettings();

        // delete workingDir
        if (fs.existsSync(workingDir)) {
            fs.rmSync(workingDir, { recursive: true, force: true });
        }
    });


    describe('refreshSettings', () => {
        it('should load ENV variables', () => {
            process.env.TEST_KEY = 'test-value';
            refreshSettings(workingDir);

            expect(isSettingsLoaded()).toBe(true);
            expect(getRawValue('TEST_KEY', 'env')).toBe('test-value');
        });

        it('should load project config', () => {
            const projectConfig = { projectKey: 'project-value' };
            fs.writeFileSync(
                path.join(workingDir, 'taraproject.json'),
                JSON.stringify(projectConfig)
            );

            refreshSettings(workingDir);

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

            refreshSettings(workingDir);

            expect(getRawValue('globalKey', 'global')).toBe('global-value');
        });

        it('should warn on missing project config', () => {
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            refreshSettings(workingDir);

            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining('[taralib-settings] Project config not found')
            );

            warnSpy.mockRestore();
        });

        it('should warn on missing global config', () => {
            // Set TARA_HOME to non-existent directory to ensure global config doesn't exist
            const nonExistentDir = path.join(os.tmpdir(), 'non-existent-tara-home');
            process.env.TARA_HOME = nonExistentDir;

            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            refreshSettings(workingDir);

            // Check that at least one of the warn calls includes the global config warning
            const calls = warnSpy.mock.calls.map(call => call[0]);
            expect(calls.some(msg => msg.includes('[taralib-settings] Global config not found'))).toBe(true);

            warnSpy.mockRestore();
            delete process.env.TARA_HOME;
        });

        it('should use process.cwd() when workingDir not provided', () => {
            const originalCwd = process.cwd();
            process.chdir(workingDir);

            const projectConfig = { key: 'value' };
            fs.writeFileSync(
                path.join(workingDir, 'taraproject.json'),
                JSON.stringify(projectConfig)
            );

            refreshSettings();

            expect(getRawValue('key', 'project')).toBe('value');

            process.chdir(originalCwd);
        });

        it('should wipe previous state on reload', () => {
            process.env.TEST_KEY = 'first-value';
            refreshSettings(workingDir);
            expect(getRawValue('TEST_KEY', 'env')).toBe('first-value');

            process.env.TEST_KEY = 'second-value';
            refreshSettings(workingDir);
            expect(getRawValue('TEST_KEY', 'env')).toBe('second-value');
        });
    });

    describe('getSetting', () => {
        it('should resolve with priority: ENV > project > global', () => {
            // Setup all three sources with same key
            process.env.SHARED_KEY = 'env-value';

            fs.writeFileSync(
                path.join(workingDir, 'taraproject.json'),
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

            refreshSettings(workingDir);

            // ENV should win
            expect(getSetting('SHARED_KEY')).toBe('env-value');
        });

        it('should fall back to project when ENV missing', () => {
            fs.writeFileSync(
                path.join(workingDir, 'taraproject.json'),
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

            refreshSettings(workingDir);

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

            refreshSettings(workingDir);

            expect(getSetting('GLOBAL_ONLY')).toBe('global-value');
        });

        it('should resolve aliases correctly', () => {
            // taraHome has aliases: ['taraHome', 'TARA_HOME', 'TARAPROJECT_HOME']
            // Algorithm checks aliases first, then sources
            // So 'taraHome' (first alias) is checked in env, project, global
            // before 'TARA_HOME' (second alias) is checked
            process.env.TARA_HOME = '/tmp/env-home';

            fs.writeFileSync(
                path.join(workingDir, 'taraproject.json'),
                JSON.stringify({ taraHome: '/tmp/project-home' })
            );

            refreshSettings(workingDir);

            // First alias 'taraHome' found in project config wins
            expect(getSetting('taraHome')).toBe('/tmp/project-home');
        });

        it('should search all aliases across all sources', () => {
            // Set different aliases in different sources
            fs.writeFileSync(
                path.join(workingDir, 'taraproject.json'),
                JSON.stringify({ TARAPROJECT_HOME: '/tmp/project-home' })
            );

            refreshSettings(workingDir);

            // Should find TARAPROJECT_HOME in project config via taraHome aliases
            expect(getSetting('taraHome')).toBe('/tmp/project-home');
        });

        it('should return default value when not found', () => {
            refreshSettings(workingDir);

            expect(getSetting('NON_EXISTENT', 'default-value')).toBe('default-value');
            expect(getSetting('NON_EXISTENT', false)).toBe(false);
            expect(getSetting('NON_EXISTENT', 123)).toBe(123);
        });

        it('should return undefined when not found and no default', () => {
            refreshSettings(workingDir);

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
                path.join(workingDir, 'taraproject.json'),
                JSON.stringify({ complexKey: complexValue })
            );

            refreshSettings(workingDir);

            expect(getSetting('complexKey')).toEqual(complexValue);
        });

        it('should keep ENV values as strings', () => {
            process.env.BOOL_STRING = 'true';
            process.env.NUM_STRING = '123';
            process.env.JSON_STRING = '["a","b"]';

            refreshSettings(workingDir);

            expect(getSetting('BOOL_STRING')).toBe('true');
            expect(getSetting('NUM_STRING')).toBe('123');
            expect(getSetting('JSON_STRING')).toBe('["a","b"]');
        });

        it('should work with unregistered keys (treated as single alias)', () => {
            process.env.CUSTOM_KEY = 'custom-value';

            refreshSettings(workingDir);

            // Unregistered key: searches for [CUSTOM_KEY] with default source order
            expect(getSetting('CUSTOM_KEY')).toBe('custom-value');
        });

        it('should work with registered key without aliases (uses key as single alias)', () => {
            // logLevel is in registry but has no aliases array defined
            // Defaults to treating 'logLevel' itself as the single alias
            process.env.logLevel = 'env-level';
            fs.writeFileSync(
                path.join(workingDir, 'taraproject.json'),
                JSON.stringify({ logLevel: 'project-level' })
            );

            refreshSettings(workingDir);

            // Searches for 'logLevel' key directly with default source order
            expect(getSetting('logLevel')).toBe('env-level');
        });

        it('should respect per-key source priority overrides', () => {
            // debug has custom sources: ['project', 'env', 'global']
            // This means project is checked BEFORE env

            process.env.DEBUG = 'env-value';
            fs.writeFileSync(
                path.join(workingDir, 'taraproject.json'),
                JSON.stringify({ debug: 'project-value' })
            );

            const globalDir = path.join(os.homedir(), '.taraproject');
            if (!fs.existsSync(globalDir)) {
                fs.mkdirSync(globalDir, { recursive: true });
            }
            fs.writeFileSync(
                path.join(globalDir, 'config.json'),
                JSON.stringify({ DEBUG: 'global-value' })
            );

            refreshSettings(workingDir);

            // Project source should win (checked first), not ENV
            expect(getSetting('debug')).toBe('project-value');
        });

        it('should fall through source priority when earlier source missing', () => {
            // debug has custom sources: ['project', 'env', 'global']
            // debug has aliases: ['debug', 'DEBUG', 'TARA_DEBUG']
            // Algorithm checks aliases first, so:
            // 1. Check 'debug' in project, env, global (all empty)
            // 2. Check 'DEBUG' in project, env, global
            // Only DEBUG is set in global
            process.env.TARA_DEBUG = 'env-value';

            const globalDir = path.join(os.homedir(), '.taraproject');
            if (!fs.existsSync(globalDir)) {
                fs.mkdirSync(globalDir, { recursive: true });
            }
            fs.writeFileSync(
                path.join(globalDir, 'config.json'),
                JSON.stringify({ DEBUG: 'global-value' })
            );

            refreshSettings(workingDir);

            // 'debug' alias not found in any source, so checks 'DEBUG' alias
            // 'DEBUG' found in global source
            expect(getSetting('debug')).toBe('global-value');
        });

        it('should use default source priority when no override specified', () => {
            // logLevel has no sources override, uses default: env > project > global
            // logLevel has aliases: ['logLevel', 'LOG_LEVEL', 'TARA_LOG_LEVEL']
            // Algorithm checks aliases first, so:
            // 1. Check 'logLevel' in env, project, global
            // 'logLevel' is found in project config
            process.env.LOG_LEVEL = 'env-level';
            fs.writeFileSync(
                path.join(workingDir, 'taraproject.json'),
                JSON.stringify({ logLevel: 'project-level' })
            );

            refreshSettings(workingDir);

            // First alias 'logLevel' found in project config
            expect(getSetting('logLevel')).toBe('project-level');
        });
    });

    describe('getRawValue', () => {
        it('should return value from specific source', () => {
            process.env.ENV_KEY = 'env-value';

            fs.writeFileSync(
                path.join(workingDir, 'taraproject.json'),
                JSON.stringify({ PROJECT_KEY: 'project-value' })
            );

            refreshSettings(workingDir);

            expect(getRawValue('ENV_KEY', 'env')).toBe('env-value');
            expect(getRawValue('PROJECT_KEY', 'project')).toBe('project-value');
        });

        it('should return undefined for missing keys', () => {
            refreshSettings(workingDir);

            expect(getRawValue('NON_EXISTENT', 'env')).toBeUndefined();
            expect(getRawValue('NON_EXISTENT', 'project')).toBeUndefined();
            expect(getRawValue('NON_EXISTENT', 'global')).toBeUndefined();
        });

        it('should not use alias resolution', () => {
            // Set value using an alias
            process.env.TARA_HOME = '/tmp/home';

            refreshSettings(workingDir);

            // getRawValue should not resolve aliases
            expect(getRawValue('taraHome', 'env')).toBeUndefined();
            expect(getRawValue('TARA_HOME', 'env')).toBe('/tmp/home');
        });
    });

    describe('isSettingsLoaded', () => {
        it('should return false before loading', () => {
            expect(isSettingsLoaded()).toBe(false);
        });

        it('should return true after loading', () => {
            refreshSettings(workingDir);
            expect(isSettingsLoaded()).toBe(true);
        });

        it('should return true after reload', () => {
            refreshSettings(workingDir);
            expect(isSettingsLoaded()).toBe(true);

            refreshSettings(workingDir);
            expect(isSettingsLoaded()).toBe(true);
        });
    });

    describe('Integration scenarios', () => {
        it('should handle realistic multi-source scenario', () => {
            // ENV: production overrides
            process.env.DEBUG = 'true';

            // Project: project-specific settings
            fs.writeFileSync(
                path.join(workingDir, 'taraproject.json'),
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

            refreshSettings(workingDir);

            // Verify resolution
            // debug: check 'debug' alias (not found), then 'DEBUG' alias (found in env)
            expect(getSetting('debug')).toBe('true'); // DEBUG found in env
            // taraHome: check 'taraHome' alias first (found in project)
            expect(getSetting('taraHome')).toBe('/project/home'); // taraHome found in project
            // logLevel: check 'logLevel' alias first (found in project)
            expect(getSetting('logLevel')).toBe('info'); // logLevel found in project
            // customSetting: only in project
            expect(getSetting('customSetting')).toBe('project-value');
            // globalDefault: only in global
            expect(getSetting('globalDefault')).toBe('global-value');
        });
    });

    describe('settings with custom TARA_HOME', () => {
        let customTaraDir: string;
        let originalTaraHome: string | undefined;

        beforeEach(() => {
            originalTaraHome = process.env.TARA_HOME;
            customTaraDir = path.join(os.tmpdir(), `tara-settings-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
            process.env.TARA_HOME = customTaraDir;
            fs.mkdirSync(customTaraDir, { recursive: true });
        });

        afterEach(() => {
            if (originalTaraHome !== undefined) {
                process.env.TARA_HOME = originalTaraHome;
            } else {
                delete process.env.TARA_HOME;
            }
            if (fs.existsSync(customTaraDir)) {
                fs.rmSync(customTaraDir, { recursive: true, force: true });
            }
        });

        it('loads global config from custom TARA_HOME location', () => {
            // Write global config to custom location
            const globalConfigPath = path.join(customTaraDir, 'config.json');
            fs.writeFileSync(globalConfigPath, JSON.stringify({
                customSetting: 'from-custom-location'
            }));

            refreshSettings(workingDir);

            const value = getRawValue('customSetting', 'global');
            expect(value).toBe('from-custom-location');
        });
    });
});
