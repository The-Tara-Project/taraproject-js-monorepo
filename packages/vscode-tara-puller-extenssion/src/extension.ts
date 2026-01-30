import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { TaraStack, RecordHandler } from '@jose_pereiro/taralib-js';
import { Contextor, ContextRequestResult } from '@jose_pereiro/tara-contextor-ts';

const APP_NAME = 'tara-puller';
const CONFIRM_PREFIX = '...';

// Question management types and utilities
interface TaraQuestion {
    question: string;
    prompt?: string;
    placeholder?: string;
    pullerName: string;
}

/**
 * Get the questions folder path for an app
 */
function getQuestionsPath(tara: TaraStack): string {
    const appHandler = tara.global.apps.get(APP_NAME);
    return path.join(appHandler.getHomePath(), 'questions');
}

/**
 * Ensure the questions folder exists
 */
function ensureQuestionsFolder(tara: TaraStack): void {
    const questionsPath = getQuestionsPath(tara);
    if (!fs.existsSync(questionsPath)) {
        fs.mkdirSync(questionsPath, { recursive: true });
    }
}

/**
 * List all question files
 */
function listQuestionFiles(tara: TaraStack): string[] {
    const questionsPath = getQuestionsPath(tara);
    if (!fs.existsSync(questionsPath)) {
        return [];
    }
    return fs.readdirSync(questionsPath)
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''));
}

/**
 * Save a question to file
 */
