import { execSync } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { GitHandler } from '../../../base/git-handler';
import { RecordHandler } from '../../../base/record-handler';
import { TapeHandler } from '../../../base/tape-handler';
import type { TaraStack } from '../../tara-stack';
import { GitStAssignmentManager, type GitStAssignmentLink } from './git-st-assignment-manager';

const TAPE_FILENAME = 'commits.tara.jsonl';

export interface TaraGitSTLink {
    repoId: string;
    repoPath: string;
    commitHash: string;
    commitCount: number;
    originalPath: string;
    storagePath: string;
    contentHash: string;
    recordId: string;
    recordHash?: string;
    timestamp: string;
    message?: string;
    assignmentKey?: string;
}

/**
 * GitStorageManager provides git-based file capture and commit functionality.
 * Self-contained: manages its own internal tape (commits.tara.jsonl) inside each git-storage repo.
 * Accessible via tara.global.gitst
 *
 * Bootstrap pattern: Constructor only stores context, no logic.
 */
export class GitStorageManager {
    private tapes: Map<string, TapeHandler> = new Map();
    private gitHandlers: Map<string, GitHandler> = new Map();
    private assignment: GitStAssignmentManager;

    constructor(private context: TaraStack) {
        // Bootstrap pattern: minimal initialization
        this.assignment = new GitStAssignmentManager(context);
    }

    /**
     * Map file path to storage location.
     * /Users/foo/bar/file.txt -> <sha256-of-dir>/file.txt
     * @private
     */
    private mapPathToStorage(filePath: string): string {
        const absolutePath = path.resolve(filePath);
        const dirPath = path.dirname(absolutePath);
        const fileName = path.basename(absolutePath);

        // Hash the directory path
        const hashSum = crypto.createHash('sha256');
        hashSum.update(dirPath);
        const dirHash = hashSum.digest('hex');

        return path.join(dirHash, fileName);
    }

    // --. -. - .- -. -.-.- . .-. - -- -- - -. . - .--.
    // MARK: Commit Workflows
    // --. -. - .- -. -.-.- . .-. - -- -- - -. . - .--.


    // MARK: ...instantiate
    /**
     * Initialize git-storage system for a specific repo.
     * - Creates repo directory
     * - Initializes git repo
     * - Creates internal tape
     * - Creates bootstrap commit if no commits exist
     * Idempotent operation.
     *
     * @param repoId - Repository identifier (defaults to DEFAULT_REPO_ID)
     */
    instantiate(repoId: string): void {
        const handler = this.getGitHandler(repoId);

        // GitHandler handles directory creation + git init (idempotent)
        handler.instanciate();

        // Ensure tape exists
        this.getTape(repoId).instantiate();

        // If no commits yet, do an initial commit with the tape
        try {
            handler.execCmdSync('rev-parse HEAD');
        } catch {
            handler.execCmdSync(`add ${TAPE_FILENAME}`);
            handler.execCmdSync('commit -m "init: bootstrap tape"');
        }
    }

    // MARK: ...copyFileToStorage
    /**
     * Copy file to storage location.
     * @private
     */
    private copyFileToStorage(originalPath: string, repoId: string): string {
        const storagePath = this.mapPathToStorage(originalPath);
        const fullStoragePath = path.join(this.getRepoPath(repoId), storagePath);
        const storageDir = path.dirname(fullStoragePath);

        // Create parent directory
        if (!fs.existsSync(storageDir)) {
            fs.mkdirSync(storageDir, { recursive: true });
        }

        // Copy file
        fs.copyFileSync(originalPath, fullStoragePath);

        return storagePath;
    }

    // MARK: ...commit
    /**
     * Commit a file to git-storage.
     *
     * @param filePath - Absolute path to file
     * @param options - Optional message, metadata, and repoId
     * @returns TaraGitSTLink with all retrieval information
     */
    async commit(filePath: string, options?: {
        message?: string;
        metadata?: Record<string, unknown>;
        repoId?: string;
    }): Promise<TaraGitSTLink> {
        const links = await this.commitBatch([filePath], options);
        return links[0];
    }


