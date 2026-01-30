import { execSync } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { GitHandler } from '../../../base/git-handler';
import { RecordHandler } from '../../../base/record-handler';
import { TapeHandler } from '../../../base/tape-handler';
import { YYYYMM_prefix } from '../../../base/utils';
import type { TaraStack } from '../../tara-stack';
import { GitStResolver, type DescriptorPair, type ResolveResult } from './git-st-resolver';

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
}

export interface GitStCommitOptions {
    message?: string;
    metadata?: Record<string, unknown>;
    descriptors?: DescriptorPair[];
}

/**
 * GitStorageManager provides git-based file capture and commit functionality.
 * Self-contained: manages its own internal tape (commits.tara.jsonl) inside each git-storage repo.
 * Accessible via tara.global.gitst
 *
 * Bootstrap pattern: Constructor only stores context, no logic.
 */
export class GitStorageManager {
    private gitHandlers: Map<string, GitHandler> = new Map();
    private resolver: GitStResolver;

    constructor(private context: TaraStack) {
        this.resolver = new GitStResolver(context);
    }

    // --. -. - .- -. -.-.- . .-. - -- -- - -. . - .--.
    // MARK: Commit Workflows
    // --. -. - .- -. -.-.- . .-. - -- -- - -. . - .--.


    // MARK: ...instantiate
    /**
     * Initialize git-storage system for a specific repo.
     * - Creates repo directory
     * - Initializes git repo
     * - Creates tapes directory and current month's tape
     * - Creates bootstrap commit if no commits exist
     * Idempotent operation.
     *
     * @param repoId - Repository identifier (defaults to DEFAULT_REPO_ID)
     */
    instantiate(repoId: string): void {
        const handler = this.getGitHandler(repoId);

        // GitHandler handles directory creation + git init (idempotent)
        handler.instanciate();

        // Ensure tapes directory exists
        const tapesDir = this.getTapesDir(repoId);
        if (!fs.existsSync(tapesDir)) {
            fs.mkdirSync(tapesDir, { recursive: true });
        }

        // Ensure current month's tape exists
        this.getRepoTape(repoId).instantiate();

        // If no commits yet, do an initial commit with the tape
        try {
            handler.execCmdSync('rev-parse HEAD');
        } catch {
            handler.execCmdSync(`add tapes/${this.buildCurrentTapeName(repoId)}`);
            handler.execCmdSync('commit -m "init: bootstrap tape"');
        }
    }

    // MARK: ...copyFileToStoragePath
    /**
     * Copy file to a specific storage path.
     * @private
     */
    private copyFileToStoragePath(
        originalPath: string,
        repoId: string,
        storagePath: string
    ): void {
        const fullStoragePath = path.join(this.builtRepoPath(repoId), storagePath);
        const storageDir = path.dirname(fullStoragePath);

        // Create parent directory
        if (!fs.existsSync(storageDir)) {
            fs.mkdirSync(storageDir, { recursive: true });
        }

        // Copy file
        fs.copyFileSync(originalPath, fullStoragePath);
    }

    // MARK: ...commit
    /**
     * Commit a file to git-storage.
     *
     * @param filePath - Absolute path to file (also used as originPath for resolution)
     * @param options - Optional message, metadata, and descriptors
     * @returns TaraGitSTLink with all retrieval information
     */
    async commitFile(filePath: string, options?: GitStCommitOptions): Promise<TaraGitSTLink> {
        const links = await this.commitBatch([filePath], options);
        return links[0];
    }


