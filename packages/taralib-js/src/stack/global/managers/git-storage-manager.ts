import { execSync } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import type { TaraStack } from '../../tara-stack';
import { RecordHandler } from '../../../base/record-handler';
import { YYYYMM_prefix } from '../../../base/utils';

const GIT_STORAGE_DIR = 'git-storage';
const GIT_STORAGE_TAPE_BASE = 'git-storage-commits';
const DEFAULT_REPO_ID = 'default';

export interface TaraGitSTLink {
    repoId: string;
    repoPath: string;
    commitHash: string;
    commitHashShort: string;
    originalPath: string;
    storagePath: string;
    contentHash: string;
    recordId: string;
    recordHash?: string;
    timestamp: string;
    message?: string;
}

/**
 * GitStorageManager provides git-based file capture and commit functionality.
 * Accessible via tara.global.gitst
 *
 * Bootstrap pattern: Constructor only stores context, no logic.
 */
export class GitStorageManager {
    constructor(private context: TaraStack) {
        // Bootstrap pattern: no logic in constructor
    }

    /**
     * Get git-storage base directory path.
     *
     * @returns Absolute path to ~/.taraproject/git-storage
     */
    getPath(): string {
        return this.context.global.home.getSubPath(GIT_STORAGE_DIR);
    }

    /**
     * Get path for a specific repo.
     *
     * @param repoId - Repository identifier (defaults to DEFAULT_REPO_ID)
     * @returns Absolute path to ~/.taraproject/git-storage/<repoId>
     */
    getRepoPath(repoId?: string): string {
        return path.join(this.getPath(), repoId || DEFAULT_REPO_ID);
    }

    /**
     * Get the dynamic tape ID with YYYYMM prefix.
     * @private
     */
    private getTapeIdInternal(): string {
        return YYYYMM_prefix(GIT_STORAGE_TAPE_BASE);
    }

