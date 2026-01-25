import { execSync } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import type { TaraStack } from '../../tara-stack';
import { RecordHandler } from '../../../base/record-handler';
import { YYYYMM_prefix } from '../../../base/utils';

const GIT_STORAGE_DIR = 'git-storage';
const GIT_STORAGE_TAPE_BASE = 'git-storage-commits';

export interface TaraGitSTLink {
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
     * Get git-storage directory path.
     *
     * @returns Absolute path to ~/.taraproject/git-storage
     */
    getPath(): string {
        return this.context.global.home.getSubPath(GIT_STORAGE_DIR);
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
    private execGit(command: string): string {
        try {
            const result = execSync(`git ${command}`, {
                cwd: this.getPath(),
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
     * Initialize git-storage system.
     * - Creates directory
     * - Initializes git repo
     * - Creates tape
     * Idempotent operation.
     */
    instantiate(): void {
        const storagePath = this.getPath();

        // Create directory
        if (!fs.existsSync(storagePath)) {
            fs.mkdirSync(storagePath, { recursive: true });
        }

        // Initialize git repo
        const gitDir = path.join(storagePath, '.git');
        if (!fs.existsSync(gitDir)) {
            this.execGit('init');
        }

        // Ensure tape exists
        const tape = this.context.global.tapes.get(this.getTapeIdInternal());
        tape.instantiate();
    }

    /**
     * Check if git-storage is initialized.
     *
     * @returns true if git repo exists, false otherwise
     */
    exists(): boolean {
        const gitDir = path.join(this.getPath(), '.git');
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
    private copyFileToStorage(originalPath: string): string {
        const storagePath = this.mapPathToStorage(originalPath);
        const fullStoragePath = path.join(this.getPath(), storagePath);
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
     * @param options - Optional message and metadata
     * @returns TaraGitSTLink with all retrieval information
     */
    commit(filePath: string, options?: {
        message?: string;
        metadata?: Record<string, unknown>;
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

        // Ensure initialized
        this.instantiate();

        // Calculate content hash before copying
        const contentHash = this.calculateFileHash(absolutePath);

        // Copy file to storage
        const storagePath = this.copyFileToStorage(absolutePath);

        // Stage file
        this.execGit(`add "${storagePath.replace(/"/g, '\\"')}"`);

        // Commit
        const commitMessage = options?.message || `gitst: ${path.basename(absolutePath)}`;
        this.execGit(`commit -m "${commitMessage.replace(/"/g, '\\"')}"`);

        // Get commit hashes
        const commitHash = this.execGit('rev-parse HEAD');
        const commitHashShort = this.execGit('rev-parse --short HEAD');

        // Create link data
        const linkData: Omit<TaraGitSTLink, 'recordId' | 'recordHash'> = {
            repoPath: this.getPath(),
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
     * @param options - Optional message and metadata (applied to all files)
     * @returns Array of TaraGitSTLink objects
     */
    commitBatch(filePaths: string[], options?: {
        message?: string;
        metadata?: Record<string, unknown>;
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

        // Ensure initialized
        this.instantiate();

        // Process all files
        const fileData: Array<{
            absolutePath: string;
            storagePath: string;
            contentHash: string;
        }> = [];

        for (const absolutePath of absolutePaths) {
            const contentHash = this.calculateFileHash(absolutePath);
            const storagePath = this.copyFileToStorage(absolutePath);
            fileData.push({ absolutePath, storagePath, contentHash });
        }

        // Stage all files
        const stagePaths = fileData.map(f => f.storagePath);
        for (const storagePath of stagePaths) {
            this.execGit(`add "${storagePath.replace(/"/g, '\\"')}"`);
        }

        // Single commit for all files
        const commitMessage = options?.message ||
            `gitst: batch commit (${filePaths.length} files)`;
        this.execGit(`commit -m "${commitMessage.replace(/"/g, '\\"')}"`);

        // Get commit hashes (same for all files in batch)
        const commitHash = this.execGit('rev-parse HEAD');
        const commitHashShort = this.execGit('rev-parse --short HEAD');
        const timestamp = new Date().toISOString();

        // Create links and records for all files
        const links: TaraGitSTLink[] = [];
        const records: RecordHandler[] = [];

        for (const { absolutePath, storagePath, contentHash } of fileData) {
            const linkData: Omit<TaraGitSTLink, 'recordId' | 'recordHash'> = {
                repoPath: this.getPath(),
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
}
