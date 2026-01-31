import { execSync, exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { AppHandlerRecipe } from './app-handler';

export interface GitHandlerOptions {
    encoding?: BufferEncoding;
    timeout?: number;
    maxBuffer?: number;
    silent?: boolean;
}

export interface GitHandlerRecipe {
    repoPath: string,
    options?: GitHandlerOptions
}

/**
 * GitHandler provides safe git command execution with working tree validation.
 * Each instance manages a single git repository path.
 */
export class GitHandler {
    private repoPath: string;
    private options: GitHandlerOptions;

    constructor(recipe: GitHandlerRecipe) {
        this.repoPath = path.resolve(recipe.repoPath);
        this.options = recipe.options ?? {};
    }

    /**
     * Get the repository path.
     */
    getRepoPath(): string {
        return this.repoPath;
    }

    private _execSyncOptions(
        captureOutput: boolean = false
    ): Parameters<typeof execSync>[1] {
        return {
            cwd: this.repoPath,
            encoding: this.options?.encoding || 'utf-8',
            timeout: this.options?.timeout,
            maxBuffer: this.options?.maxBuffer,
            stdio: this.options.silent || captureOutput ? ['pipe', 'pipe', 'pipe'] : 'inherit'
        }
    }

    private _execOptions(): Parameters<typeof exec>[1] {
        return {
            cwd: this.repoPath,
            encoding: this.options?.encoding || 'utf-8',
            timeout: this.options?.timeout,
            maxBuffer: this.options?.maxBuffer
        }
    }

    /**
     * Check if we are inside a git working tree.
     * Uses `git rev-parse --is-inside-work-tree` to verify.
     * @returns true if inside a valid git working tree, false otherwise
     */
    checkInsideWorkingTree(): boolean {
        try {
            const result = execSync(
                'git rev-parse --is-inside-work-tree',
                this._execSyncOptions(true)
            ).toString().trim();
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
            execSync(
                'git init',
                this._execSyncOptions()
            );
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
            const result = execSync(
                'git rev-parse --show-toplevel',
                this._execSyncOptions(true)
            ).toString().trim();
            return result;
        } catch (error) {
            throw new Error(`Failed to get git repository root path: ${error}`);
        }
    }

    /**
     * Execute a git command synchronously.
     * Always validates working tree before execution.
     * @param command - The git command to execute (without 'git' prefix)
     *                  Can be a string or array of arguments
     *                  Array form handles escaping automatically: ['commit', '-m', 'message with "quotes"']
     * @param options - Optional execution options
     * @returns Command output as string
     * @throws Error if not inside a valid git working tree or command fails
     */
    execCmdSync(command: string | string[]): string {

        this.ensureInsideWorkingTree();

        const fullCommand = Array.isArray(command)
            ? this.buildCommandFromArray(command)
            : `git ${command}`;

        try {
            const result = execSync(
                fullCommand,
                this._execSyncOptions(true)
            ).toString().trim();
            return result;
        } catch (error) {
            throw new Error(`Git command failed: ${fullCommand}\n${error}`);
        }
    }

    private needQuoting(arg: string): boolean {
        return arg.includes(' ') ||
            arg.includes(':') || 
            arg.includes('(') || 
            arg.includes(')');
    }

    /**
     * Build a properly escaped git command from an array of arguments.
     * @private
     */
    private buildCommandFromArray(args: string[]): string {
        const escapedArgs = args.map(arg => {
            // Escape double quotes and wrap in quotes
            const escaped = arg
                .replace(/\\/g, '\\\\')
                .replace(/"/g, '\\"')
                .replace(/\$/g, '\\$');
            // Quote arguments that contain spaces or special characters
            if (this.needQuoting(arg)) {
                return `"${escaped}"`;
            }
            return escaped;
        });
        return `git ${escapedArgs.join(' ')}`;
    }

    /**
     * Execute a git command asynchronously.
     * Always validates working tree before execution.
     * @param command - The git command to execute (without 'git' prefix)
     * @param options - Optional execution options
     * @returns Promise that resolves to command output as string
     * @throws Error if not inside a valid git working tree or command fails
     */
    execCmdAsync(command: string): Promise<string> {
        return new Promise((resolve, reject) => {
            try {
                this.ensureInsideWorkingTree();
            } catch (error) {
                return reject(error);
            }

            exec(
                `git ${command}`,
                this._execOptions(),
                (error: any, stdout: any, stderr: any) => {
                    if (error) {
                        reject(new Error(`Git command failed: git ${command}\n${stderr || error.message}`));
                        return;
                    }
                    resolve(stdout.trim());
                });
        });
    }
}
