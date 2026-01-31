import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import type { TaraStack } from '../../tara-stack';
import { TapeHandler, TapeHandlerOptions } from '../../../base/tape-handler';
import { RecordHandler } from '../../../base/record-handler';
import { YYYYMM_prefix } from '../../../base/utils';

// --. -. - .- -. -.-.- . .-. - -- -- - -. . - .--.
// MARK: Types
// --. -. - .- -. -.-.- . .-. - -- -- - -. . - .--.

export interface DescriptorPairs {
    originPath?: string;
    [key: string]: string | number | boolean | undefined;
}


export interface DescriptorRecord {
    descriptors: DescriptorPairs;
    storagePath: string;
    repoId: string;
    timestamp: string;
}

export interface ResolveResult {
    storagePath: string;
    repoId: string;
    repoPath: string;
    isNew: boolean;
    descriptors?: DescriptorPairs;
}

/**
 * GitStResolver handles descriptor-based resolution for git-storage file streams.
 * 
 * Resolution uses an ordered vector of (key, value) pairs matched against
 * descriptor records stored in descriptor tapes.
 * 
 * `originPath` is a special descriptor used for assignment on miss.
 */
export class GitStResolver {
    constructor(private context: TaraStack) { }

    // --. -. - .- -. -.-.- . .-. - -- -- - -. . - .--.
    // MARK: PUBLIC API
    // --. -. - .- -. -.-.- . .-. - -- -- - -. . - .--.

    // MARK: ...resolve
    /**
     * Resolve a storage path for the given input.
     * 
     * 1. Builds full descriptor list (originPath + user descriptors)
     * 2. Scans descriptor tapes for matches
     * 3. If matches found, validates all point to same storagePath
     * 4. If no matches, assigns new storagePath from originPath
     * 
     * Note: Does NOT write descriptor record - caller is responsible for that
     * when isNew=true (after repo instantiation).
     * 
     * @throws Error if matches point to different storagePaths (ambiguous)
     */
    async resolve(
        input: DescriptorPairs
    ): Promise<ResolveResult> {

        const matches = await this.scanDescriptorTapes(input);

        // No matches - assign new
        if (matches.length === 0) {
            return await this.assignFromOriginPath(input);
        }

        // check for ambiguity
        this.validateUniqueStorage(matches);

        return {
            storagePath: matches[0].storagePath,
            repoId: matches[0].repoId,
            repoPath: this.builtRepoPath(matches[0].repoId),
            isNew: false,
            descriptors: input,
        };
    }

    // MARK: ...resolveAll
    /**
     * Low-level: returns ALL matching descriptor records.
     * No deduplication, no ambiguity check.
     */
    async resolveAll(input: DescriptorPairs): Promise<DescriptorRecord[]> {
        return this.scanDescriptorTapes(input);
    }

    // --. -. - .- -. -.-.- . .-. - -- -- - -. . - .--.
    // MARK: INTERNAL METHODS
    // --. -. - .- -. -.-.- . .-. - -- -- - -. . - .--.

    // MARK: ...scanDescriptorTapes
    /**
     * Scan all descriptor tapes for records matching the given descriptors.
     * A record matches if it contains ALL pairs in the query (exact equality).
     */
    private async scanDescriptorTapes(
        query: DescriptorPairs
    ): Promise<DescriptorRecord[]> {
        const matches: DescriptorRecord[] = [];
        const repoIds = this.listRepoIds();

        for (const repoId of repoIds) {
            const descriptorsDir = this.getDescriptorTapesDir(repoId);
            if (!fs.existsSync(descriptorsDir)) continue;

            const tapeFiles = fs.readdirSync(descriptorsDir)
                .filter(f => f.endsWith('.tara.jsonl'))
                .sort()
                .reverse(); // Most recent first

            for (const tapeFile of tapeFiles) {
                const tapePath = path.join(descriptorsDir, tapeFile);
                const tape = this.getTape(repoId, tapePath);

                await tape.readJSONL(({ parsed }) => {
                    if (this.recordMatches(parsed.descriptors, query)) {
                        matches.push({
                            descriptors: parsed.descriptors,
                            storagePath: parsed.storagePath,
                            repoId: parsed.repoId || repoId,
                            timestamp: parsed.timestamp,
                        });
                    }
                });
            }
        }

        return matches;
    }

    // MARK: ...validateUniqueStorage
    /**
     * Validate that all matches point to the same storagePath and repoId.
     * @throws Error if matches point to different storage locations (ambiguous)
     */
    private validateUniqueStorage(matches: DescriptorRecord[]): void {
        if (matches.length === 0) return;

        const firstPath = matches[0].storagePath;
        const firstRepoId = matches[0].repoId;

        for (const match of matches) {
            if (match.storagePath !== firstPath || match.repoId !== firstRepoId) {
                throw new Error(
                    `Ambiguous resolution: descriptors match multiple storage paths ` +
                    `(${firstRepoId}:${firstPath} vs ${match.repoId}:${match.storagePath})`
                );
            }
        }
    }

    // MARK: ...recordMatches
    /**
     * Check if a record matches the query.
     * Match = record contains ALL query pairs (exact key+value equality, type-sensitive).
     */
    private recordMatches(record: DescriptorPairs | undefined, query: DescriptorPairs): boolean {
        if (!record || typeof record !== 'object') {
            return false;
        }

        for (const key of Object.keys(query)) {
            const qValue = query[key];
            if (qValue === undefined) continue;
            if (record[key] !== qValue) {
                return false;
            }
        }

        return true;
    }

