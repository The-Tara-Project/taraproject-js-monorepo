import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import type { TaraStack } from '../../tara-stack';
import { TapeHandler } from '../../../base/tape-handler';

const TAPE_FILENAME = 'commits.tara.jsonl';
const REPO_COMMIT_CAP = 1000;
const REPO_CACHE_MAX = 100;

// Partial link returned before git commit
export interface GitStAssignmentLink {
    repoId: string;
    repoPath: string;
    assignmentKey?: string;
    filePath: string;  // original file path
}

/**
 * GitStAssignmentManager handles repo assignment logic for git-storage:
 * - Assignment key derivation (based on git repo root or directory)
 * - Repo assignment (round-robin/least-used strategy)
 * - Assignment cache with LRU eviction
 * - Tape scanning for existing assignments
 */
export class GitStAssignmentManager {
    private repoCache: Map<string, string> = new Map();  // assignmentKey -> repoId

    constructor(private context: TaraStack) {}

    // --. -. - .- -. -.-.- . .-. - -- -- - -. . - .--.
    // MARK: PUBLIC API
    // --. -. - .- -. -.-.- . .-. - -- -- - -. . - .--.

    // MARK: ...resolveAssignment
    /**
     * Resolve repo assignment for a file path.
     * Derives assignment key, checks cache, scans tapes, or assigns new repo.
     *
     * @param filePath - Absolute path to file
     * @returns Map with one repoId entry containing one GitStAssignmentLink
     */
    async resolveAssignment(filePath: string): Promise<Map<string, GitStAssignmentLink[]>> {
        const key = this.deriveKey(filePath);

        // Check cache
        let repoId = this.cacheGet(key);

        if (!repoId) {
            // Scan tapes for existing assignment
            repoId = await this.scanTapesForKey(key) ?? undefined;

            if (!repoId) {
                // Assign new repo
                repoId = await this.assignNewRepo();
            }

            this.cacheSet(key, repoId);
        }

        const link: GitStAssignmentLink = {
            repoId,
            repoPath: this.getRepoPath(repoId),
            assignmentKey: key,
            filePath,
        };

        return new Map([[repoId, [link]]]);
    }

    // MARK: ...resolveAssignmentBatch
    /**
     * Resolve repo assignments for multiple file paths.
     * Returns files grouped by repoId.
     *
     * @param filePaths - Array of absolute file paths
     * @returns Map of repoId -> array of GitStAssignmentLink objects
     */
    async resolveAssignmentBatch(filePaths: string[]): Promise<Map<string, GitStAssignmentLink[]>> {
        const result = new Map<string, GitStAssignmentLink[]>();

        for (const filePath of filePaths) {
            const key = this.deriveKey(filePath);
            let repoId = this.cacheGet(key);

            if (!repoId) {
                repoId = await this.scanTapesForKey(key) ?? undefined;
                if (!repoId) {
                    repoId = await this.assignNewRepo();
                }
                this.cacheSet(key, repoId);
            }

            const link: GitStAssignmentLink = {
                repoId,
                repoPath: this.getRepoPath(repoId),
                assignmentKey: key,
                filePath,
            };

            const group = result.get(repoId) || [];
            group.push(link);
            result.set(repoId, group);
        }

        return result;
    }

    // MARK: ...getAssignmentKey
    /**
     * Get the assignment key for a file path.
     * Public wrapper around deriveKey for use when explicit repoId is provided.
     *
     * @param filePath - Absolute path to file
     * @returns Assignment key (git repo root or directory path)
     */
    getAssignmentKey(filePath: string): string {
        return this.deriveKey(filePath);
    }

    // --. -. - .- -. -.-.- . .-. - -- -- - -. . - .--.
    // MARK: INTERNAL METHODS
    // --. -. - .- -. -.-.- . .-. - -- -- - -. . - .--.

    // MARK: ...deriveKey
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

    // MARK: ...scanTapesForKey
    /**
     * Scan all existing repo tapes looking for a record with matching assignmentKey.
     * Returns repoId if found, null otherwise.
     */
    private async scanTapesForKey(key: string): Promise<string | null> {
        const repoIds = this.listRepoIds();
        for (const repoId of repoIds) {
            const tapePath = this.tapePath(repoId);
            if (!fs.existsSync(tapePath)) continue;

            const tape = this.getTape(repoId);
            let found = false;

            await tape.readJSONL(({ parsed }) => {
                if (parsed?.link?.assignmentKey === key) {
                    found = true;
                    return 'stop';
                }
            });

            if (found) {
                return repoId;
            }
        }
        return null;
    }

    // MARK: ...assignNewRepo
    /**
     * Assign a new repo using round-robin: pick repo with fewest commits.
     * If all repos >= REPO_COMMIT_CAP, create a new repo with UUID.
     */
    private async assignNewRepo(): Promise<string> {
        const repoIds = this.listRepoIds();

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
            // All full — create next repo with UUID
            return crypto.randomUUID().toString();
        }

        return minRepo;
    }

    // MARK: ...cacheGet
    /**
     * Get a value from the repo cache.
     */
    private cacheGet(key: string): string | undefined {
        return this.repoCache.get(key);
    }

    // MARK: ...cacheSet
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

    // MARK: ...listRepoIds
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

    // MARK: ...getPath
    /**
     * Get git-storage home path.
     */
    private getPath(...subfolders: string[]): string {
        return this.context.global.home.getGitStoragePath(...subfolders);
    }

    // MARK: ...getRepoPath
    /**
     * Get path for a specific repo.
     */
    private getRepoPath(repoId: string): string {
        return this.getPath(repoId);
    }

    // MARK: ...tapePath
    /**
     * Get the path to the internal tape for a repo.
     */
    private tapePath(repoId: string): string {
        return path.join(this.getRepoPath(repoId), TAPE_FILENAME);
    }

    // MARK: ...getTape
    /**
     * Get a TapeHandler for reading tape content.
     * Note: This is only used for counting lines, not for writing.
     */
    private getTape(repoId: string): TapeHandler {
        const tapePath = this.tapePath(repoId);
        const writer = this.context.settings.getSetting('writer');
        return new TapeHandler(repoId, tapePath, { writer });
    }
}