    // MARK: ...commitBatch
    /**
     * Commit multiple files to git-storage in a single operation.
     * Each file is resolved independently using its path as originPath.
     *
     * @param filePaths - Array of absolute paths to files
     * @param options - Optional message, metadata, and descriptors (applied to all files)
     * @returns Array of TaraGitSTLink objects
     */
    async commitBatch(filePaths: string[], options?: GitStCommitOptions): Promise<TaraGitSTLink[]> {
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

        // Resolve each file and group by repoId
        type ResolveResultWithDescriptors = ResolveResult & { fullDescriptors: DescriptorPair[] };
        const repoGroups = new Map<string, Array<{ filePath: string; resolution: ResolveResultWithDescriptors }>>();

        for (const filePath of absolutePaths) {
            const resolution = await this.resolver.resolve({
                originPath: filePath,
                descriptors: options?.descriptors,
            });

            const group = repoGroups.get(resolution.repoId) || [];
            group.push({ filePath, resolution });
            repoGroups.set(resolution.repoId, group);
        }

        // Process each repo group
        const allLinks: TaraGitSTLink[] = [];

        for (const [repoId, files] of repoGroups) {
            const links = await this.commitToRepo(repoId, files, options);
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
        files: Array<{ filePath: string; resolution: ResolveResult & { fullDescriptors: DescriptorPair[] } }>,
        options?: GitStCommitOptions
    ): Promise<TaraGitSTLink[]> {
        // Ensure initialized
        this.instantiate(repoId);

        const timestamp = new Date().toISOString();
        const commitMessage = options?.message ||
            (files.length === 1
                ? `gitst: ${path.basename(files[0].filePath)}`
                : `gitst: batch commit (${files.length} files)`);

        // Write descriptor records for new resolutions (after repo is instantiated)
        for (const { resolution } of files) {
            if (resolution.isNew) {
                await this.resolver.writeDescriptorRecord({
                    descriptors: resolution.fullDescriptors,
                    storagePath: resolution.storagePath,
                    repoId,
                    timestamp,
                });
            }
        }

        // Process all files
        const fileData: Array<{
            filePath: string;
            resolution: ResolveResult;
            contentHash: string;
        }> = [];

        for (const { filePath, resolution } of files) {
            const contentHash = this.calculateFileHash(filePath);
            this.copyFileToStoragePath(filePath, repoId, resolution.storagePath);
            fileData.push({ filePath, resolution, contentHash });
        }

        // Create links and records for all files
        const links: TaraGitSTLink[] = [];
        const records: RecordHandler[] = [];
        const storagePaths: string[] = [];

        for (const { filePath, resolution, contentHash } of fileData) {
            const linkData: Omit<TaraGitSTLink, 'recordId' | 'recordHash' | 'commitHash' | 'commitCount'> = {
                repoId,
                repoPath: this.builtRepoPath(repoId),
                originalPath: filePath,
                storagePath: resolution.storagePath,
                contentHash,
                timestamp,
                message: commitMessage,
            };

            // Create tape record
            const record = new RecordHandler({
                content: {
                    type: 'taralib/git-storage-commit',
                    link: linkData,
                    metadata: options?.metadata,
                }
            });

            records.push(record);
            storagePaths.push(resolution.storagePath);

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
        const tape = this.getRepoTape(repoId);
        tape.appendRecordBatch(records);

        // Stage all data files + tape file + descriptor tape
        const handler = this.getGitHandler(repoId);
        const tapePath = `tapes/${this.buildCurrentTapeName(repoId)}`;
        const descriptorTapePath = `descriptors/${this.buildCurrentTapeName(repoId)}`;
        const allPaths = [...storagePaths, tapePath, descriptorTapePath];
        for (const p of allPaths) {
            const fullPath = path.join(this.builtRepoPath(repoId), p);
            if (fs.existsSync(fullPath)) {
                handler.execCmdSync(`add "${p.replace(/"/g, '\\"')}"`);
            }
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
     * @param options - Optional message, metadata, descriptors, and filters
     * @returns Array of TaraGitSTLink objects
     */
    async commitFromRepo(externalRepoPath: string, options?: {
        message?: string;
        metadata?: Record<string, unknown>;
        descriptors?: DescriptorPair[];
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
            descriptors: options?.descriptors
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
    builtRepoPath(repoId: string): string {
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
            const repoPath = this.builtRepoPath(repoId);
            const silent = this.context.settings.getSetting('git.silent', true);
            handler = new GitHandler({ repoPath, options: { silent } });
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

    // MARK: ...buildCurrentTapeName
    /**
     * Build the current month's tape filename.
     * @private
     */
    private buildCurrentTapeName(repoId: string): string {
        return `${YYYYMM_prefix(repoId)}.tara.jsonl`;
    }

    // MARK: ...getTapesDir
    /**
     * Get the tapes directory for a repo.
     * @private
     */
    private getTapesDir(repoId: string): string {
        return path.join(this.builtRepoPath(repoId), 'tapes');
    }

    // MARK: ...getTape
    /**
     * Get a TapeHandler for a repo.
     * @param repoId - Repository identifier
     * @param tapeFile - Optional specific tape filename (for reading historical tapes)
     */
    public getRepoTape(repoId: string, tapeFile?: string): TapeHandler {
        const tapesDir = this.getTapesDir(repoId);
        // Ensure tapes directory exists
        if (!fs.existsSync(tapesDir)) {
            fs.mkdirSync(tapesDir, { recursive: true });
        }
        const tapePath = tapeFile
            ? path.join(tapesDir, tapeFile)
            : this.tapePath(repoId);
        const writer = this.context.settings.getSetting('writer');
        return new TapeHandler({
            tapeId: repoId,
            tapePath,
            options: { writer }
        });
    }

    // MARK: ...tapePath
    /**
     * Get the path to the current month's tape for a repo.
     * @private
     */
    private tapePath(repoId: string): string {
        return path.join(this.getTapesDir(repoId), this.buildCurrentTapeName(repoId));
    }

    // MARK: ...listTapeFiles
    /**
     * List all tape files for a repo.
     * Returns filenames sorted chronologically (YYYYMM prefix ensures this).
     *
     * @param repoId - Repository identifier
     * @returns Array of tape filenames (e.g., ['202512-repo.tara.jsonl', '202601-repo.tara.jsonl'])
     */
    listTapeFiles(repoId: string): string[] {
        const tapesDir = this.getTapesDir(repoId);
        if (!fs.existsSync(tapesDir)) return [];

        return fs.readdirSync(tapesDir)
            .filter(f => f.endsWith('.tara.jsonl'))
            .sort();
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