    // MARK: ...commitBatch
    /**
     * Commit multiple files to git-storage in a single operation.
     * Handles files from different directories/repos by creating separate commits per repo.
     *
     * @param filePaths - Array of absolute paths to files
     * @param options - Optional message, metadata, and repoId (applied to all files)
     * @returns Array of TaraGitSTLink objects
     */
    async commitBatch(filePaths: string[], options?: {
        message?: string;
        metadata?: Record<string, unknown>;
        repoId?: string;
    }): Promise<TaraGitSTLink[]> {
        if (!Array.isArray(filePaths) || filePaths.length === 0) {
            throw new Error('filePaths must be a non-empty array');
        }

        // Validate all paths first
        const absolutePaths: string[] = [];
        for (const filePath of filePaths) {
            const absolutePath = path.resolve(filePath);
            if (absolutePath !== filePath) {
                throw new Error(`Path must be absolute: ${filePath}`);
            }
            if (!fs.existsSync(filePath)) {
                throw new Error(`File not found: ${filePath}`);
            }
            absolutePaths.push(absolutePath);
        }

        // Get repo groups - either explicit repoId or auto-assignment
        let repoGroups: Map<string, GitStAssignmentLink[]>;

        if (options?.repoId) {
            // Explicit repoId: all files go to that repo, no assignmentKey
            const links = absolutePaths.map(filePath => ({
                repoId: options.repoId!,
                repoPath: this.getRepoPath(options.repoId!),
                filePath,
            }));
            repoGroups = new Map([[options.repoId, links]]);
        } else {
            // Auto-assignment: resolve and group by repo
            repoGroups = await this.assignment.resolveAssignmentBatch(absolutePaths);
        }

        // Process each repo group
        const allLinks: TaraGitSTLink[] = [];

        for (const [repoId, assignments] of repoGroups) {
            const links = await this.commitToRepo(repoId, assignments, options);
            allLinks.push(...links);
        }

        return allLinks;
    }

    // MARK: ...commitToRepo
    /**
     * Commit files to a specific repo.
     * @private
     */
    private async commitToRepo(
        repoId: string,
        assignments: GitStAssignmentLink[],
        options?: {
            message?: string;
            metadata?: Record<string, unknown>;
        }
    ): Promise<TaraGitSTLink[]> {
        // Ensure initialized
        this.instantiate(repoId);

        const timestamp = new Date().toISOString();
        const commitMessage = options?.message ||
            (assignments.length === 1
                ? `gitst: ${path.basename(assignments[0].filePath)}`
                : `gitst: batch commit (${assignments.length} files)`);

        // Process all files
        const fileData: Array<{
            assignment: GitStAssignmentLink;
            storagePath: string;
            contentHash: string;
        }> = [];

        for (const assignment of assignments) {
            const contentHash = this.calculateFileHash(assignment.filePath);
            const storagePath = this.copyFileToStorage(assignment.filePath, repoId);
            fileData.push({ assignment, storagePath, contentHash });
        }

        // Create links and records for all files
        const links: TaraGitSTLink[] = [];
        const records: RecordHandler[] = [];
        const storagePaths: string[] = [];

        for (const { assignment, storagePath, contentHash } of fileData) {
            const linkData: Omit<TaraGitSTLink, 'recordId' | 'recordHash' | 'commitHash' | 'commitCount'> = {
                repoId,
                repoPath: this.getRepoPath(repoId),
                originalPath: assignment.filePath,
                storagePath,
                contentHash,
                timestamp,
                message: commitMessage,
                ...(assignment.assignmentKey ? { assignmentKey: assignment.assignmentKey } : {}),
            };

            // Create tape record
            const record = new RecordHandler({
                type: 'taralib/git-storage-commit',
                link: linkData,
                metadata: options?.metadata,
            });

            records.push(record);
            storagePaths.push(storagePath);

            // Build partial link (commit info filled after git commit)
            links.push({
                ...linkData,
                commitHash: '',
                commitCount: 0,
                recordId: record.getId(),
                recordHash: record.__tararecord?.contentHash,
            });
        }

        // Append all records to internal tape
        const tape = this.getTape(repoId);
        tape.appendRecordBatch(records);

        // Stage all data files + tape file
        const handler = this.getGitHandler(repoId);
        const allPaths = [...storagePaths, TAPE_FILENAME];
        for (const p of allPaths) {
            handler.execCmdSync(`add "${p.replace(/"/g, '\\"')}"`);
        }

        // Single commit
        handler.execCmdSync(`commit -m "${commitMessage.replace(/"/g, '\\"')}"`);

        // Get commit info
        const commitHash = handler.execCmdSync('rev-parse HEAD');
        const commitCount = this.getCommitCount(repoId);

        // Fill commit info into links
        for (const link of links) {
            link.commitHash = commitHash;
            link.commitCount = commitCount;
        }

        return links;
    }

