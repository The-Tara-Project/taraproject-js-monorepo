import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/**
 * GitHandler provides basic Git operations tailored.
 * Operations are synchronous and use the global Git user configuration.
 */
export class GitHandler {
    private repoPath: string;

    constructor(repoPath: string) {
        this.repoPath = path.resolve(repoPath);
    }

    /**
     * Execute a git command in the repository directory.
     * @param command - The git command to execute (without 'git' prefix)
     * @returns The command output as a string
     * @throws Error if the command fails
     */
    private _exec(command: string): string {
        try {
            const result = execSync(`git ${command}`, {
                cwd: this.repoPath,
                encoding: 'utf-8',
                stdio: ['pipe', 'pipe', 'pipe']
            });
            return result.trim();
        } catch (error: any) {
            const message = error.stderr ? error.stderr.toString().trim() : error.message;
            throw new Error(`Git command failed: ${message}`);
        }
    }

    /**
     * Validate that the current path is within the expected git repository.
     * @throws Error if validation fails
     */
    private _validate(): void {
        try {
            const topLevel = this._exec('rev-parse --show-toplevel');
            // Resolve symlinks to get the real paths (important on macOS where /var is a symlink)
            const normalizedTopLevel = fs.realpathSync(path.resolve(topLevel));
            const normalizedRepoPath = fs.realpathSync(path.resolve(this.repoPath));

            if (normalizedTopLevel !== normalizedRepoPath) {
                throw new Error(`Path validation failed: expected ${normalizedRepoPath}, got ${normalizedTopLevel}`);
            }
        } catch (error: any) {
            throw new Error(`Repository validation failed: ${error.message}`);
        }
    }

    /**
     * Initialize a git repository if it doesn't already exist.
     * Always validates the repository after initialization.
     */
    init(): void {
        const gitDir = path.join(this.repoPath, '.git');

        if (!fs.existsSync(gitDir)) {
            // Ensure the directory exists
            if (!fs.existsSync(this.repoPath)) {
                fs.mkdirSync(this.repoPath, { recursive: true });
            }

            this._exec('init');
        }

        // Always validate after init
        this._validate();
    }

    isGitRepo(): boolean {
        try {
            this._validate();
            return true;
        } catch {
            return false;
        }
    }


    /**
     * Stage all changes and commit with the given message.
     * If there are no changes, this is a silent no-op.
     * @param message - The commit message
     */
    commit(message: string): void {
        this._validate();

        // Check if there are any changes
        const status = this._exec('status --porcelain');
        if (status.length === 0) {
            // No changes, silent no-op
            return;
        }

        // Stage all changes
        this._exec('add -A');

        // Commit with message
        this._exec(`commit -m "${message.replace(/"/g, '\\"')}"`);
    }

    /**
     * Stage a specific file.
     * @param filePath - The file path relative to the repo root
     */
    addFile(filePath: string): void {
        this._validate();
        this._exec(`add "${filePath.replace(/"/g, '\\"')}"`);
    }

    /**
     * Commit staged changes with the given message.
     * Only commits what is already staged. If nothing is staged, this is a silent no-op.
     * @param message - The commit message
     */
    commitStaged(message: string): void {
        this._validate();

        // Check if there are any staged changes
        const stagedStatus = this._exec('diff --cached --name-only');
        if (stagedStatus.length === 0) {
            // Nothing staged, silent no-op
            return;
        }

        // Commit with message
        this._exec(`commit -m "${message.replace(/"/g, '\\"')}"`);
    }

    /**
     * Force checkout to the specified ref, discarding uncommitted changes.
     * @param ref - The git ref to checkout (branch, tag, or commit hash)
     */
    checkout(ref: string): void {
        this._validate();
        this._exec(`checkout -f ${ref}`);
    }

    /**
     * Get the current git status.
     * @param format - 'porcelain' for machine-readable, 'default' for human-readable
     * @returns Status output
     */
    getStatus(format: 'porcelain' | 'default' = 'default'): string {
        this._validate();
        const flag = format === 'porcelain' ? ' --porcelain' : '';
        return this._exec(`status${flag}`);
    }

    /**
     * Get commit log.
     * @param options - Log options (limit, format, etc.)
     * @returns Log output
     */
    getLog(options?: {
        limit?: number;
        oneline?: boolean;
        format?: string;
    }): string {
        this._validate();
        const parts = ['log'];

        if (options?.oneline) {
            parts.push('--oneline');
        }
        if (options?.limit) {
            parts.push(`-${options.limit}`);
        }
        if (options?.format) {
            parts.push(`--format="${options.format}"`);
        }

        return this._exec(parts.join(' '));
    }

    /**
     * Get diff output.
     * @param ref - Optional ref to compare against (defaults to unstaged changes)
     * @param cached - If true, show staged changes
     * @returns Diff output
     */
    getDiff(ref?: string, cached: boolean = false): string {
        this._validate();
        const parts = ['diff'];

        if (cached) {
            parts.push('--cached');
        }
        if (ref) {
            parts.push(ref);
        }

        return this._exec(parts.join(' '));
    }

    /**
     * Get the current branch name.
     * @returns Current branch name
     */
    getCurrentBranch(): string {
        this._validate();
        return this._exec('rev-parse --abbrev-ref HEAD');
    }

    /**
     * Get the current commit hash.
     * @param short - If true, return short hash
     * @returns Commit hash
     */
    getHeadCommit(short: boolean = false): string {
        this._validate();
        const flag = short ? ' --short' : '';
        return this._exec(`rev-parse${flag} HEAD`);
    }

    /**
     * Get the current repository path.
     */
    getRepoPath(): string {
        return this.repoPath;
    }
}
