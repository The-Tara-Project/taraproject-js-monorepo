import { execSync, exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface ExecOptions {
    encoding?: BufferEncoding;
    timeout?: number;
    maxBuffer?: number;
}

/**
 * GitHandler provides safe git command execution with working tree validation.
 * Each instance manages a single git repository path.
 */
export class GitHandler {
    private repoPath: string;
    private options: {};
    private silent: boolean;

    constructor(
        repoPath: string, 
        options?: { verbose?: boolean; silent?: boolean }
    ) {
        this.repoPath = path.resolve(repoPath);
        this.options = options ?? {};
    }

    /**
     * Get the repository path.
     */
    getRepoPath(): string {
        return this.repoPath;
    }

    /**
     * Check if we are inside a git working tree.
     * Uses `git rev-parse --is-inside-work-tree` to verify.
     * @returns true if inside a valid git working tree, false otherwise
     */
    checkInsideWorkingTree(): boolean {
        try {
            const result = execSync('git rev-parse --is-inside-work-tree', {
                cwd: this.repoPath,
                encoding: 'utf-8',
                stdio: this.silent ? ['pipe', 'pipe', 'pipe'] : 'inherit'
            }).trim();
            return result === 'true';
        } catch (error) {
            return false;
        }
    }

    ensureInsideWorkingTree(): void {
        if (!this.checkInsideWorkingTree()) {
            throw new Error(`Not inside a git working tree: ${this.repoPath}`);
        }
    }

    /**
     * Initialize the git repository if it doesn't exist.
     * Creates the directory if it doesn't exist.
     * @throws Error if initialization fails
     */
    instanciate(): void {
        // Ensure directory exists
        if (!fs.existsSync(this.repoPath)) {
            fs.mkdirSync(this.repoPath, { recursive: true });
        }

        // Check if already a git repo
        if (this.checkInsideWorkingTree()) {
            return; // Already initialized
        }

        // Initialize git repo
        try {
            execSync('git init', {
                cwd: this.repoPath,
                encoding: 'utf-8',
                stdio: this.silent ? ['pipe', 'pipe', 'pipe'] : 'inherit'
            });
        } catch (error) {
            throw new Error(`Failed to initialize git repository at ${this.repoPath}: ${error}`);
        }
    }

    /**
     * Check if the git repository exists (and is a valid working tree).
     * @returns true if the repository exists, false otherwise
     */
    exists(): boolean {
        return this.checkInsideWorkingTree();
    }

    getRepoRootPath(): string {
        try {
            const result = execSync('git rev-parse --show-toplevel', {
                cwd: this.repoPath,
                encoding: 'utf-8',
                stdio: this.silent ? ['pipe', 'pipe', 'pipe'] : 'inherit'
            }).trim();
            return result;
        } catch (error) {
            throw new Error(`Failed to get git repository root path: ${error}`);
        }
    }

    /**
     * Execute a git command synchronously.
     * Always validates working tree before execution.
     * @param command - The git command to execute (without 'git' prefix)
     * @param options - Optional execution options
     * @returns Command output as string
     * @throws Error if not inside a valid git working tree or command fails
     */
    execCmdSync(command: string, options?: ExecOptions): string {

        this.ensureInsideWorkingTree();

        try {
            const result = execSync(`git ${command}`, {
                cwd: this.repoPath,
                encoding: options?.encoding || 'utf-8',
                timeout: options?.timeout,
                maxBuffer: options?.maxBuffer,
                stdio: this.silent ? ['pipe', 'pipe', 'pipe'] : 'inherit'
            });
            return result.toString().trim();
        } catch (error) {
            throw new Error(`Git command failed: git ${command}\n${error}`);
        }
    }

    /**
     * Execute a git command asynchronously.
     * Always validates working tree before execution.
     * @param command - The git command to execute (without 'git' prefix)
     * @param options - Optional execution options
     * @returns Promise that resolves to command output as string
     * @throws Error if not inside a valid git working tree or command fails
     */
    execCmdAsync(command: string, options?: ExecOptions): Promise<string> {
        return new Promise((resolve, reject) => {
            try {
                this.ensureInsideWorkingTree();
            } catch (error) {
                return reject(error);
            }

            exec(`git ${command}`, {
                cwd: this.repoPath,
                encoding: options?.encoding || 'utf-8',
                timeout: options?.timeout,
                maxBuffer: options?.maxBuffer
            }, (error: any, stdout: any, stderr: any) => {
                if (error) {
                    reject(new Error(`Git command failed: git ${command}\n${stderr || error.message}`));
                    return;
                }
                resolve(stdout.trim());
            });
        });
    }
}
