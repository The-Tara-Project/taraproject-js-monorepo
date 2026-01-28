import { execSync } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { RecordHandler } from '../../../base/record-handler';
import { GTapeHandler } from '../../../base/tape-handler';
import type { TaraStack } from '../../tara-stack';

const TAPE_FILENAME = 'commits.tara.jsonl';
const REPO_COMMIT_CAP = 1000;
const REPO_CACHE_MAX = 100;

// ISSUES
// ## commitBatch() silently assumes all files belong to the same assignmentKey
// - make the key assignment process per file basis
// - but keep a single final commit for all files

export interface TaraGitSTLink {
    repoId: string;
    repoPath: string;
    commitHash: string;
    commitHashShort: string; // delete this, redundant...
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
    private tapes: Map<string, GTapeHandler> = new Map();
    private repoCache: Map<string, string> = new Map();
    private validatedRepoPaths: Set<string> = new Set();

    constructor(private context: TaraStack) {
        // Bootstrap pattern: no logic in constructor
    }

    /**
     * Derive the assignment key for a file path.
     * Walks up from dirname(filePath) looking for .git; if found, returns the repo root.
     * Otherwise returns dirname(filePath).
     */
    private deriveKey(filePath: string): string {
        const absolutePath = path.resolve(filePath);
        let dir = path.dirname(absolutePath);
        while (true) {
            if (fs.existsSync(path.join(dir, '.git'))) {
                return dir;
            }
            const parent = path.dirname(dir);
            if (parent === dir) break;
            dir = parent;
        }
        return path.dirname(absolutePath);
    }

    /**
     * List existing repo IDs in git-storage home directory.
     */
    private listRepoIds(): string[] {
        const homePath = this.context.global.home.getGitStoragePath();
        if (!fs.existsSync(homePath)) return [];
        return fs.readdirSync(homePath).filter(name => {
            const full = path.join(homePath, name);
            return fs.statSync(full).isDirectory() && fs.existsSync(this.context.global.home.getGitStoragePath(name, '.git'));
        });
    }

