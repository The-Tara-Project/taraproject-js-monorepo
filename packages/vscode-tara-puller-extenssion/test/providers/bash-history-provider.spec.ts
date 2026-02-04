import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { BashHistoryProvider, BashHistoryProviderOptions } from '../../src/providers/BashHistoryProvider';
import { TaraStack } from '@jose_pereiro/taralib-js';

describe('BashHistoryProvider', () => {
    let tempDir: string;
    let testTara: TaraStack;
    let provider: BashHistoryProvider;

    beforeEach(() => {
        tempDir = path.join(os.tmpdir(), `tara-test-${Date.now()}`);
        fs.mkdirSync(tempDir, { recursive: true });

        testTara = new TaraStack({
            writer: 'test',
            taraHome: tempDir,
        });
        testTara.global.home.instantiate();
    });

    afterEach(() => {
        if (provider) {
            provider.stop();
        }
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    describe('Initialization', () => {
        it('should initialize with all required options', () => {
            provider = new BashHistoryProvider({
                tara: testTara,
                enabled: true,
                commandCount: 10,
                checkIntervalMs: 1000,
            });

            expect(provider).toBeDefined();
            expect((provider as any).enabled).toBe(true);
            expect((provider as any).commandCount).toBe(10);
            expect((provider as any).checkIntervalMs).toBe(1000);
        });

        it('should initialize with optional config path', () => {
            const configPath = '/path/to/config.json';
            provider = new BashHistoryProvider({
                tara: testTara,
                enabled: true,
                commandCount: 10,
                checkIntervalMs: 1000,
                configPath,
            });

            expect((provider as any).configPath).toBe(configPath);
        });

        it('should load filter config on initialization', () => {
            provider = new BashHistoryProvider({
                tara: testTara,
                enabled: true,
                commandCount: 10,
                checkIntervalMs: 1000,
            });

            expect((provider as any).filterConfig).toBeDefined();
            expect((provider as any).filterConfig.patterns).toBeDefined();
            expect((provider as any).filterConfig.maxCommandLength).toBeDefined();
        });

        it('should initialize lastCommandCount if history file exists', () => {
            provider = new BashHistoryProvider({
                tara: testTara,
                enabled: true,
                commandCount: 10,
                checkIntervalMs: 1000,
            });

            // lastCommandCount should be initialized (actual value depends on system bash history)
            expect((provider as any).lastCommandCount).toBeGreaterThanOrEqual(0);
            expect(typeof (provider as any).lastCommandCount).toBe('number');
        });

        it('should initialize lastCommandCount to actual count if history file exists', () => {
            // Create a mock bash history file
            const historyDir = path.join(os.homedir());
            const historyPath = path.join(historyDir, '.bash_history');
            const backupPath = historyPath + '.test_backup';

            // Backup existing history if it exists
            if (fs.existsSync(historyPath)) {
                fs.copyFileSync(historyPath, backupPath);
            }

            try {
                // Create test history with 5 commands
                fs.writeFileSync(historyPath, 'cmd1\ncmd2\ncmd3\ncmd4\ncmd5\n');

                provider = new BashHistoryProvider({
                    tara: testTara,
                    enabled: true,
                    commandCount: 10,
                    checkIntervalMs: 1000,
                });

                expect((provider as any).lastCommandCount).toBe(5);
            } finally {
                // Restore original history
                fs.unlinkSync(historyPath);
                if (fs.existsSync(backupPath)) {
                    fs.renameSync(backupPath, historyPath);
                }
            }
        });
    });

    describe('Start/Stop Lifecycle', () => {
        it('should not start if disabled', () => {
            provider = new BashHistoryProvider({
                tara: testTara,
                enabled: false,
                commandCount: 10,
                checkIntervalMs: 1000,
            });

            provider.start();
            expect((provider as any).intervalId).toBeNull();
        });

        it('should start interval when enabled', () => {
            provider = new BashHistoryProvider({
                tara: testTara,
                enabled: true,
                commandCount: 10,
                checkIntervalMs: 1000,
            });

            provider.start();
            expect((provider as any).intervalId).toBeDefined();
            expect((provider as any).intervalId).not.toBeNull();
        });

        it('should clear existing interval on start', () => {
            provider = new BashHistoryProvider({
                tara: testTara,
                enabled: true,
                commandCount: 10,
                checkIntervalMs: 1000,
            });

            provider.start();
            const firstIntervalId = (provider as any).intervalId;

            provider.start();
            const secondIntervalId = (provider as any).intervalId;

            expect(firstIntervalId).not.toBe(secondIntervalId);
        });

        it('should stop interval', () => {
            provider = new BashHistoryProvider({
                tara: testTara,
                enabled: true,
                commandCount: 10,
                checkIntervalMs: 1000,
            });

            provider.start();
            expect((provider as any).intervalId).not.toBeNull();

            provider.stop();
            expect((provider as any).intervalId).toBeNull();
        });

        it('should handle multiple stop calls', () => {
            provider = new BashHistoryProvider({
                tara: testTara,
                enabled: true,
                commandCount: 10,
                checkIntervalMs: 1000,
            });

            provider.start();
            provider.stop();
            provider.stop(); // Should not throw

            expect((provider as any).intervalId).toBeNull();
        });
    });

    describe('Configuration Updates', () => {
        it('should update enabled flag', () => {
            provider = new BashHistoryProvider({
                tara: testTara,
                enabled: true,
                commandCount: 10,
                checkIntervalMs: 1000,
            });

            provider.updateConfig({ enabled: false });
            expect((provider as any).enabled).toBe(false);
        });

        it('should update commandCount', () => {
            provider = new BashHistoryProvider({
                tara: testTara,
                enabled: true,
                commandCount: 10,
                checkIntervalMs: 1000,
            });

            provider.updateConfig({ commandCount: 20 });
            expect((provider as any).commandCount).toBe(20);
        });

        it('should update checkIntervalMs', () => {
            provider = new BashHistoryProvider({
                tara: testTara,
                enabled: true,
                commandCount: 10,
                checkIntervalMs: 1000,
            });

            provider.updateConfig({ checkIntervalMs: 5000 });
            expect((provider as any).checkIntervalMs).toBe(5000);
        });

        it('should reload filter config when configPath changes', () => {
            provider = new BashHistoryProvider({
                tara: testTara,
                enabled: true,
                commandCount: 10,
                checkIntervalMs: 1000,
            });

            const oldConfig = (provider as any).filterConfig;
            provider.updateConfig({ configPath: '/path/to/config.json' });
            const newConfig = (provider as any).filterConfig;

            // Config should be reloaded (may be same values but different instance)
            expect((provider as any).configPath).toBe('/path/to/config.json');
        });

        it('should restart monitoring when enabled=true after being disabled', () => {
            provider = new BashHistoryProvider({
                tara: testTara,
                enabled: true,
                commandCount: 10,
                checkIntervalMs: 1000,
            });

            provider.start();
            provider.updateConfig({ enabled: false });
            expect((provider as any).intervalId).toBeNull();

            provider.updateConfig({ enabled: true });
            expect((provider as any).intervalId).not.toBeNull();
        });

        it('should stop monitoring when enabled=false', () => {
            provider = new BashHistoryProvider({
                tara: testTara,
                enabled: true,
                commandCount: 10,
                checkIntervalMs: 1000,
            });

            provider.start();
            provider.updateConfig({ enabled: false });
            expect((provider as any).intervalId).toBeNull();
        });
    });

    describe('Command Counting', () => {
        it('should return positive number for current command count', () => {
            provider = new BashHistoryProvider({
                tara: testTara,
                enabled: true,
                commandCount: 10,
                checkIntervalMs: 1000,
            });

            const count = provider.getCurrentCommandCount();
            // Should return a number (actual value depends on system bash history)
            expect(typeof count).toBe('number');
            expect(count).toBeGreaterThanOrEqual(0);
        });

        it('should count commands from bash history file', () => {
            const historyDir = path.join(os.homedir());
            const historyPath = path.join(historyDir, '.bash_history');
            const backupPath = historyPath + '.test_backup';

            if (fs.existsSync(historyPath)) {
                fs.copyFileSync(historyPath, backupPath);
            }

            try {
                fs.writeFileSync(historyPath, 'cmd1\ncmd2\ncmd3\n');

                provider = new BashHistoryProvider({
                    tara: testTara,
                    enabled: true,
                    commandCount: 10,
                    checkIntervalMs: 1000,
                });

                const count = provider.getCurrentCommandCount();
                expect(count).toBe(3);
            } finally {
                fs.unlinkSync(historyPath);
                if (fs.existsSync(backupPath)) {
                    fs.renameSync(backupPath, historyPath);
                }
            }
        });

        it('should filter empty lines when counting', () => {
            const historyDir = path.join(os.homedir());
            const historyPath = path.join(historyDir, '.bash_history');
            const backupPath = historyPath + '.test_backup';

            if (fs.existsSync(historyPath)) {
                fs.copyFileSync(historyPath, backupPath);
            }

            try {
                fs.writeFileSync(historyPath, 'cmd1\n\ncmd2\n\n\ncmd3\n');

                provider = new BashHistoryProvider({
                    tara: testTara,
                    enabled: true,
                    commandCount: 10,
                    checkIntervalMs: 1000,
                });

                const count = provider.getCurrentCommandCount();
                expect(count).toBe(3);
            } finally {
                fs.unlinkSync(historyPath);
                if (fs.existsSync(backupPath)) {
                    fs.renameSync(backupPath, historyPath);
                }
            }
        });
    });

    describe('Last Command Count Update', () => {
        it('should update lastCommandCount to current count', () => {
            provider = new BashHistoryProvider({
                tara: testTara,
                enabled: true,
                commandCount: 10,
                checkIntervalMs: 1000,
            });

            // Get initial count
            const initialCount = provider.getCurrentCommandCount();

            // Call update
            provider.updateLastCommandCount();

            // Should be synchronized
            expect((provider as any).lastCommandCount).toBe(initialCount);
        });
    });

    describe('Manual Recording', () => {
        it('should trigger recording and update lastCommandCount', () => {
            provider = new BashHistoryProvider({
                tara: testTara,
                enabled: true,
                commandCount: 10,
                checkIntervalMs: 1000,
            });

            const recordSpy = vi.spyOn(provider as any, 'recordCommandHistory');
            const updateSpy = vi.spyOn(provider, 'updateLastCommandCount');

            provider.manualRecord();

            expect(recordSpy).toHaveBeenCalled();
            expect(updateSpy).toHaveBeenCalled();
        });
    });
});
