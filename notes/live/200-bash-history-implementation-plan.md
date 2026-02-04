# Implementation Plan: Bash Command History for Tara Puller

## Overview

Add a separate context provider that monitors VS Code integrated terminal bash commands and automatically records them to the tara-puller tape every 10 new commands.

---

## Architecture Changes

### New Components

```
packages/vscode-tara-puller-extenssion/src/
├── extension.ts                    # MODIFY: Register command history provider
├── providers/
│   └── BashHistoryProvider.ts     # NEW: Monitor and record bash history
├── utils/
│   ├── bash-history-parser.ts     # NEW: Parse .bash_history
│   └── sensitive-filter.ts        # NEW: Filter sensitive commands
└── config/
    └── sensitive-patterns.json     # NEW: Configurable filter patterns
```

---

## Detailed Implementation Steps

### Step 1: Create Sensitive Data Filter

**File: `src/utils/sensitive-filter.ts`**

```typescript
import * as fs from 'fs';
import * as path from 'path';

/**
 * Default sensitive patterns to filter
 */
const DEFAULT_PATTERNS = [
    'password',
    'passwd',
    'token',
    'secret',
    'apikey',
    'api_key',
    'api-key',
    'auth',
    'credentials',
    'private',
    'ssh',
    'curl.*-H.*Authorization',
    'export.*TOKEN',
    'export.*PASSWORD',
    'export.*SECRET',
];

export interface SensitiveFilterConfig {
    patterns: string[];
    maxCommandLength: number;
}

/**
 * Load filter patterns from config file or use defaults
 */
export function loadFilterConfig(configPath?: string): SensitiveFilterConfig {
    const defaultConfig: SensitiveFilterConfig = {
        patterns: DEFAULT_PATTERNS,
        maxCommandLength: 500,
    };

    if (!configPath || !fs.existsSync(configPath)) {
        return defaultConfig;
    }

    try {
        const content = fs.readFileSync(configPath, 'utf-8');
        const userConfig = JSON.parse(content);
        return {
            patterns: userConfig.patterns || DEFAULT_PATTERNS,
            maxCommandLength: userConfig.maxCommandLength || 500,
        };
    } catch (error) {
        console.warn('Failed to load sensitive filter config, using defaults:', error);
        return defaultConfig;
    }
}

/**
 * Check if command contains sensitive data
 */
export function isSensitiveCommand(command: string, patterns: string[]): boolean {
    const lowerCommand = command.toLowerCase();
    
    for (const pattern of patterns) {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(command)) {
            return true;
        }
    }
    
    return false;
}

/**
 * Filter and sanitize commands
 */
export function filterCommands(
    commands: string[],
    config: SensitiveFilterConfig
): string[] {
    return commands
        .filter(cmd => cmd.trim().length > 0)
        .filter(cmd => !isSensitiveCommand(cmd, config.patterns))
        .map(cmd => cmd.length > config.maxCommandLength 
            ? cmd.substring(0, config.maxCommandLength) + '...[truncated]'
            : cmd
        );
}
```

**Tests: `test/utils/sensitive-filter.spec.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { isSensitiveCommand, filterCommands, loadFilterConfig } from '../../src/utils/sensitive-filter';

describe('Sensitive Filter', () => {
    describe('isSensitiveCommand', () => {
        const patterns = ['password', 'token', 'secret'];

        it('should detect password commands', () => {
            expect(isSensitiveCommand('mysql -u root -pMyPassword', patterns)).toBe(true);
            expect(isSensitiveCommand('echo $PASSWORD', patterns)).toBe(true);
        });

        it('should detect token commands', () => {
            expect(isSensitiveCommand('export API_TOKEN=abc123', patterns)).toBe(true);
            expect(isSensitiveCommand('curl -H "Authorization: Bearer token123"', patterns)).toBe(true);
        });

        it('should allow safe commands', () => {
            expect(isSensitiveCommand('npm run build', patterns)).toBe(false);
            expect(isSensitiveCommand('git status', patterns)).toBe(false);
            expect(isSensitiveCommand('ls -la', patterns)).toBe(false);
        });

        it('should be case-insensitive', () => {
            expect(isSensitiveCommand('echo $PASSWORD', patterns)).toBe(true);
            expect(isSensitiveCommand('echo $password', patterns)).toBe(true);
        });
    });

    describe('filterCommands', () => {
        const config = {
            patterns: ['password', 'token'],
            maxCommandLength: 50,
        };

        it('should filter sensitive commands', () => {
            const commands = [
                'npm run build',
                'export TOKEN=secret',
                'git commit -m "test"',
                'echo $PASSWORD',
            ];
            const filtered = filterCommands(commands, config);
            expect(filtered).toEqual([
                'npm run build',
                'git commit -m "test"',
            ]);
        });

        it('should truncate long commands', () => {
            const longCmd = 'a'.repeat(100);
            const filtered = filterCommands([longCmd], config);
            expect(filtered[0]).toContain('[truncated]');
            expect(filtered[0].length).toBeLessThanOrEqual(65); // 50 + ...[truncated]
        });

        it('should filter empty commands', () => {
            const commands = ['npm run build', '', '  ', 'git status'];
            const filtered = filterCommands(commands, config);
            expect(filtered).toEqual(['npm run build', 'git status']);
        });
    });
});
```