function saveQuestion(tara: TaraStack, questionId: string, question: TaraQuestion): void {
    ensureQuestionsFolder(tara);
    const questionsPath = getQuestionsPath(tara);
    const filePath = path.join(questionsPath, `${questionId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(question, null, 2), 'utf-8');
}

/**
 * Load a random question from the questions folder
 */
function loadRandomQuestion(tara: TaraStack): TaraQuestion | null {
    const questionIds = listQuestionFiles(tara);
    if (questionIds.length === 0) {
        return null;
    }
    const randomId = questionIds[Math.floor(Math.random() * questionIds.length)];
    const questionsPath = getQuestionsPath(tara);
    const filePath = path.join(questionsPath, `${randomId}.json`);
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as TaraQuestion;
}

/**
 * Get the tape ID (monthly prefixing is handled by the tape manager)
 */
function currentTapeId(): string {
    return APP_NAME;
}

interface PullerState {
    lastPromptTime: number;
    isWindowFocused: boolean;
    intervalId: NodeJS.Timeout | null;
    retryTimeoutId: NodeJS.Timeout | null;
    tara: TaraStack | null;
    user_tara: TaraStack | null;
    dev_tara: TaraStack | null;
    contextor: Contextor | null;
    minIntervalMs: number;
    checkIntervalMs: number;
    enabled: boolean;
    testMode: boolean;
    isDialogShowing: boolean;
}

const state: PullerState = {
    lastPromptTime: 0,
    isWindowFocused: true,
    intervalId: null,
    retryTimeoutId: null,
    tara: null,
    user_tara: null,
    dev_tara: null,
    contextor: null,
    minIntervalMs: 60 * 1000,
    checkIntervalMs: 10 * 1000,
    enabled: true,
    testMode: false,
    isDialogShowing: false,
};

/**
 * Collect context using Contextor
 */
async function collectContext(): Promise<ContextRequestResult[]> {
    if (!state.contextor) {
        return [];
    }
    
    return state.contextor.collect([{
        provider: 'vscode-session',
        items: ['opened-files-paths', 'focused-file-path', 'workspace-folders-paths'],
        options: { vscode }
    }]);
}

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
    state.testMode = getConfig('testMode', false);

    // Configuration validation and enforcement
    if (state.minIntervalMs < 10000) {
        vscode.window.showWarningMessage(
            `Tara Puller: minInterval (${state.minIntervalMs / 1000}s) is too low, using 10s minimum`
        );
        state.minIntervalMs = 10000;
    }
    if (state.checkIntervalMs >= state.minIntervalMs) {
        const newCheckInterval = Math.max(1000, Math.floor(state.minIntervalMs / 2));
        vscode.window.showWarningMessage(
            `Tara Puller: checkInterval (${state.checkIntervalMs / 1000}s) must be less than minInterval (${state.minIntervalMs / 1000}s), using ${newCheckInterval / 1000}s`
        );
        state.checkIntervalMs = newCheckInterval;
    }
    if (state.checkIntervalMs < 1000) {
        state.checkIntervalMs = 1000;
    }
}

/**
 * Initialize the TaraStack (singleton pattern - only init once)
 */
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
        
        // Initialize Contextor with the TaraStack
        state.contextor = new Contextor(state.tara);
    }
    return state.tara;
}

/**
 * Reinitialize TaraStack (used when test mode changes)
 */
function reinitTaraStack(): void {
    state.tara = null;
    state.contextor = null;
    initTaraStack();
}

/**
 * Get or create tape handler for the current tape ID
 */
function getTape() {
    const tara = initTaraStack();
    const tapeId = currentTapeId();

    // Get the tape handler (creates new instance)
    const tape = tara.global.tapes.get(tapeId);

    // Ensure tape file exists (instantiate is idempotent)
    tape.instantiate();

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
 * Record a pull entry to the tape with full context
 */
async function recordEntry(
    response: string | null,
    dismissed: boolean,
    contextResults: ContextRequestResult[]
): Promise<void> {
    const tape = getTape();

    const record = new RecordHandler({
        type: 'tara-puller/entry',
        timestamp: new Date().toISOString(),
        dismissed,
        response: response ?? null,
        contextResults,
    });

    tape.appendRecord(record);
}

function defaultQuestion(): TaraQuestion {
    const defaultQuestion: TaraQuestion = {
        question: 'What are you doing/thinking?',
        prompt: `Describe your current activity (end with ${CONFIRM_PREFIX} to submit, or type just ${CONFIRM_PREFIX} to dismiss)`,
        placeholder: `e.g., Working on feature X${CONFIRM_PREFIX}`,
        pullerName: APP_NAME,
    };
    return defaultQuestion
}

/**
 * Load a question from the questions folder, or return null if loading fails
 */
function loadQuestionForDialog(): TaraQuestion {
    try {
        const tara = initTaraStack();
        const question = loadRandomQuestion(tara);
        return question ?? defaultQuestion()
    } catch {
        return defaultQuestion()
    }
}

/**
 * Clear any pending retry timeout
 */
function clearPendingRetry(): void {
    if (state.retryTimeoutId) {
        clearTimeout(state.retryTimeoutId);
        state.retryTimeoutId = null;
    }
}

/**
 * Schedule a retry of the prompt after 5 seconds
 */
function scheduleRetry(): void {
    // Clear any existing retry timeout
    if (state.retryTimeoutId) {
        clearTimeout(state.retryTimeoutId);
        state.retryTimeoutId = null;
    }

    // Schedule new retry
    state.retryTimeoutId = setTimeout(() => {
        state.retryTimeoutId = null;
        if (isEnabled() && isUserActive() && !state.isDialogShowing) {
            showPullDialog();
        }
    }, 5000);
}

/**
 * Show the pull dialog with a question loaded from files
 * Returns true if dialog was shown, false if skipped due to loading failure or lock
 */
async function showPullDialog(): Promise<boolean> {
    // Prevent multiple dialogs from overlapping (race condition fix)
    if (state.isDialogShowing) {
        return false;
    }
    state.isDialogShowing = true;

    try {
        // Clear any pending retry since we're showing a dialog now
        clearPendingRetry();

        // Load question from file
        const question = loadQuestionForDialog();

        // If loading fails and no fallback configured, skip this iteration
        // Update lastPromptTime to prevent rapid repeated attempts
        if (!question) {
            state.lastPromptTime = Date.now();
            vscode.window.setStatusBarMessage('Tara Puller: No questions configured, skipping', 3000);
            return false;
        }

        // Update last prompt time only when we actually show the dialog
        state.lastPromptTime = Date.now();

        // Collect context BEFORE showing dialog (captures state at prompt time)
        const contextResults = await collectContext();

        const title = state.testMode
            ? `${question.question} (testMode ⚠️)`
            : question.question;

        const response = await vscode.window.showInputBox({
            title,
            prompt: question.prompt ?? 'Enter your response',
            placeHolder: question.placeholder ?? '',
            ignoreFocusOut: false,
            validateInput: (value: string) => {
                // Accept only "..." (to dismiss) or text ending with "..." (to submit)
                if (value === CONFIRM_PREFIX) {
                    return null; // Allow just "..." to explicitly dismiss
                }
                if (value.length > 0 && value.endsWith(CONFIRM_PREFIX)) {
                    return null; // Allow content ending with "..."
                }
                if (value.length === 0) {
                    return `Type ${CONFIRM_PREFIX} to dismiss, or enter your message ending with ${CONFIRM_PREFIX}`;
                }
                return `End your message with ${CONFIRM_PREFIX} to submit, or type just ${CONFIRM_PREFIX} to dismiss`;
            }
        });

        if (response === undefined || response === '') {
            // User dismissed via ESC, click-outside, or empty input → Schedule retry
            vscode.window.setStatusBarMessage('Tara Puller: Retrying in 5s', 3000);
            scheduleRetry();
        } else if (response === CONFIRM_PREFIX) {
            // User explicitly dismissed by typing just "..."
            clearPendingRetry();
            await recordEntry(null, true, contextResults);
            vscode.window.setStatusBarMessage('Tara Puller: Dismissed', 3000);
            vscode.window.showInformationMessage('Tara Puller: Question dismissed');
        } else {
            // User submitted content - strip the CONFIRM_PREFIX suffix
            clearPendingRetry();
            const cleanResponse = response.endsWith(CONFIRM_PREFIX) ? response.slice(0, -CONFIRM_PREFIX.length) : response;
            await recordEntry(cleanResponse, false, contextResults);
            vscode.window.setStatusBarMessage('Tara Puller: Recorded', 3000);
        }

        return true;
    } finally {
        state.isDialogShowing = false;
    }
}

/**
 * Check conditions and show dialog if appropriate
 */
async function checkAndPrompt(): Promise<void> {
    // Protocol:
    // 0. Check if enabled
    // 1. Check if dialog already showing (prevents race conditions)
    // 2. Check if user is active
    // 3. Check if it's time to query
    // 4. Query
    // 5. Get data and append to tape

    if (!isEnabled()) {
        return;
    }

    // Skip if dialog is already showing (race condition prevention)
    if (state.isDialogShowing) {
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
    clearPendingRetry();
    if (state.enabled) {
        startChecker();
    }
}

export function activate(context: vscode.ExtensionContext): void {
    // Load settings
    loadSettings();

    // Track window focus state
    context.subscriptions.push(
        vscode.window.onDidChangeWindowState((e: vscode.WindowState) => {
            state.isWindowFocused = e.focused;
        })
    );

    // Watch for configuration changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e: vscode.ConfigurationChangeEvent) => {
            if (e.affectsConfiguration('taraPuller')) {
                const oldTestMode = state.testMode;
                loadSettings();
                if (oldTestMode !== state.testMode) {
                    reinitTaraStack();
                }
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

            const testModeStatus = state.testMode
                ? 'ON (~/.taraproject/dev/tara-puller-test-stack/)'
                : 'OFF (~/.taraproject/)';
            vscode.window.showInformationMessage(
                `Tara Puller Status:\n` +
                `• Enabled: ${state.enabled}\n` +
                `• Test mode: ${testModeStatus}\n` +
                `• Window focused: ${state.isWindowFocused}\n` +
                `• Min interval: ${state.minIntervalMs / 1000}s\n` +
                `• Time until next prompt: ${Math.ceil(timeUntilNext / 1000)}s\n` +
                `• Tape: ${currentTapeId()}`
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
                validateInput: (value: string) => {
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

    // Register command to toggle test mode
    context.subscriptions.push(
        vscode.commands.registerCommand('taraPuller.toggleTestMode', async () => {
            const newState = !state.testMode;
            await setConfig('testMode', newState);
            const modePath = newState
                ? '~/.taraproject/dev/tara-puller-test-stack/'
                : '~/.taraproject/';
            vscode.window.showInformationMessage(`Tara Puller: Now using ${modePath}`);
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
    clearPendingRetry();
}