    // MARK: ...commitFromRepo
    /**
     * Commit all non-ignored files from an external git repository.
     * Uses `git ls-files` to get the list of tracked/non-ignored files.
     *
     * @param externalRepoPath - Path to external git repository
     * @param options - Optional message, metadata, repoId, and filters
     * @returns Array of TaraGitSTLink objects
     */
    async commitFromRepo(externalRepoPath: string, options?: {
        message?: string;
        metadata?: Record<string, unknown>;
        repoId?: string;
        maxFileSizeBytes?: number;
    }): Promise<TaraGitSTLink[]> {
        // Validate repo exists
        const repoAbsPath = path.resolve(externalRepoPath);
        if (!fs.existsSync(repoAbsPath)) {
            throw new Error(`Path does not exist: ${externalRepoPath}`);
        }

        // Check it's a git repo
        if (!fs.existsSync(path.join(repoAbsPath, '.git'))) {
            throw new Error(`Not a git repository: ${externalRepoPath}`);
        }

        // Get tracked files using git ls-files
        let output: string;
        try {
            output = execSync('git ls-files', {
                cwd: repoAbsPath,
                encoding: 'utf-8',
                stdio: ['pipe', 'pipe', 'pipe']
            });
        } catch (error: any) {
            const message = error.stderr ? error.stderr.toString().trim() : error.message;
            throw new Error(`Failed to list files: ${message}`);
        }

        const relativePaths = output.trim().split('\n').filter(Boolean);

        if (relativePaths.length === 0) {
            return [];
        }

        // Convert to absolute paths and filter
        const filteredPaths = relativePaths
            .map(rel => path.join(repoAbsPath, rel))
            .filter(absPath => {
                if (!fs.existsSync(absPath)) return false;

                const stats = fs.statSync(absPath);
                if (!stats.isFile()) return false;

                if (options?.maxFileSizeBytes !== undefined) {
                    return stats.size <= options.maxFileSizeBytes;
                }

                return true;
            });

        if (filteredPaths.length === 0) {
            return [];
        }

        // Use existing commitBatch
        return await this.commitBatch(filteredPaths, {
            message: options?.message || `gitst: from repo ${path.basename(repoAbsPath)}`,
            metadata: {
                ...options?.metadata,
                sourceRepo: repoAbsPath
            },
            repoId: options?.repoId
        });
    }


    // --. -. - .- -. -.-.- . .-. - -- -- - -. . - .--.
    // MARK: Utils
    // --. -. - .- -. -.-.- . .-. - -- -- - -. . - .--.

    // MARK: ...calculateFileHash
    /**
     * Calculate SHA-256 hash of file content.
     * @private
     */
    private calculateFileHash(filePath: string): string {
        const fileBuffer = fs.readFileSync(filePath);
        const hashSum = crypto.createHash('sha256');
        hashSum.update(fileBuffer);
        return hashSum.digest('hex');
    }

    // MARK: ...getPath
    /**     
     * Get git-storage home path.
     *
     * @returns Absolute path to ~/.taraproject/git-storage/
     */
    getPath(...subfolders: string[]): string {
        return this.context.global.home.getGitStoragePath(...subfolders);
    }

    // MARK: ...getRepoPath
    /**
     * Get path for a specific repo.
     *
     * @param repoId - Repository identifier
     * @returns Absolute path to ~/.taraproject/git-storage/<repoId>
     */
    getRepoPath(repoId: string): string {
        return this.getPath(repoId);
    }

    // MARK: ...getGitHandler
    /**
     * Get or create a GitHandler for a repo.
     * @private
     */
    private getGitHandler(repoId: string): GitHandler {
        let handler = this.gitHandlers.get(repoId);
        if (!handler) {
            const repoPath = this.getRepoPath(repoId);
            handler = new GitHandler(repoPath);
            this.gitHandlers.set(repoId, handler);
        }
        return handler;
    }


    // MARK: ...getCommitCount
    /**
     * Get the commit count for a repo.
     * @private
     */
    private getCommitCount(repoId: string): number {
        const output = this.getGitHandler(repoId).execCmdSync('rev-list --count HEAD');
        return parseInt(output, 10);
    }

    // MARK: ...getTape
    /**
     * Get or create a TapeHandler for a repo.
     * @private
     */
    private getTape(repoId: string): TapeHandler {
        let tape = this.tapes.get(repoId);
        if (!tape) {
            const tapePath = this.tapePath(repoId);
            const writer = this.context.settings.getSetting('writer');
            tape = new TapeHandler(repoId, tapePath, { writer });
            this.tapes.set(repoId, tape);
        }
        return tape;
    }

    // MARK: ...tapePath
    /**
     * Get the path to the internal tape for a repo.
     * @private
     */
    private tapePath(repoId: string): string {
        return path.join(this.getRepoPath(repoId), TAPE_FILENAME);
    }

    // MARK: ...exists
    /**
     * Check if a git-storage repo is initialized.
     *
     * @param repoId - Repository identifier (defaults to DEFAULT_REPO_ID)
     * @returns true if git repo exists, false otherwise
     */
    exists(repoId: string): boolean {
        return this.getGitHandler(repoId).exists();
    }
}