---

### Step 2: Create Bash History Parser

**File: `src/utils/bash-history-parser.ts`**

```typescript
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface BashCommand {
    command: string;
    timestamp: string;
    cwd: string;
}

/**
 * Get the bash history file path
 */
export function getBashHistoryPath(): string {
    return path.join(os.homedir(), '.bash_history');
}

/**
 * Read raw bash history file
 */
export function readBashHistory(historyPath?: string): string[] {
    const filePath = historyPath || getBashHistoryPath();
    
    if (!fs.existsSync(filePath)) {
        return [];
    }

    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return content.split('\n').filter(line => line.trim().length > 0);
    } catch (error) {
        console.error('Failed to read bash history:', error);
        return [];
    }
}

/**
 * Get last N commands from bash history
 */
export function getLastNCommands(count: number, historyPath?: string): string[] {
    const allCommands = readBashHistory(historyPath);
    return allCommands.slice(-count);
}

/**
 * Parse bash history into structured format
 * Note: Standard bash_history doesn't include timestamps by default
 * We'll use current time and current directory as approximations
 */
export function parseBashHistory(
    commands: string[],
    cwd?: string
): BashCommand[] {
    const currentCwd = cwd || process.cwd();
    const now = new Date();
    
    return commands.map((command, index) => ({
        command,
        timestamp: new Date(now.getTime() - (commands.length - index - 1) * 1000).toISOString(),
        cwd: currentCwd,
    }));
}
```

**Tests: `test/utils/bash-history-parser.spec.ts`**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { readBashHistory, getLastNCommands, parseBashHistory } from '../../src/utils/bash-history-parser';

