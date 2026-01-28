import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execSync } from 'child_process';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GitDBHandler } from '../src/base/git-db-handler';

function tmpRoot(): string {
    const tag = `gitdb-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return path.join(os.tmpdir(), tag);
}

describe('GitDBHandler', () => {
    let rootPath: string;
    let handler: GitDBHandler;

    beforeEach(() => {
        rootPath = tmpRoot();
        fs.mkdirSync(rootPath, { recursive: true });
        handler = new GitDBHandler(rootPath, { writer: 'test-runner' });
    });

    afterEach(() => {
        fs.rmSync(rootPath, { recursive: true, force: true });
    });

    describe('instantiate', () => {
        it('creates dir, git repo, and tape file', () => {
            handler.instantiate('my-collection');

            const dbPath = handler.getDbPath('my-collection');
            expect(fs.existsSync(dbPath)).toBe(true);
            expect(fs.existsSync(path.join(dbPath, '.git'))).toBe(true);
            expect(fs.existsSync(path.join(dbPath, 'commits.tara.jsonl'))).toBe(true);
        });

        it('is idempotent', () => {
            handler.instantiate('col');
            handler.instantiate('col');
            expect(handler.exists('col')).toBe(true);

            // Still only the bootstrap commit
            const count = execSync('git rev-list --count HEAD', {
                cwd: handler.getDbPath('col'),
                encoding: 'utf-8',
            }).trim();
            expect(parseInt(count, 10)).toBe(1);
        });
    });

    describe('exists', () => {
        it('returns false for non-existent collection', () => {
            expect(handler.exists('nope')).toBe(false);
        });

        it('returns true after instantiate', () => {
            handler.instantiate('col');
            expect(handler.exists('col')).toBe(true);
        });
    });

    describe('commit', () => {
        it('copies file, creates git commit, returns valid link', () => {
            // Create a temp source file
            const srcDir = path.join(rootPath, '_src');
            fs.mkdirSync(srcDir);
            const srcFile = path.join(srcDir, 'hello.txt');
            fs.writeFileSync(srcFile, 'hello world');

            const link = handler.commit('docs', srcFile, { message: 'add hello' });

            expect(link.dbId).toBe('docs');
            expect(link.commitCount).toBe(2); // 1 bootstrap + 1 data
            expect(link.originalPath).toBe(srcFile);
            expect(link.storagePath).toContain('hello.txt');
            expect(link.contentHash).toHaveLength(64);
            expect(link.recordId).toBeTruthy();
            expect(link.timestamp).toBeTruthy();
            expect(link.message).toBe('add hello');

            // Verify file exists in repo
            const stored = path.join(handler.getDbPath('docs'), link.storagePath);
            expect(fs.readFileSync(stored, 'utf-8')).toBe('hello world');
        });

        it('throws on non-existent file', () => {
            expect(() => {
                handler.commit('col', '/nonexistent/file.txt');
            }).toThrow('File does not exist');
        });

        it('throws on relative path', () => {
            expect(() => {
                handler.commit('col', 'relative/file.txt');
            }).toThrow('Path must be absolute');
        });
    });

    describe('commitBatch', () => {
        it('creates single commit for multiple files', () => {
            const srcDir = path.join(rootPath, '_src');
            fs.mkdirSync(srcDir);
            const file1 = path.join(srcDir, 'a.txt');
            const file2 = path.join(srcDir, 'b.txt');
            fs.writeFileSync(file1, 'aaa');
            fs.writeFileSync(file2, 'bbb');

            const links = handler.commitBatch('multi', [file1, file2]);

            expect(links).toHaveLength(2);
            expect(links[0].commitCount).toBe(2);
            expect(links[1].commitCount).toBe(2);

            // Verify single commit (bootstrap + 1 batch)
            const count = execSync('git rev-list --count HEAD', {
                cwd: handler.getDbPath('multi'),
                encoding: 'utf-8',
            }).trim();
            expect(parseInt(count, 10)).toBe(2);
        });

        it('throws on empty array', () => {
            expect(() => {
                handler.commitBatch('col', []);
            }).toThrow('filePaths must not be empty');
        });
    });

    describe('getRootPath / getDbPath', () => {
        it('returns correct paths', () => {
            expect(handler.getRootPath()).toBe(rootPath);
            expect(handler.getDbPath('foo')).toBe(path.join(rootPath, 'foo'));
        });
    });
});