    /**
     * Scan all existing repo tapes looking for a record with matching assignmentKey.
     * Returns repoId if found, null otherwise.
     */
    private scanTapesForKey(key: string): string | null {
        const repoIds = this.listRepoIds();
        for (const repoId of repoIds) {
            const tapePath = this.tapePath(repoId);
            if (!fs.existsSync(tapePath)) continue;
            const content = fs.readFileSync(tapePath, 'utf-8');
            const lines = content.split('\n');
            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const parsed = JSON.parse(line);
                    if (parsed?.link?.assignmentKey === key) {
                        return repoId;
                    }
                } catch {
                    // skip unparseable lines
                }
            }
        }
        return null;
    }

    /**
     * Assign a new repo using round-robin: pick repo with fewest commits.
     * If all repos >= REPO_COMMIT_CAP, create a new repo-N.
     */
    private async assignNewRepo(): Promise<string> {
        const repoIds = this.listRepoIds()

        let minCount = Infinity;
        let minRepo = '';
        for (const repoId of repoIds) {
            const tapePath = path.join(this.getRepoPath(repoId), TAPE_FILENAME);

            let count = 0;
            if (fs.existsSync(tapePath)) {
                const tapeHandler = this.getTape(repoId);
                count = await tapeHandler.countLines();
            }
            if (count < minCount) {
                minCount = count;
                minRepo = repoId;
            }
        }

        if (minCount >= REPO_COMMIT_CAP) {
            // All full — create next repo-N
            return crypto.randomUUID().toString();
        }

        return minRepo;
    }

    /**
     * Set a value in the repo cache with LRU eviction.
     */
    private cacheSet(key: string, repoId: string): void {
        if (this.repoCache.size >= REPO_CACHE_MAX) {
            // Evict oldest (first inserted)
            const firstKey = this.repoCache.keys().next().value;
            if (firstKey !== undefined) {
                this.repoCache.delete(firstKey);
            }
        }
        this.repoCache.set(key, repoId);
    }

    /**
     * Resolve a repoId for a file path using auto-assignment.
     */
    private async resolveRepoId(filePath: string): Promise<string> {
        const key = this.deriveKey(filePath);

        // Check cache
        const cached = this.repoCache.get(key);
        if (cached) return cached;

        // Scan tapes
        const found = this.scanTapesForKey(key);
        if (found) {
            this.cacheSet(key, found);
            return found;
        }

        // Assign new
        const repoId = await this.assignNewRepo();
        this.cacheSet(key, repoId);
        return repoId;
    }


    /**     
     * Get git-storage home path.
     *
     * @returns Absolute path to ~/.taraproject/git-storage/
     */
    getPath(...subfolders: string[]): string {
        return this.context.global.home.getGitStoragePath(...subfolders);
    }

    /**
     * Get path for a specific repo.
     *
     * @param repoId - Repository identifier
     * @returns Absolute path to ~/.taraproject/git-storage/<repoId>
     */
    getRepoPath(repoId: string): string {
        return this.getPath(repoId);
    }

    /**
     * Execute git command in storage repo.
     * @private
     */
    private execGit(command: string, repoId: string): string {
        const repoPath = this.getRepoPath(repoId);

        if (!this.validatedRepoPaths.has(repoPath)) {
            try {
                const check = execSync('git rev-parse --is-inside-work-tree', {
                    cwd: repoPath,
                    encoding: 'utf-8',
                    stdio: ['pipe', 'pipe', 'pipe']
                });
                if (check.trim() === 'true') {
                    this.validatedRepoPaths.add(repoPath);
                }
            } catch {
                // Not a git repo yet (e.g. before git init) — skip validation
            }
        }

        try {
            const result = execSync(`git ${command}`, {
                cwd: repoPath,
                encoding: 'utf-8',
                stdio: ['pipe', 'pipe', 'pipe']
            });
            return result.trim();
        } catch (error: any) {
            const message = error.stderr ? error.stderr.toString().trim() : error.message;
            throw new Error(`Git command failed: ${message}`);
        }
    }

    tapePath(repoId: string): string {
        return path.join(this.getRepoPath(repoId), TAPE_FILENAME);
    }

    /**
     * Get or create a GTapeHandler for a repo.
     * @private
     */
    private getTape(repoId: string): GTapeHandler {
        let tape = this.tapes.get(repoId);
        if (!tape) {
            const tapePath = this.tapePath(repoId);
            const writer = this.context.settings.getSetting('writer');
            tape = new GTapeHandler(repoId, tapePath, { writer });
            this.tapes.set(repoId, tape);
        }
        return tape;
    }

    /**
     * Get the commit count for a repo.
     * @private
     */
    private getCommitCount(repoId: string): number {
        const output = this.execGit('rev-list --count HEAD', repoId);
        return parseInt(output, 10);
    }

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
        this.getTape(repoId).instantiate();

        // If no commits yet, do an initial commit with the tape
        try {
            this.execGit('rev-parse HEAD', repoId);
        } catch {
            this.execGit(`add ${TAPE_FILENAME}`, repoId);
            this.execGit('commit -m "init: bootstrap tape"', repoId);
        }
    }

    /**
     * Check if a git-storage repo is initialized.
     *
     * @param repoId - Repository identifier (defaults to DEFAULT_REPO_ID)
     * @returns true if git repo exists, false otherwise
     */
    exists(repoId: string): boolean {
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

    /**
     * Commit multiple files to git-storage in a single operation.
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

        const repoId = options?.repoId || await this.resolveRepoId(absolutePaths[0]);
        const assignmentKey = options?.repoId ? undefined : this.deriveKey(absolutePaths[0]);

        // Ensure initialized
        this.instantiate(repoId);

        const timestamp = new Date().toISOString();
        const commitMessage = options?.message ||
            (filePaths.length === 1
                ? `gitst: ${path.basename(absolutePaths[0])}`
                : `gitst: batch commit (${filePaths.length} files)`);

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

        // Create links and records for all files
        const links: TaraGitSTLink[] = [];
        const records: RecordHandler[] = [];
        const storagePaths: string[] = [];

        for (const { absolutePath, storagePath, contentHash } of fileData) {
            const linkData: Omit<TaraGitSTLink, 'recordId' | 'recordHash' | 'commitHash' | 'commitHashShort' | 'commitCount'> = {
                repoId,
                repoPath: this.getRepoPath(repoId),
                originalPath: absolutePath,
                storagePath,
                contentHash,
                timestamp,
                message: commitMessage,
                ...(assignmentKey ? { assignmentKey } : {}),
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
                commitHashShort: '',
                commitCount: 0,
                recordId: record.getId(),
                recordHash: record.__tararecord?.contentHash,
            });
        }

        // Append all records to internal tape
        const tape = this.getTape(repoId);
        tape.appendRecordBatch(records);

        // Stage all data files + tape file
        const allPaths = [...storagePaths, TAPE_FILENAME];
        for (const p of allPaths) {
            this.execGit(`add "${p.replace(/"/g, '\\"')}"`, repoId);
        }

        // Single commit
        this.execGit(`commit -m "${commitMessage.replace(/"/g, '\\"')}"`, repoId);

        // Get commit info
        const commitHash = this.execGit('rev-parse HEAD', repoId);
        const commitHashShort = this.execGit('rev-parse --short HEAD', repoId);
        const commitCount = this.getCommitCount(repoId);

        // Fill commit info into links
        for (const link of links) {
            link.commitHash = commitHash;
            link.commitHashShort = commitHashShort;
            link.commitCount = commitCount;
        }

        return links;
    }

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
}
