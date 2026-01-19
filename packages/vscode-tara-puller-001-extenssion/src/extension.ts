import * as vscode from 'vscode';
import * as path from 'path';
import { execSync } from 'child_process';
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
    tape: null,
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
 * Record a pull entry to the tape with full context
 */
function recordEntry(response: string | null, dismissed: boolean, context: PullContext): void {
    if (!state.tape) {
        return;
    }

    const record = new TaraRecord({
        type: 'tara-puller/entry',
        timestamp: new Date().toISOString(),
        dismissed,
        response: response ?? null,
        context,
    });

    state.tape.fileHandler.appendRecord(record);
}

/**
 * Show the "What are you doing?" dialog
 */
async function showPullDialog(): Promise<void> {
    // Update last prompt time
    state.lastPromptTime = Date.now();

    // Gather context BEFORE showing dialog (captures state at prompt time)
    const context = gatherContext();

    const response = await vscode.window.showInputBox({
        title: 'What are you doing?',
        prompt: 'Describe your current activity',
        placeHolder: 'e.g., Working on feature X, debugging issue Y...',
        ignoreFocusOut: false,
    });

    if (response === undefined) {
        // User dismissed (pressed Escape or clicked away)
        recordEntry(null, true, context);
        vscode.window.setStatusBarMessage('Tara Puller: Dismissed', 3000);
    } else {
        // User submitted (even if empty string)
        recordEntry(response, false, context);
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
            const ctx = gatherContext();

            vscode.window.showInformationMessage(
                `Tara Puller Status:\n` +
                `• Enabled: ${state.enabled}\n` +
                `• Window focused: ${state.isWindowFocused}\n` +
                `• Min interval: ${state.minIntervalMs / 1000}s\n` +
                `• Time until next prompt: ${Math.ceil(timeUntilNext / 1000)}s\n` +
                `• Open files: ${ctx.openFiles.length}\n` +
                `• Pinned files: ${ctx.pinnedFiles.length}\n` +
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