describe('Bash History Parser', () => {
    let tempHistoryPath: string;

    beforeEach(() => {
        tempHistoryPath = path.join(os.tmpdir(), `test-bash-history-${Date.now()}`);
    });

    afterEach(() => {
        if (fs.existsSync(tempHistoryPath)) {
            fs.unlinkSync(tempHistoryPath);
        }
    });

    describe('readBashHistory', () => {
        it('should read commands from history file', () => {
            const mockHistory = 'ls -la\nnpm run build\ngit status\n';
            fs.writeFileSync(tempHistoryPath, mockHistory);

            const commands = readBashHistory(tempHistoryPath);
            expect(commands).toEqual(['ls -la', 'npm run build', 'git status']);
        });

        it('should return empty array if file does not exist', () => {
            const commands = readBashHistory('/nonexistent/path');
            expect(commands).toEqual([]);
        });

        it('should filter empty lines', () => {
            const mockHistory = 'ls -la\n\nnpm run build\n\n\ngit status\n';
            fs.writeFileSync(tempHistoryPath, mockHistory);

            const commands = readBashHistory(tempHistoryPath);
            expect(commands).toEqual(['ls -la', 'npm run build', 'git status']);
        });
    });

    describe('getLastNCommands', () => {
        it('should return last N commands', () => {
            const mockHistory = 'cmd1\ncmd2\ncmd3\ncmd4\ncmd5\n';
            fs.writeFileSync(tempHistoryPath, mockHistory);

            const commands = getLastNCommands(3, tempHistoryPath);
            expect(commands).toEqual(['cmd3', 'cmd4', 'cmd5']);
        });

        it('should return all commands if N is larger than history', () => {
            const mockHistory = 'cmd1\ncmd2\n';
            fs.writeFileSync(tempHistoryPath, mockHistory);

            const commands = getLastNCommands(10, tempHistoryPath);
            expect(commands).toEqual(['cmd1', 'cmd2']);
        });
    });

    describe('parseBashHistory', () => {
        it('should parse commands into structured format', () => {
            const commands = ['npm run build', 'git status'];
            const parsed = parseBashHistory(commands, '/test/cwd');

            expect(parsed).toHaveLength(2);
            expect(parsed[0].command).toBe('npm run build');
            expect(parsed[0].cwd).toBe('/test/cwd');
            expect(parsed[0].timestamp).toBeDefined();
            expect(parsed[1].command).toBe('git status');
        });

        it('should assign approximate timestamps', () => {
            const commands = ['cmd1', 'cmd2', 'cmd3'];
            const parsed = parseBashHistory(commands);

            // Timestamps should be in ascending order
            expect(new Date(parsed[0].timestamp).getTime())
                .toBeLessThan(new Date(parsed[1].timestamp).getTime());
            expect(new Date(parsed[1].timestamp).getTime())
                .toBeLessThan(new Date(parsed[2].timestamp).getTime());
        });
    });
});
```

---

### Step 3: Create Bash History Provider

**File: `src/providers/BashHistoryProvider.ts`**

```typescript
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { TaraStack, RecordHandler } from '@jose_pereiro/taralib-js';
import { 
    getBashHistoryPath, 
    getLastNCommands, 
    parseBashHistory,
    BashCommand 
} from '../utils/bash-history-parser';
import { 
    loadFilterConfig, 
    filterCommands,
    SensitiveFilterConfig 
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
    private getCurrentCommandCount(): number {
        const historyPath = getBashHistoryPath();
        if (!fs.existsSync(historyPath)) {
            return 0;
        }

        try {
            const content = fs.readFileSync(historyPath, 'utf-8');
            return content.split('\n').filter(line => line.trim().length > 0).length;
        } catch (error) {
            console.error('Failed to count bash history commands:', error);
            return 0;
        }
    }

    /**
     * Update the last known command count
     */
    private updateLastCommandCount(): void {
        this.lastCommandCount = this.getCurrentCommandCount();
    }

    /**
     * Check if there are enough new commands to record
     */
    private checkAndRecord(): void {
        const currentCount = this.getCurrentCommandCount();
        const newCommandsCount = currentCount - this.lastCommandCount;

        if (newCommandsCount >= COMMAND_BATCH_SIZE) {
            console.log(`BashHistoryProvider: ${newCommandsCount} new commands detected, recording...`);
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
                }
            });

            // Get tape and append
            const tape = this.tara.global.tapes.get('tara-puller');
            tape.instantiate();
            tape.appendRecord(record);

            console.log(`BashHistoryProvider: Recorded ${parsedCommands.length} commands`);
            vscode.window.setStatusBarMessage(
                `Tara Puller: Recorded ${parsedCommands.length} bash commands`,
                3000
            );
        } catch (error) {
            console.error('BashHistoryProvider: Failed to record commands:', error);
            vscode.window.showWarningMessage(
                `Tara Puller: Failed to record bash history: ${error instanceof Error ? error.message : String(error)}`
            );
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
```

---

### Step 4: Create Configuration File Template

**File: `src/config/sensitive-patterns.json`**

```json
{
  "patterns": [
    "password",
    "passwd",
    "token",
    "secret",
    "apikey",
    "api_key",
    "api-key",
    "auth",
    "credentials",
    "private",
    "ssh",
    "curl.*-H.*Authorization",
    "export.*TOKEN",
    "export.*PASSWORD",
    "export.*SECRET",
    "key=",
    "KEY=",
    "bearer",
    "Basic.*==",
    "mysql.*-p",
    "psql.*password"
  ],
  "maxCommandLength": 500
}
```

---

### Step 5: Integrate into Extension

**File: `src/extension.ts` (Modifications)**

```typescript
// Add at top of file with other imports
import { BashHistoryProvider } from './providers/BashHistoryProvider';
import * as path from 'path';

// Add to PullerState interface
interface PullerState {
    // ... existing fields ...
    bashHistoryProvider: BashHistoryProvider | null;
}

// Update initial state
const state: PullerState = {
    // ... existing fields ...
    bashHistoryProvider: null,
};

// Add configuration getters (after existing getConfig/setConfig functions)
function getBashHistoryConfig() {
    const config = vscode.workspace.getConfiguration('taraPuller.bashHistory');
    return {
        enabled: config.get<boolean>('enabled', true),
        commandCount: config.get<number>('commandCount', 10),
        checkIntervalMs: config.get<number>('checkInterval', 30) * 1000,
    };
}

// Modify initTaraStack to also initialize BashHistoryProvider
function initTaraStack(): TaraStack {
    if (!state.tara) {
        state.user_tara = new TaraStack({
            writer: APP_NAME
        });

        state.dev_tara = new TaraStack({
            writer: APP_NAME,
            taraHome:
                state.user_tara.global.home.getDevPath('tara-puller-test-stack')
        });

        state.tara = state.testMode ? state.dev_tara : state.user_tara;
        state.tara.global.home.instantiate();
        
        state.contextor = new Contextor(state.tara);
        
        // NEW: Initialize BashHistoryProvider
        const bashConfig = getBashHistoryConfig();
        const configPath = path.join(__dirname, '../src/config/sensitive-patterns.json');
        
        state.bashHistoryProvider = new BashHistoryProvider({
            tara: state.tara,
            enabled: bashConfig.enabled,
            commandCount: bashConfig.commandCount,
            checkIntervalMs: bashConfig.checkIntervalMs,
            configPath,
        });
    }
    return state.tara;
}

// Modify reinitTaraStack to reinitialize bash history provider
function reinitTaraStack(): void {
    if (state.bashHistoryProvider) {
        state.bashHistoryProvider.stop();
        state.bashHistoryProvider = null;
    }
    state.tara = null;
    state.contextor = null;
    initTaraStack();
}

// Modify activate function to start bash history provider and register commands
export function activate(context: vscode.ExtensionContext): void {
    // ... existing code ...

    // Initialize TaraStack and BashHistoryProvider
    initTaraStack();
    
    // Start bash history monitoring if enabled
    if (state.bashHistoryProvider) {
        state.bashHistoryProvider.start();
    }

    // Watch for configuration changes (MODIFY existing handler)
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e: vscode.ConfigurationChangeEvent) => {
            if (e.affectsConfiguration('taraPuller')) {
                const oldTestMode = state.testMode;
                loadSettings();
                if (oldTestMode !== state.testMode) {
                    reinitTaraStack();
                }
                restartChecker();
                
                // NEW: Handle bash history config changes
                if (e.affectsConfiguration('taraPuller.bashHistory')) {
                    const bashConfig = getBashHistoryConfig();
                    state.bashHistoryProvider?.updateConfig(bashConfig);
                }
            }
        })
    );

    // NEW: Register command to manually record bash history
    context.subscriptions.push(
        vscode.commands.registerCommand('taraPuller.recordBashHistory', () => {
            if (state.bashHistoryProvider) {
                state.bashHistoryProvider.manualRecord();
                vscode.window.showInformationMessage('Tara Puller: Bash history recorded manually');
            } else {
                vscode.window.showWarningMessage('Tara Puller: Bash history provider not initialized');
            }
        })
    );

    // NEW: Register command to toggle bash history monitoring
    context.subscriptions.push(
        vscode.commands.registerCommand('taraPuller.toggleBashHistory', async () => {
            const config = vscode.workspace.getConfiguration('taraPuller.bashHistory');
            const currentState = config.get<boolean>('enabled', true);
            await config.update('enabled', !currentState, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(
                `Tara Puller: Bash history monitoring ${!currentState ? 'enabled' : 'disabled'}`
            );
        })
    );

    // ... rest of existing code ...
}