    // MARK: ...assignFromOriginPath
    /**
     * Assign a new storagePath based on originPath.
     * RepoId is derived deterministically from source location:
     * - If file is inside a git repo → hash(git repo root)
     * - Otherwise → hash(parent directory)
     */
    private async assignFromOriginPath(
        input: DescriptorPairs
    ): Promise<ResolveResult> {
        if (!input.originPath) {
            throw new Error('Cannot create new file: originPath is required');
        }

        const sourceRoot = this.deriveSourceRoot(input.originPath);
        const repoId = this.hashToRepoId(sourceRoot);
        const storagePath = this.mapPathToStorage(input.originPath);
        const repoPath = this.builtRepoPath(repoId);

        return {
            storagePath,
            repoId,
            repoPath,
            isNew: true,
            descriptors: input
        };
    }

    // MARK: ...deriveSourceRoot
    /**
     * Derive the source root for a file path.
     * Walks up from dirname(originPath) looking for .git; if found, returns the repo root.
     * Otherwise returns dirname(originPath).
     */
    private deriveSourceRoot(originPath: string): string {
        const absolutePath = path.resolve(originPath);
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

    // MARK: ...hashToRepoId
    /**
     * Hash a path to create a deterministic repoId.
     * Uses first 12 chars of SHA256 for readability while maintaining uniqueness.
     */
    private hashToRepoId(sourcePath: string): string {
        const hashSum = crypto.createHash('sha256');
        hashSum.update(sourcePath);
        return hashSum.digest('hex').substring(0, 12);
    }

    // MARK: ...mapPathToStorage
    /**
     * Map origin path to storage location.
     * /Users/foo/bar/file.txt -> <sha256-of-dir>/file.txt
     */
    private mapPathToStorage(originPath: string): string {
        const absolutePath = path.resolve(originPath);
        const dirPath = path.dirname(absolutePath);
        const fileName = path.basename(absolutePath);

        const hashSum = crypto.createHash('sha256');
        hashSum.update(dirPath);
        const dirHash = hashSum.digest('hex');

        return path.join(dirHash, fileName);
    }

    // MARK: ...writeDescriptorRecord
    /**
     * Write a descriptor record to the current month's descriptor tape.
     */
    async writeDescriptorRecord(record: DescriptorRecord): Promise<void> {
        const tape = this.getDescriptorTape(record.repoId);

        const taraRecord = new RecordHandler({
            content: {
                type: 'taralib/git-storage-descriptor',
                ...record,
            }
        });

        tape.appendRecord(taraRecord);
    }

    // --. -. - .- -. -.-.- . .-. - -- -- - -. . - .--.
    // MARK: TAPE INFRASTRUCTURE
    // --. -. - .- -. -.-.- . .-. - -- -- - -. . - .--.

    // MARK: ...getDescriptorTapesDir
    /**
     * Get the descriptors directory for a repo.
     */
    getDescriptorTapesDir(repoId: string): string {
        return path.join(this.builtRepoPath(repoId), 'descriptors');
    }

    // MARK: ...getDescriptorTape
    /**
     * Get TapeHandler for current month's descriptor tape.
     */
    getDescriptorTape(repoId: string): TapeHandler {
        const descriptorsDir = this.getDescriptorTapesDir(repoId);
        if (!fs.existsSync(descriptorsDir)) {
            fs.mkdirSync(descriptorsDir, { recursive: true });
        }

        const tapeName = `${YYYYMM_prefix(repoId)}.tara.jsonl`;
        const tapePath = path.join(descriptorsDir, tapeName);
        const writer = this.context.settings.getSetting('writer');

        return new TapeHandler({
            tapeId: repoId,
            tapePath,
            options: { writer }
        });
    }

    // MARK: ...listDescriptorTapeFiles
    /**
     * List all descriptor tape files for a repo.
     */
    listDescriptorTapeFiles(repoId: string): string[] {
        const descriptorsDir = this.getDescriptorTapesDir(repoId);
        if (!fs.existsSync(descriptorsDir)) return [];

        return fs.readdirSync(descriptorsDir)
            .filter(f => f.endsWith('.tara.jsonl'))
            .sort();
    }

    // --. -. - .- -. -.-.- . .-. - -- -- - -. . - .--.
    // MARK: UTILS
    // --. -. - .- -. -.-.- . .-. - -- -- - -. . - .--.

    // MARK: ...listRepoIds
    /**
     * List existing repo IDs in git-storage home directory.
     */
    private listRepoIds(): string[] {
        // `#josePereiro/REVIEWED`
        const homePath = this.context.global.home.getGitStoragePath();
        if (!fs.existsSync(homePath)) return [];
        return fs.readdirSync(homePath).filter(name => {
            const full = path.join(homePath, name);
            const git = path.join(full, '.git');
            return fs.statSync(full).isDirectory() &&
                fs.existsSync(git);
        });
    }

    // MARK: ...getRepoPath
    /**
     * Get path for a specific repo.
     */
    private builtRepoPath(repoId: string): string {
        // `#josePereiro/REVIEWED`
        return this.context.global.home.getGitStoragePath(repoId);
    }

    // MARK: ...getTape
    /**
     * Get a TapeHandler for reading tape content.
     */
    private getTape(
        repoId: string,
        tapePath: string,
        options?: TapeHandlerOptions
    ): TapeHandler {
        // add writer
        const writer = this.context.settings.getSetting('writer');
        return new TapeHandler({
            tapeId: repoId,
            tapePath,
            options: { ...options, writer }
        });
    }
}