    /**
     * Execute git command in storage repo.
     * @private
     */
    private execGit(command: string, repoId?: string): string {
        try {
            const result = execSync(`git ${command}`, {
                cwd: this.getRepoPath(repoId),
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
     * Initialize git-storage system for a specific repo.
     * - Creates repo directory
     * - Initializes git repo
     * - Creates tape
     * Idempotent operation.
     *
     * @param repoId - Repository identifier (defaults to DEFAULT_REPO_ID)
     */
    instantiate(repoId?: string): void {
        const repoPath = this.getRepoPath(repoId);

        // Create repo directory
        if (!fs.existsSync(repoPath)) {
            fs.mkdirSync(repoPath, { recursive: true });
        }

        // Initialize git repo
        const gitDir = path.join(repoPath, '.git');
        if (!fs.existsSync(gitDir)) {
            this.execGit('init', repoId);
        }

        // Ensure tape exists
        const tape = this.context.global.tapes.get(this.getTapeIdInternal());
        tape.instantiate();
    }

    /**
     * Check if a git-storage repo is initialized.
     *
     * @param repoId - Repository identifier (defaults to DEFAULT_REPO_ID)
     * @returns true if git repo exists, false otherwise
     */
    exists(repoId?: string): boolean {
        const gitDir = path.join(this.getRepoPath(repoId), '.git');
        return fs.existsSync(gitDir);
    }

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

    /**
     * Copy file to storage location.
     * @private
     */
    private copyFileToStorage(originalPath: string, repoId?: string): string {
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

    /**
     * Commit a file to git-storage.
     *
     * @param filePath - Absolute path to file
     * @param options - Optional message, metadata, and repoId
     * @returns TaraGitSTLink with all retrieval information
     */
    commit(filePath: string, options?: {
        message?: string;
        metadata?: Record<string, unknown>;
        repoId?: string;
    }): TaraGitSTLink {
        // Validate absolute path first
        const absolutePath = path.resolve(filePath);
        if (absolutePath !== filePath) {
            throw new Error(`Path must be absolute: ${filePath}`);
        }

        // Then validate file exists
        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }

        const repoId = options?.repoId || DEFAULT_REPO_ID;

        // Ensure initialized
        this.instantiate(repoId);

        // Calculate content hash before copying
        const contentHash = this.calculateFileHash(absolutePath);

        // Copy file to storage
        const storagePath = this.copyFileToStorage(absolutePath, repoId);

        // Stage file
        this.execGit(`add "${storagePath.replace(/"/g, '\\"')}"`, repoId);

        // Commit
        const commitMessage = options?.message || `gitst: ${path.basename(absolutePath)}`;
        this.execGit(`commit -m "${commitMessage.replace(/"/g, '\\"')}"`, repoId);

        // Get commit hashes
        const commitHash = this.execGit('rev-parse HEAD', repoId);
        const commitHashShort = this.execGit('rev-parse --short HEAD', repoId);

        // Create link data
        const linkData: Omit<TaraGitSTLink, 'recordId' | 'recordHash'> = {
            repoId,
            repoPath: this.getRepoPath(repoId),
            commitHash,
            commitHashShort,
            originalPath: absolutePath,
            storagePath,
            contentHash,
            timestamp: new Date().toISOString(),
            message: commitMessage,
        };

        // Create tape record
        const record = new RecordHandler({
            type: 'taralib/git-storage-commit',
            link: linkData,
            metadata: options?.metadata,
        });

        // Append to tape
        const tape = this.context.global.tapes.get(this.getTapeIdInternal());
        tape.appendRecord(record);

        // Build complete link
        const link: TaraGitSTLink = {
            ...linkData,
            recordId: record.getId(),
            recordHash: record.__tararecord.contentHash,
        };

        return link;
    }

    /**
     * Commit multiple files to git-storage in a single operation.
     *
     * @param filePaths - Array of absolute paths to files
     * @param options - Optional message, metadata, and repoId (applied to all files)
     * @returns Array of TaraGitSTLink objects
     */
    commitBatch(filePaths: string[], options?: {
        message?: string;
        metadata?: Record<string, unknown>;
        repoId?: string;
    }): TaraGitSTLink[] {
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

        const repoId = options?.repoId || DEFAULT_REPO_ID;

        // Ensure initialized
        this.instantiate(repoId);

        // Process all files
        const fileData: Array<{
            absolutePath: string;
            storagePath: string;
            contentHash: string;
        }> = [];

        for (const absolutePath of absolutePaths) {
            const contentHash = this.calculateFileHash(absolutePath);
            const storagePath = this.copyFileToStorage(absolutePath, repoId);
            fileData.push({ absolutePath, storagePath, contentHash });
        }

        // Stage all files
        const stagePaths = fileData.map(f => f.storagePath);
        for (const storagePath of stagePaths) {
            this.execGit(`add "${storagePath.replace(/"/g, '\\"')}"`, repoId);
        }

        // Single commit for all files
        const commitMessage = options?.message ||
            `gitst: batch commit (${filePaths.length} files)`;
        this.execGit(`commit -m "${commitMessage.replace(/"/g, '\\"')}"`, repoId);

        // Get commit hashes (same for all files in batch)
        const commitHash = this.execGit('rev-parse HEAD', repoId);
        const commitHashShort = this.execGit('rev-parse --short HEAD', repoId);
        const timestamp = new Date().toISOString();

        // Create links and records for all files
        const links: TaraGitSTLink[] = [];
        const records: RecordHandler[] = [];

        for (const { absolutePath, storagePath, contentHash } of fileData) {
            const linkData: Omit<TaraGitSTLink, 'recordId' | 'recordHash'> = {
                repoId,
                repoPath: this.getRepoPath(repoId),
                commitHash,
                commitHashShort,
                originalPath: absolutePath,
                storagePath,
                contentHash,
                timestamp,
                message: commitMessage,
            };

            // Create tape record
            const record = new RecordHandler({
                type: 'taralib/git-storage-commit',
                link: linkData,
                metadata: options?.metadata,
            });

            records.push(record);

            // Build complete link
            const link: TaraGitSTLink = {
                ...linkData,
                recordId: record.getId(),
                recordHash: record.__tararecord.contentHash,
            };

            links.push(link);
        }

        // Append all records to tape in batch
        const tape = this.context.global.tapes.get(this.getTapeIdInternal());
        tape.appendRecordBatch(records);

        return links;
    }

    /**
     * Get tape ID for git-storage commits.
     *
     * @returns The tape ID used for git-storage records (includes YYYYMM prefix)
     */
    getTapeId(): string {
        return this.getTapeIdInternal();
    }

    /**
     * Commit all non-ignored files from an external git repository.
     * Uses `git ls-files` to get the list of tracked/non-ignored files.
     *
     * @param externalRepoPath - Path to external git repository
     * @param options - Optional message, metadata, repoId, and filters
     * @returns Array of TaraGitSTLink objects
     */
    commitFromRepo(externalRepoPath: string, options?: {
        message?: string;
        metadata?: Record<string, unknown>;
        repoId?: string;
        maxFileSizeBytes?: number;
    }): TaraGitSTLink[] {
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
        const filePaths = relativePaths
            .map(rel => path.join(repoAbsPath, rel))
            .filter(absPath => {
                // Check file exists (might have been deleted but still tracked)
                if (!fs.existsSync(absPath)) return false;

                // Check file is not a directory (submodules can appear in ls-files)
                const stats = fs.statSync(absPath);
                if (!stats.isFile()) return false;

                // Filter by max file size if specified
                if (options?.maxFileSizeBytes !== undefined) {
                    return stats.size <= options.maxFileSizeBytes;
                }

                return true;
            });

        if (filePaths.length === 0) {
            return [];
        }

        // Use existing commitBatch
        return this.commitBatch(filePaths, {
            message: options?.message || `gitst: from repo ${path.basename(repoAbsPath)}`,
            metadata: {
                ...options?.metadata,
                sourceRepo: repoAbsPath
            },
            repoId: options?.repoId
        });
    }
}
