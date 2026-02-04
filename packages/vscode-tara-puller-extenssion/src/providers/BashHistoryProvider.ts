import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { TaraStack, RecordHandler } from '@jose_pereiro/taralib-js';
import {
    getBashHistoryPath,
    getLastNCommands,
    parseBashHistory,
    BashCommand,
} from '../utils/bash-history-parser';
import {
    loadFilterConfig,
    filterCommands,
    SensitiveFilterConfig,
} from '../utils/sensitive-filter';

const COMMAND_BATCH_SIZE = 10; // Record every 10 new commands

export interface BashHistoryProviderOptions {
    tara: TaraStack;
    enabled: boolean;
    commandCount: number;
    checkIntervalMs: number;
    configPath?: string;
}

export class BashHistoryProvider {
    private tara: TaraStack;
    private enabled: boolean;
    private commandCount: number;
    private checkIntervalMs: number;
    private intervalId: NodeJS.Timeout | null = null;
    private lastCommandCount: number = 0;
    private filterConfig: SensitiveFilterConfig;
    private configPath?: string;

    constructor(options: BashHistoryProviderOptions) {
        this.tara = options.tara;
        this.enabled = options.enabled;
        this.commandCount = options.commandCount;
        this.checkIntervalMs = options.checkIntervalMs;
        this.configPath = options.configPath;
        this.filterConfig = loadFilterConfig(this.configPath);

        // Initialize last command count
        this.updateLastCommandCount();
    }

    /**
     * Start monitoring bash history
     */
    start(): void {
        if (!this.enabled) {
            return;
        }

        this.stop(); // Clear any existing interval

        this.intervalId = setInterval(() => {
            this.checkAndRecord();
        }, this.checkIntervalMs);

        console.log('BashHistoryProvider: Started monitoring');
    }

    /**
     * Stop monitoring bash history
     */
    stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        console.log('BashHistoryProvider: Stopped monitoring');
    }

    /**
     * Update configuration
     */
    updateConfig(options: Partial<BashHistoryProviderOptions>): void {
        if (options.enabled !== undefined) {
            this.enabled = options.enabled;
        }
        if (options.commandCount !== undefined) {
            this.commandCount = options.commandCount;
        }
        if (options.checkIntervalMs !== undefined) {
            this.checkIntervalMs = options.checkIntervalMs;
        }
        if (options.configPath !== undefined) {
            this.configPath = options.configPath;
            this.filterConfig = loadFilterConfig(this.configPath);
        }

        // Restart if needed
        if (this.enabled) {
            this.start();
        } else {
            this.stop();
        }
    }

    /**
     * Get current bash history file line count
     */
    getCurrentCommandCount(): number {
        const historyPath = getBashHistoryPath();
        if (!fs.existsSync(historyPath)) {
            return 0;
        }

        try {
            const content = fs.readFileSync(historyPath, 'utf-8');
            return content
                .split('\n')
                .filter((line) => line.trim().length > 0).length;
        } catch (error) {
            console.error('Failed to count bash history commands:', error);
            return 0;
        }
    }

    /**
     * Update the last known command count
     */
    updateLastCommandCount(): void {
        this.lastCommandCount = this.getCurrentCommandCount();
    }

    /**
     * Check if there are enough new commands to record
     */
    private checkAndRecord(): void {
        const currentCount = this.getCurrentCommandCount();
        const newCommandsCount = currentCount - this.lastCommandCount;

        if (newCommandsCount >= COMMAND_BATCH_SIZE) {
            console.log(
                `BashHistoryProvider: ${newCommandsCount} new commands detected, recording...`
            );
            this.recordCommandHistory();
            this.updateLastCommandCount();
        }
    }

    /**
     * Record command history to tape
     */
    private recordCommandHistory(): void {
        try {
            // Get last N commands
            const rawCommands = getLastNCommands(this.commandCount);

            // Filter sensitive commands
            const safeCommands = filterCommands(rawCommands, this.filterConfig);

            // Parse into structured format
            const parsedCommands = parseBashHistory(safeCommands, process.cwd());

            // Create record
            const record = new RecordHandler({
                content: {
                    type: 'tara-puller/bash-history',
                    capturedAt: new Date().toISOString(),
                    commandCount: parsedCommands.length,
                    commands: parsedCommands,
                },
            });

            // Get tape and append
            const tape = this.tara.global.tapes.get('tara-puller');
            tape.instantiate();
            tape.appendRecord(record);

            console.log(
                `BashHistoryProvider: Recorded ${parsedCommands.length} commands`
            );
        } catch (error) {
            console.error('BashHistoryProvider: Failed to record commands:', error);
        }
    }

    /**
     * Manually trigger recording (for testing or manual use)
     */
    manualRecord(): void {
        this.recordCommandHistory();
        this.updateLastCommandCount();
    }
}
