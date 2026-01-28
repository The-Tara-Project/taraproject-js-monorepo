import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { GTapeHandler } from './tape-handler';
import { RecordHandler } from './record-handler';

const TAPE_FILENAME = 'commits.tara.jsonl';

export interface GitDBCommitLink {
    dbId: string;
    commitCount: number;
    originalPath: string;
    storagePath: string;
    contentHash: string;
    recordId: string;
    timestamp: string;
    message?: string;
}

export class GitDBHandler {
    private rootPath: string;
    private writer?: string;
    private tapes: Map<string, GTapeHandler> = new Map();

    constructor(rootPath: string, options?: { writer?: string }) {
        this.rootPath = rootPath;
        this.writer = options?.writer;
    }

    getRootPath(): string {
        return this.rootPath;
    }

    getDbPath(dbId: string): string {
        return path.join(this.rootPath, dbId);
    }

    exists(dbId: string): boolean {
        const dbPath = this.getDbPath(dbId);
        return fs.existsSync(dbPath) && fs.existsSync(path.join(dbPath, '.git'));
    }

    instantiate(dbId: string): void {
        const dbPath = this.getDbPath(dbId);

        if (!fs.existsSync(dbPath)) {
            fs.mkdirSync(dbPath, { recursive: true });
        }

        if (!fs.existsSync(path.join(dbPath, '.git'))) {
            this.execGit('init', dbId);
        }

        // Ensure tape exists
        this.getTape(dbId).instantiate();

        // If no commits yet, do an initial commit with the tape
        try {
            this.execGit('rev-parse HEAD', dbId);
        } catch {
            this.execGit(`add ${TAPE_FILENAME}`, dbId);
            this.execGit('commit -m "init: bootstrap tape"', dbId);
        }
    }

    commit(dbId: string, filePath: string, options?: { message?: string }): GitDBCommitLink {
        return this.commitBatch(dbId, [filePath], options)[0];
    }

    commitBatch(dbId: string, filePaths: string[], options?: { message?: string }): GitDBCommitLink[] {
        if (filePaths.length === 0) {
            throw new Error('filePaths must not be empty');
        }

        // Validate all files exist and are absolute
        for (const fp of filePaths) {
            if (!path.isAbsolute(fp)) {
                throw new Error(`Path must be absolute: ${fp}`);
            }
            if (!fs.existsSync(fp)) {
                throw new Error(`File does not exist: ${fp}`);
            }
        }

        this.instantiate(dbId);

        const timestamp = new Date().toISOString();
        const links: GitDBCommitLink[] = [];
        const records: RecordHandler[] = [];
        const storagePaths: string[] = [];

        for (const fp of filePaths) {
            const contentHash = this.calculateFileHash(fp);
            const storagePath = this.mapPathToStorage(fp);
            this.copyFileToStorage(fp, dbId);

            const link: GitDBCommitLink = {
                dbId,
                commitCount: 0, // filled after commit
                originalPath: fp,
                storagePath,
                contentHash,
                recordId: '', // filled below
                timestamp,
                message: options?.message,
            };

            const record = new RecordHandler({
                type: 'gitdb/commit-link',
                dbId: link.dbId,
                originalPath: link.originalPath,
                storagePath: link.storagePath,
                contentHash: link.contentHash,
                timestamp: link.timestamp,
                message: link.message,
            });

            link.recordId = record.getId();
            links.push(link);
            records.push(record);
            storagePaths.push(storagePath);
        }

        // Append all records to tape
        const tape = this.getTape(dbId);
        tape.appendRecordBatch(records);

        // Stage all data files + tape
        const allPaths = [...storagePaths, TAPE_FILENAME].join(' ');
        this.execGit(`add ${allPaths}`, dbId);

        // Single commit
        const msg = options?.message || `gitdb: commit ${filePaths.length} file(s)`;
        this.execGit(`commit -m "${msg.replace(/"/g, '\\"')}"`, dbId);

        // Get commit count
        const commitCount = this.getCommitCount(dbId);
        for (const link of links) {
            link.commitCount = commitCount;
        }

        return links;
    }

    // --- Private methods ---

    private execGit(command: string, dbId: string): string {
        const dbPath = this.getDbPath(dbId);
        return execSync(`git ${command}`, {
            cwd: dbPath,
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
        }).trim();
    }

    private calculateFileHash(filePath: string): string {
        const content = fs.readFileSync(filePath);
        return crypto.createHash('sha256').update(content).digest('hex');
    }

    private mapPathToStorage(filePath: string): string {
        const dir = path.dirname(filePath);
        const dirHash = crypto.createHash('sha256').update(dir).digest('hex');
        const filename = path.basename(filePath);
        return path.join(dirHash, filename);
    }

    private copyFileToStorage(filePath: string, dbId: string): string {
        const storagePath = this.mapPathToStorage(filePath);
        const fullPath = path.join(this.getDbPath(dbId), storagePath);
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.copyFileSync(filePath, fullPath);
        return storagePath;
    }

    private getTape(dbId: string): GTapeHandler {
        let tape = this.tapes.get(dbId);
        if (!tape) {
            const tapePath = path.join(this.getDbPath(dbId), TAPE_FILENAME);
            tape = new GTapeHandler(dbId, tapePath, { writer: this.writer });
            this.tapes.set(dbId, tape);
        }
        return tape;
    }

    private getCommitCount(dbId: string): number {
        const output = this.execGit('rev-list --count HEAD', dbId);
        return parseInt(output, 10);
    }
}
