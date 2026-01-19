import * as vscode from 'vscode';
import { TaraTapeHandler, TaraRecord, ensureTaraHome } from '@jose_pereiro/taralib-js';

const TAPE_ID = 'tara-puller-001';

interface PullerState {
    lastPromptTime: number;
    isWindowFocused: boolean;
    intervalId: NodeJS.Timeout | null;
    tape: TaraTapeHandler | null;
    minIntervalMs: number;
    checkIntervalMs: number;
    enabled: boolean;
}

const state: PullerState = {
    lastPromptTime: 0,
    isWindowFocused: true,
    intervalId: null,
    tape: null,
    minIntervalMs: 60 * 1000,
    checkIntervalMs: 10 * 1000,
    enabled: true,
};

/**
 * Get configuration value
 */
function getConfig<T>(key: string, defaultValue: T): T {
    const config = vscode.workspace.getConfiguration('taraPuller');
    return config.get<T>(key, defaultValue);
}

/**
 * Set configuration value
 */
async function setConfig(key: string, value: any): Promise<void> {
    const config = vscode.workspace.getConfiguration('taraPuller');
    await config.update(key, value, vscode.ConfigurationTarget.Global);
}

/**
 * Load settings from configuration
 */
function loadSettings(): void {
    state.minIntervalMs = getConfig('minInterval', 60) * 1000;
    state.checkIntervalMs = getConfig('checkInterval', 10) * 1000;
    state.enabled = getConfig('enabled', true);
}

/**
 * Initialize the tape handler
 */
function initTape(): TaraTapeHandler {
    ensureTaraHome();
    const tape = new TaraTapeHandler(TAPE_ID);
    tape.fileHandler.instantiate();
    return tape;
}

/**
 * Check if enough time has passed since last prompt
 */
function isTimeToQuery(): boolean {
    const now = Date.now();
    return (now - state.lastPromptTime) >= state.minIntervalMs;
}

/**
 * Check if user is active (window focused)
 */
function isUserActive(): boolean {
    return state.isWindowFocused;
}

/**
 * Check if puller is enabled
 */
function isEnabled(): boolean {
    return state.enabled;
}

/**
 * Record a pull entry to the tape
 */
function recordEntry(response: string | null, dismissed: boolean): void {
    if (!state.tape) {
        return;
    }

    const record = new TaraRecord({
        type: 'tara-puller/entry',
        timestamp: new Date().toISOString(),
        dismissed,
        response: response ?? null,
    });

    state.tape.fileHandler.appendRecord(record);
}

/**
 * Show the "What are you doing?" dialog
 */
async function showPullDialog(): Promise<void> {
    // Update last prompt time
    state.lastPromptTime = Date.now();

    const response = await vscode.window.showInputBox({
        title: 'What are you doing?',
        prompt: 'Describe your current activity',
        placeHolder: 'e.g., Working on feature X, debugging issue Y...',
        ignoreFocusOut: false,
    });

    if (response === undefined) {
        // User dismissed (pressed Escape or clicked away)
        recordEntry(null, true);
        vscode.window.setStatusBarMessage('Tara Puller: Dismissed', 3000);
    } else {
        // User submitted (even if empty string)
        recordEntry(response, false);
        vscode.window.setStatusBarMessage('Tara Puller: Recorded', 3000);
    }
}

/**
 * Check conditions and show dialog if appropriate
 */
async function checkAndPrompt(): Promise<void> {
    // Protocol:
    // 0. Check if enabled
    // 1. Check if user is active
    // 2. Check if it's time to query
    // 3. Query
    // 4. Get data and append to tape

    if (!isEnabled()) {
        return;
    }

    if (!isUserActive()) {
        return;
    }

    if (!isTimeToQuery()) {
        return;
    }

    await showPullDialog();
}

/**
 * Start the periodic checker
 */
function startChecker(): void {
    if (state.intervalId) {
        return;
    }

    state.intervalId = setInterval(() => {
        checkAndPrompt();
    }, state.checkIntervalMs);
}

/**
 * Stop the periodic checker
 */
function stopChecker(): void {
    if (state.intervalId) {
        clearInterval(state.intervalId);
        state.intervalId = null;
    }
}

/**
 * Restart the checker (stop and start with new settings)
 */
function restartChecker(): void {
    stopChecker();
    if (state.enabled) {
        startChecker();
    }
}

export function activate(context: vscode.ExtensionContext): void {
    // Load settings
    loadSettings();

    // Initialize tape
    state.tape = initTape();

    // Track window focus state
    context.subscriptions.push(
        vscode.window.onDidChangeWindowState((e) => {
            state.isWindowFocused = e.focused;
        })
    );

    // Watch for configuration changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('taraPuller')) {
                loadSettings();
                restartChecker();
            }
        })
    );

    // Register command to trigger prompt manually
    context.subscriptions.push(
        vscode.commands.registerCommand('taraPuller.askNow', async () => {
            await showPullDialog();
        })
    );

    // Register command to show status
    context.subscriptions.push(
        vscode.commands.registerCommand('taraPuller.showStatus', () => {
            const timeSinceLastPrompt = Date.now() - state.lastPromptTime;
            const timeUntilNext = Math.max(0, state.minIntervalMs - timeSinceLastPrompt);

            vscode.window.showInformationMessage(
                `Tara Puller Status:\n` +
                `• Enabled: ${state.enabled}\n` +
                `• Window focused: ${state.isWindowFocused}\n` +
                `• Min interval: ${state.minIntervalMs / 1000}s\n` +
                `• Time until next prompt: ${Math.ceil(timeUntilNext / 1000)}s\n` +
                `• Tape: ${TAPE_ID}`
            );
        })
    );

    // Register command to set frequency
    context.subscriptions.push(
        vscode.commands.registerCommand('taraPuller.setFrequency', async () => {
            const currentInterval = state.minIntervalMs / 1000;
            const input = await vscode.window.showInputBox({
                title: 'Set Pull Frequency',
                prompt: 'Enter minimum interval between prompts (in seconds)',
                value: currentInterval.toString(),
                validateInput: (value) => {
                    const num = parseInt(value, 10);
                    if (isNaN(num) || num < 10) {
                        return 'Please enter a number >= 10';
                    }
                    return null;
                }
            });

            if (input) {
                const seconds = parseInt(input, 10);
                await setConfig('minInterval', seconds);
                vscode.window.showInformationMessage(
                    `Tara Puller frequency set to ${seconds} seconds`
                );
            }
        })
    );

    // Register command to toggle enabled/disabled
    context.subscriptions.push(
        vscode.commands.registerCommand('taraPuller.toggleEnabled', async () => {
            const newState = !state.enabled;
            await setConfig('enabled', newState);
            vscode.window.showInformationMessage(
                `Tara Puller ${newState ? 'enabled' : 'disabled'}`
            );
        })
    );

    // Start the checker if enabled
    if (state.enabled) {
        startChecker();
    }

    // Show activation message
    vscode.window.setStatusBarMessage(
        `Tara Puller activated (${state.enabled ? 'enabled' : 'disabled'})`,
        3000
    );
}

export function deactivate(): void {
    stopChecker();
}