// Modify deactivate to stop bash history provider
export function deactivate(): void {
    stopChecker();
    clearPendingRetry();
    
    // NEW: Stop bash history provider
    if (state.bashHistoryProvider) {
        state.bashHistoryProvider.stop();
    }
}
```

---

### Step 6: Update package.json Configuration

**File: `package.json` (Add to contributes.configuration.properties)**

```json
{
  "contributes": {
    "commands": [
      // ... existing commands ...
      {
        "command": "taraPuller.recordBashHistory",
        "title": "Tara Puller: Record Bash History Now"
      },
      {
        "command": "taraPuller.toggleBashHistory",
        "title": "Tara Puller: Toggle Bash History Monitoring"
      }
    ],
    "configuration": {
      "title": "Tara Puller",
      "properties": {
        // ... existing properties ...
        "taraPuller.bashHistory.enabled": {
          "type": "boolean",
          "default": true,
          "description": "Enable automatic bash history recording"
        },
        "taraPuller.bashHistory.commandCount": {
          "type": "number",
          "default": 10,
          "minimum": 1,
          "maximum": 100,
          "description": "Number of recent commands to record"
        },
        "taraPuller.bashHistory.checkInterval": {
          "type": "number",
          "default": 30,
          "minimum": 10,
          "description": "How often to check for new commands (in seconds)"
        }
      }
    }
  }
}
```

---

### Step 7: Integration Tests

**File: `test/providers/bash-history-provider.spec.ts`**

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { BashHistoryProvider } from '../../src/providers/BashHistoryProvider';
import { TaraStack } from '@jose_pereiro/taralib-js';

describe('BashHistoryProvider', () => {
    let tempDir: string;
    let testTara: TaraStack;
    let provider: BashHistoryProvider;

    beforeEach(() => {
        // Create temp directory for test stack
        tempDir = path.join(os.tmpdir(), `tara-test-${Date.now()}`);
        fs.mkdirSync(tempDir, { recursive: true });

        // Create test TaraStack
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
        // Cleanup
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    it('should initialize with configuration', () => {
        provider = new BashHistoryProvider({
            tara: testTara,
            enabled: true,
            commandCount: 10,
            checkIntervalMs: 1000,
        });

        expect(provider).toBeDefined();
    });

    it('should start and stop monitoring', () => {
        provider = new BashHistoryProvider({
            tara: testTara,
            enabled: true,
            commandCount: 10,
            checkIntervalMs: 1000,
        });

        provider.start();
        // Should have interval running
        expect((provider as any).intervalId).not.toBeNull();

        provider.stop();
        // Should have cleared interval
        expect((provider as any).intervalId).toBeNull();
    });

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

    it('should update configuration', () => {
        provider = new BashHistoryProvider({
            tara: testTara,
            enabled: false,
            commandCount: 10,
            checkIntervalMs: 1000,
        });

        provider.updateConfig({ enabled: true, commandCount: 20 });
        
        expect((provider as any).enabled).toBe(true);
        expect((provider as any).commandCount).toBe(20);
    });

    it('should manually record commands', () => {
        provider = new BashHistoryProvider({
            tara: testTara,
            enabled: true,
            commandCount: 10,
            checkIntervalMs: 1000,
        });

        // Manual record should not throw
        expect(() => provider.manualRecord()).not.toThrow();
        
        // Should have created tape file
        const tapePath = testTara.global.tapes.get('tara-puller').getHomePath();
        expect(fs.existsSync(tapePath)).toBe(true);
    });
});
```

---

## Summary of Changes

### New Files Created (7)
1. `src/utils/sensitive-filter.ts` - Sensitive data filtering
2. `src/utils/bash-history-parser.ts` - Parse bash history
3. `src/providers/BashHistoryProvider.ts` - Main provider logic
4. `src/config/sensitive-patterns.json` - Filter configuration
5. `test/utils/sensitive-filter.spec.ts` - Filter tests
6. `test/utils/bash-history-parser.spec.ts` - Parser tests
7. `test/providers/bash-history-provider.spec.ts` - Provider tests

### Modified Files (2)
1. `src/extension.ts` - Integration and command registration
2. `package.json` - New commands and configuration

### Data Format

Records will appear in the tape as:

```json
{
  "type": "tara-puller/bash-history",
  "capturedAt": "2026-02-04T14:30:00.000Z",
  "commandCount": 10,
  "commands": [
    {
      "command": "npm run build",
      "timestamp": "2026-02-04T14:29:50.000Z",
      "cwd": "/home/user/project"
    },
    {
      "command": "git status",
      "timestamp": "2026-02-04T14:29:51.000Z",
      "cwd": "/home/user/project"
    }
  ]
}
```
