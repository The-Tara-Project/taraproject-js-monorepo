import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { TaraStack, GTapeHandler, RecordHandler } from '@jose_pereiro/taralib-js';

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
    return path.join(appHandler.getPath(), 'questions');
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
 * Get the current tape ID based on the current date (YYYYMM-tara-puller)
 */
function currentTapeId(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}${month}-tara-puller`;
}

interface PullerState {
    lastPromptTime: number;
    isWindowFocused: boolean;
    intervalId: NodeJS.Timeout | null;
    retryTimeoutId: NodeJS.Timeout | null;
    tara: TaraStack | null;
    minIntervalMs: number;
    checkIntervalMs: number;
    enabled: boolean;
}

interface GitInfo {
    isRepo: boolean;
    repoRoot?: string;
    branch?: string;
    commitHash?: string;
    commitMessage?: string;
    remoteUrl?: string;
    isDirty?: boolean;
}

interface FileContext {
    path: string;
    relativePath?: string;
    fileName: string;
    languageId?: string;
    isActive: boolean;
    isPinned: boolean;
    git?: GitInfo;
}

interface WorkspaceContext {
    name?: string;
    folders: string[];
}

interface PullContext {
    activeFile?: FileContext;
    openFiles: FileContext[];
    pinnedFiles: FileContext[];
    workspace: WorkspaceContext;
    timestamp: string;
}

const state: PullerState = {
    lastPromptTime: 0,
    isWindowFocused: true,
    intervalId: null,
    retryTimeoutId: null,
    tara: null,
    minIntervalMs: 60 * 1000,
    checkIntervalMs: 10 * 1000,
    enabled: true,
};

// Cache git info per repo root to avoid repeated git calls
const gitCache: Map<string, { info: GitInfo; timestamp: number }> = new Map();
const GIT_CACHE_TTL = 5000; // 5 seconds

/**
 * Run a git command in a directory
 */
function runGitCommand(cwd: string, args: string): string | null {
    try {
        return execSync(`git ${args}`, {
            cwd,
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe']
        }).trim();
    } catch {
        return null;
    }
}

/**
 * Get git info for a file path
 */
function getGitInfo(filePath: string): GitInfo {
    const dir = path.dirname(filePath);

    // Check if inside a git repo
    const repoRoot = runGitCommand(dir, 'rev-parse --show-toplevel');
    if (!repoRoot) {
        return { isRepo: false };
    }

    // Check cache
    const cached = gitCache.get(repoRoot);
    if (cached && Date.now() - cached.timestamp < GIT_CACHE_TTL) {
        return cached.info;
    }

    // Get git info
    const branch = runGitCommand(repoRoot, 'rev-parse --abbrev-ref HEAD');
    const commitHash = runGitCommand(repoRoot, 'rev-parse HEAD');
    const commitMessage = runGitCommand(repoRoot, 'log -1 --pretty=%s');
    const remoteUrl = runGitCommand(repoRoot, 'config --get remote.origin.url');
    const status = runGitCommand(repoRoot, 'status --porcelain');
    const isDirty = status !== null && status.length > 0;

    const info: GitInfo = {
        isRepo: true,
        repoRoot,
        branch: branch ?? undefined,
        commitHash: commitHash ?? undefined,
        commitMessage: commitMessage ?? undefined,
        remoteUrl: remoteUrl ?? undefined,
        isDirty,
    };

    // Cache the result
    gitCache.set(repoRoot, { info, timestamp: Date.now() });

    return info;
}

/**
 * Get file context from a tab
 */
function getFileContextFromTab(tab: vscode.Tab, activeUri?: vscode.Uri): FileContext | null {
    // Check if tab has a URI (text document)
    const input = tab.input;
    if (!input || typeof input !== 'object' || !('uri' in input)) {
        return null;
    }

    const uri = (input as { uri: vscode.Uri }).uri;
    if (uri.scheme !== 'file') {
        return null;
    }

    const filePath = uri.fsPath;
    const isActive = activeUri?.fsPath === filePath;
    const isPinned = tab.isPinned;

    // Get workspace folder for relative path
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    const relativePath = workspaceFolder
        ? path.relative(workspaceFolder.uri.fsPath, filePath)
        : undefined;

    // Get language ID from active document if available
    let languageId: string | undefined;
    if (isActive && vscode.window.activeTextEditor) {
        languageId = vscode.window.activeTextEditor.document.languageId;
    }

    return {
        path: filePath,
        relativePath,
        fileName: path.basename(filePath),
        languageId,
        isActive,
        isPinned,
        git: getGitInfo(filePath),
    };
}

/**
 * Gather all context about the current VS Code state
 */
function gatherContext(): PullContext {
    const context: PullContext = {
        openFiles: [],
        pinnedFiles: [],
        workspace: {
            name: vscode.workspace.name,
            folders: vscode.workspace.workspaceFolders?.map(f => f.uri.fsPath) ?? [],
        },
        timestamp: new Date().toISOString(),
    };

    // Get active editor URI
    const activeUri = vscode.window.activeTextEditor?.document.uri;

    // Track seen files to avoid duplicates
    const seenPaths = new Set<string>();

    // Iterate through all tab groups
    for (const tabGroup of vscode.window.tabGroups.all) {
        for (const tab of tabGroup.tabs) {
            const fileContext = getFileContextFromTab(tab, activeUri);
            if (!fileContext || seenPaths.has(fileContext.path)) {
                continue;
            }
            seenPaths.add(fileContext.path);

            context.openFiles.push(fileContext);

            if (fileContext.isPinned) {
                context.pinnedFiles.push(fileContext);
            }

            if (fileContext.isActive) {
                context.activeFile = fileContext;
            }
        }
    }

    return context;
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
}

/**
 * Initialize the TaraStack (singleton pattern - only init once)
 */
function initTaraStack(): TaraStack {
    if (!state.tara) {
        state.tara = new TaraStack({
            writer: APP_NAME
        });
        state.tara.global.home.instantiate();
    }
    return state.tara;
}

/**
 * Get or create tape handler for the current tape ID
 */
function getTape(): GTapeHandler {
    const tara = initTaraStack();
    const tapeId = currentTapeId();

    // Get the tape handler (creates new instance)
    const tape = tara.global.tapes.get(tapeId);

    // Ensure tape file exists (idempotent operation)
    if (!tape.exists()) {
        tape.instantiate();
    }

    return tape;
}

/**
 * Ensure the questions folder exists and has at least one question.
 * Creates the default "What are you doing/thinking?" question if none exist.
 */
function ensureInitialQuestions(): void {
    const tara = initTaraStack();
    ensureQuestionsFolder(tara);

    const existingQuestions = listQuestionFiles(tara);
    if (existingQuestions.length === 0) {
        // Create the default question
        const defaultQuestion: TaraQuestion = {
            question: 'What are you doing?',
            prompt: `Describe your current activity (end with ${CONFIRM_PREFIX} to submit, or type just ${CONFIRM_PREFIX} to dismiss)`,
            placeholder: `e.g., Working on feature X${CONFIRM_PREFIX}`,
            pullerName: APP_NAME,
        };
        saveQuestion(tara, 'what-are-you-doing', defaultQuestion);
    }
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
function recordEntry(response: string | null, dismissed: boolean, context: PullContext): void {
    const tape = getTape();

    const record = new RecordHandler({
        type: 'tara-puller/entry',
        timestamp: new Date().toISOString(),
        dismissed,
        response: response ?? null,
        context,
    });

    tape.appendRecord(record);
}

/**
 * Load a question from the questions folder, or return null if loading fails
 */
function loadQuestionForDialog(): TaraQuestion | null {
    try {
        const tara = initTaraStack();
        return loadRandomQuestion(tara);
    } catch {
        return null;
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
        if (isEnabled() && isUserActive()) {
            showPullDialog();
        }
    }, 5000);
}

/**
 * Show the pull dialog with a question loaded from files
 * Returns true if dialog was shown, false if skipped due to loading failure
 */
async function showPullDialog(): Promise<boolean> {
    // Clear any pending retry since we're showing a dialog now
    clearPendingRetry();

    // Load question from file
    const question = loadQuestionForDialog();

    // If loading fails and no fallback configured, skip this iteration
    if (!question) {
        vscode.window.setStatusBarMessage('Tara Puller: No questions configured, skipping', 3000);
        return false;
    }

    // Update last prompt time only when we actually show the dialog
    state.lastPromptTime = Date.now();

    // Gather context BEFORE showing dialog (captures state at prompt time)
    const context = gatherContext();

    const response = await vscode.window.showInputBox({
        title: question.question,
        prompt: question.prompt ?? 'Enter your response',
        placeHolder: question.placeholder ?? '',
        ignoreFocusOut: false,
        validateInput: (value) => {
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
        recordEntry(null, true, context);
        vscode.window.setStatusBarMessage('Tara Puller: Dismissed', 3000);
        vscode.window.showInformationMessage('Tara Puller: Question dismissed');
    } else {
        // User submitted content - strip the CONFIRM_PREFIX suffix
        clearPendingRetry();
        const cleanResponse = response.endsWith(CONFIRM_PREFIX) ? response.slice(0, -CONFIRM_PREFIX.length) : response;
        recordEntry(cleanResponse, false, context);
        vscode.window.setStatusBarMessage('Tara Puller: Recorded', 3000);
    }

    return true;
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

    // Ensure questions folder exists with initial question
    ensureInitialQuestions();

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
            const ctx = gatherContext();

            vscode.window.showInformationMessage(
                `Tara Puller Status:\n` +
                `• Enabled: ${state.enabled}\n` +
                `• Window focused: ${state.isWindowFocused}\n` +
                `• Min interval: ${state.minIntervalMs / 1000}s\n` +
                `• Time until next prompt: ${Math.ceil(timeUntilNext / 1000)}s\n` +
                `• Open files: ${ctx.openFiles.length}\n` +
                `• Pinned files: ${ctx.pinnedFiles.length}\n` +
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
    clearPendingRetry();
}
