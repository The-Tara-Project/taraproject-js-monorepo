import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { TaraStack } from '../src';
import { setupTestEnv, teardownTestEnv } from './utils';

describe('GitStorageManager', () => {
    let tara: TaraStack;
    let testFilePath: string;
    let testFileContent: string;

    beforeEach(() => {
        tara = setupTestEnv();

        // Ensure home directory exists
        const testDir = tara.global.home.getPath();
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }

        testFilePath = path.join(testDir, 'test-file.txt');
        testFileContent = 'test content';
        fs.writeFileSync(testFilePath, testFileContent, 'utf-8');
    });

    afterEach(() => {
        teardownTestEnv(tara);
    });

    describe('Initialization', () => {
        it('creates directory and git repo on instantiate', () => {
            tara.global.gitst.instantiate();

            const repoPath = tara.global.gitst.getRepoPath();
            expect(fs.existsSync(repoPath)).toBe(true);

            const gitDir = path.join(repoPath, '.git');
            expect(fs.existsSync(gitDir)).toBe(true);
        });

        it('is idempotent', () => {
            tara.global.gitst.instantiate();
            expect(() => tara.global.gitst.instantiate()).not.toThrow();
        });

        it('exists() returns false before initialization', () => {
            expect(tara.global.gitst.exists()).toBe(false);
        });

        it('exists() returns true after initialization', () => {
            tara.global.gitst.instantiate();
            expect(tara.global.gitst.exists()).toBe(true);
        });

        it('creates git-storage tape on instantiate', () => {
            tara.global.gitst.instantiate();

            const tapeId = tara.global.gitst.getTapeId();
            expect(tara.global.tapes.exists(tapeId)).toBe(true);
        });
    });

    describe('getPath', () => {
        it('returns correct base directory path', () => {
            const storagePath = tara.global.gitst.getPath();
            expect(storagePath).toContain('git-storage');
            expect(storagePath).toBe(tara.global.home.getSubPath('git-storage'));
        });
    });

    describe('getRepoPath', () => {
        it('returns default repo path when no repoId specified', () => {
            const repoPath = tara.global.gitst.getRepoPath();
            expect(repoPath).toBe(path.join(tara.global.gitst.getPath(), 'default'));
        });

        it('returns custom repo path when repoId specified', () => {
            const repoPath = tara.global.gitst.getRepoPath('custom-repo');
            expect(repoPath).toBe(path.join(tara.global.gitst.getPath(), 'custom-repo'));
        });
    });

    describe('getTapeId', () => {
        it('returns tape ID with YYYYMM prefix', () => {
            const tapeId = tara.global.gitst.getTapeId();
            expect(tapeId).toMatch(/^\d{6}-git-storage-commits$/);
            expect(tapeId.endsWith('-git-storage-commits')).toBe(true);
        });
    });

    describe('commit', () => {
        it('commits file and returns valid link', () => {
            const link = tara.global.gitst.commit(testFilePath);

            // Verify link structure
            expect(link.repoId).toBe('default');
            expect(link.repoPath).toBe(tara.global.gitst.getRepoPath());
            expect(link.commitHash).toMatch(/^[0-9a-f]{40}$/);
            expect(link.commitHashShort).toMatch(/^[0-9a-f]{7}$/);
            expect(link.originalPath).toBe(testFilePath);
            expect(link.storagePath).toBeTruthy();
            expect(link.recordId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
            expect(link.timestamp).toBeTruthy();
            expect(new Date(link.timestamp)).toBeInstanceOf(Date);
        });

        it('preserves file content in storage', () => {
            const link = tara.global.gitst.commit(testFilePath);

            const storedFilePath = path.join(link.repoPath, link.storagePath);
            expect(fs.existsSync(storedFilePath)).toBe(true);

            const storedContent = fs.readFileSync(storedFilePath, 'utf-8');
            expect(storedContent).toBe(testFileContent);
        });

        it('records commit in tape', async () => {
            const link = tara.global.gitst.commit(testFilePath);

            const tape = tara.global.tapes.get(tara.global.gitst.getTapeId());
            let foundRecord = false;

            await tape.readRecords(({ parsed }) => {
                if (parsed.__tararecord?.id === link.recordId) {
                    foundRecord = true;
                    expect(parsed.type).toBe('taralib/git-storage-commit');
                    return 'stop';
                }
            });

            expect(foundRecord).toBe(true);
        });

        it('accepts custom commit message', () => {
            const customMessage = 'Custom commit message';
            const link = tara.global.gitst.commit(testFilePath, {
                message: customMessage
            });

            expect(link.message).toBe(customMessage);

            // Verify in git log
            const gitLog = execSync('git log -1 --pretty=%B', {
                cwd: link.repoPath,
                encoding: 'utf-8'
            }).trim();
            expect(gitLog).toBe(customMessage);
        });

        it('uses default commit message when not provided', () => {
            const link = tara.global.gitst.commit(testFilePath);

            expect(link.message).toContain('gitst:');
            expect(link.message).toContain('test-file.txt');
        });

        it('accepts metadata', async () => {
            const metadata = { foo: 'bar', number: 42 };
            const link = tara.global.gitst.commit(testFilePath, { metadata });

            const tape = tara.global.tapes.get(tara.global.gitst.getTapeId());
            let foundRecord = false;

            await tape.readRecords(({ parsed }) => {
                if (parsed.__tararecord?.id === link.recordId) {
                    foundRecord = true;
                    expect(parsed.metadata).toEqual(metadata);
                    return 'stop';
                }
            });

            expect(foundRecord).toBe(true);
        });

        it('throws error for non-existent file', () => {
            const nonExistentPath = path.join(tara.global.home.getPath(), 'nonexistent.txt');

            expect(() => {
                tara.global.gitst.commit(nonExistentPath);
            }).toThrow('File not found');
        });

        it('throws error for relative path', () => {
            expect(() => {
                tara.global.gitst.commit('relative/path.txt');
            }).toThrow('Path must be absolute');
        });

        it('auto-initializes if not already initialized', () => {
            expect(tara.global.gitst.exists()).toBe(false);

            tara.global.gitst.commit(testFilePath);

            expect(tara.global.gitst.exists()).toBe(true);
        });
    });

    describe('Path Mapping', () => {
        it('uses hash-based directory structure', () => {
            const link = tara.global.gitst.commit(testFilePath);

            // Storage path should be <hash>/<filename>
            const dirPath = path.dirname(testFilePath);
            const fileName = path.basename(testFilePath);
            const expectedHash = crypto.createHash('sha256').update(dirPath).digest('hex');
            const expectedStorage = path.join(expectedHash, fileName);

            expect(link.storagePath).toBe(expectedStorage);
        });

        it('handles nested directories', () => {
            const nestedDir = path.join(tara.global.home.getPath(), 'a', 'b', 'c');
            fs.mkdirSync(nestedDir, { recursive: true });

            const nestedFile = path.join(nestedDir, 'nested.txt');
            fs.writeFileSync(nestedFile, 'nested content', 'utf-8');

            const link = tara.global.gitst.commit(nestedFile);

            const storedFilePath = path.join(link.repoPath, link.storagePath);
            expect(fs.existsSync(storedFilePath)).toBe(true);

            const storedContent = fs.readFileSync(storedFilePath, 'utf-8');
            expect(storedContent).toBe('nested content');
        });

        it('handles files from different root directories', () => {
            // Create another directory structure
            const altDir = path.join(tara.global.home.getPath(), 'alt');
            fs.mkdirSync(altDir, { recursive: true });

            const altFile = path.join(altDir, 'alt-file.txt');
            fs.writeFileSync(altFile, 'alt content', 'utf-8');

            const link1 = tara.global.gitst.commit(testFilePath);
            const link2 = tara.global.gitst.commit(altFile);

            // Both should be stored correctly
            expect(fs.existsSync(path.join(link1.repoPath, link1.storagePath))).toBe(true);
            expect(fs.existsSync(path.join(link2.repoPath, link2.storagePath))).toBe(true);

            // And they should have different storage paths
            expect(link1.storagePath).not.toBe(link2.storagePath);
        });
    });

    describe('Integration Tests', () => {
        it('handles multiple commits to same directory', () => {
            const file1 = path.join(tara.global.home.getPath(), 'file1.txt');
            const file2 = path.join(tara.global.home.getPath(), 'file2.txt');

            fs.writeFileSync(file1, 'content 1', 'utf-8');
            fs.writeFileSync(file2, 'content 2', 'utf-8');

            const link1 = tara.global.gitst.commit(file1);
            const link2 = tara.global.gitst.commit(file2);

            // Different commits
            expect(link1.commitHash).not.toBe(link2.commitHash);
            expect(link1.recordId).not.toBe(link2.recordId);

            // Same repo
            expect(link1.repoPath).toBe(link2.repoPath);
        });

        it('handles multiple commits from different directories', () => {
            const dir1 = path.join(tara.global.home.getPath(), 'dir1');
            const dir2 = path.join(tara.global.home.getPath(), 'dir2');

            fs.mkdirSync(dir1, { recursive: true });
            fs.mkdirSync(dir2, { recursive: true });

            const file1 = path.join(dir1, 'file.txt');
            const file2 = path.join(dir2, 'file.txt');

            fs.writeFileSync(file1, 'content 1', 'utf-8');
            fs.writeFileSync(file2, 'content 2', 'utf-8');

            const link1 = tara.global.gitst.commit(file1, { message: 'commit 1' });
            const link2 = tara.global.gitst.commit(file2, { message: 'commit 2' });

            // Verify both are stored correctly
            expect(fs.readFileSync(path.join(link1.repoPath, link1.storagePath), 'utf-8')).toBe('content 1');
            expect(fs.readFileSync(path.join(link2.repoPath, link2.storagePath), 'utf-8')).toBe('content 2');
        });

        it('tape records are queryable', async () => {
            const file1 = path.join(tara.global.home.getPath(), 'file1.txt');
            const file2 = path.join(tara.global.home.getPath(), 'file2.txt');

            fs.writeFileSync(file1, 'content 1', 'utf-8');
            fs.writeFileSync(file2, 'content 2', 'utf-8');

            const link1 = tara.global.gitst.commit(file1, {
                metadata: { tag: 'first' }
            });
            const link2 = tara.global.gitst.commit(file2, {
                metadata: { tag: 'second' }
            });

            const tape = tara.global.tapes.get(tara.global.gitst.getTapeId());
            const records: any[] = [];

            await tape.readRecords(({ parsed }) => {
                if (parsed.type === 'taralib/git-storage-commit') {
                    records.push(parsed);
                }
            });

            expect(records.length).toBe(2);
            expect(records[0].metadata?.tag).toBe('first');
            expect(records[1].metadata?.tag).toBe('second');
        });

        it('maintains git history across multiple commits', () => {
            const file1 = path.join(tara.global.home.getPath(), 'file1.txt');
            const file2 = path.join(tara.global.home.getPath(), 'file2.txt');

            fs.writeFileSync(file1, 'content 1', 'utf-8');
            fs.writeFileSync(file2, 'content 2', 'utf-8');

            tara.global.gitst.commit(file1, { message: 'first commit' });
            tara.global.gitst.commit(file2, { message: 'second commit' });

            const gitLog = execSync('git log --oneline', {
                cwd: tara.global.gitst.getRepoPath(),
                encoding: 'utf-8'
            });

            expect(gitLog).toContain('first commit');
            expect(gitLog).toContain('second commit');
        });
    });

    describe('Edge Cases', () => {
        it('handles files with spaces in name', () => {
            const fileWithSpaces = path.join(tara.global.home.getPath(), 'file with spaces.txt');
            fs.writeFileSync(fileWithSpaces, 'content', 'utf-8');

            const link = tara.global.gitst.commit(fileWithSpaces);

            const storedFilePath = path.join(link.repoPath, link.storagePath);
            expect(fs.existsSync(storedFilePath)).toBe(true);
        });

        it('handles commit messages with quotes', () => {
            const message = 'Message with "quotes" and \'apostrophes\'';
            const link = tara.global.gitst.commit(testFilePath, { message });

            expect(link.message).toBe(message);
        });

        it('handles large files', () => {
            const largeContent = 'x'.repeat(1024 * 1024); // 1MB
            const largeFile = path.join(tara.global.home.getPath(), 'large.txt');
            fs.writeFileSync(largeFile, largeContent, 'utf-8');

            const link = tara.global.gitst.commit(largeFile);

            const storedContent = fs.readFileSync(path.join(link.repoPath, link.storagePath), 'utf-8');
            expect(storedContent).toBe(largeContent);
        });
    });

    describe('Content Hash', () => {
        it('includes content hash in link', () => {
            const link = tara.global.gitst.commit(testFilePath);

            expect(link.contentHash).toBeTruthy();
            expect(link.contentHash).toMatch(/^[0-9a-f]{64}$/); // SHA-256 hex
        });

        it('generates different hashes for different content', () => {
            const file1 = path.join(tara.global.home.getPath(), 'file1.txt');
            const file2 = path.join(tara.global.home.getPath(), 'file2.txt');

            fs.writeFileSync(file1, 'content 1', 'utf-8');
            fs.writeFileSync(file2, 'content 2', 'utf-8');

            const link1 = tara.global.gitst.commit(file1);
            const link2 = tara.global.gitst.commit(file2);

            expect(link1.contentHash).not.toBe(link2.contentHash);
        });

        it('generates same hash for identical content', () => {
            const file1 = path.join(tara.global.home.getPath(), 'file1.txt');
            const file2 = path.join(tara.global.home.getPath(), 'file2.txt');

            fs.writeFileSync(file1, 'same content', 'utf-8');
            fs.writeFileSync(file2, 'same content', 'utf-8');

            const link1 = tara.global.gitst.commit(file1);
            const link2 = tara.global.gitst.commit(file2);

            expect(link1.contentHash).toBe(link2.contentHash);
        });
    });

    describe('Multi-Repo Support', () => {
        it('commits to default repo when repoId not specified', () => {
            const link = tara.global.gitst.commit(testFilePath);

            expect(link.repoId).toBe('default');
            expect(link.repoPath).toContain('default');
        });

        it('commits to custom repo when repoId specified', () => {
            const link = tara.global.gitst.commit(testFilePath, { repoId: 'custom-repo' });

            expect(link.repoId).toBe('custom-repo');
            expect(link.repoPath).toContain('custom-repo');

            // Verify file stored in custom repo
            const storedFilePath = path.join(link.repoPath, link.storagePath);
            expect(fs.existsSync(storedFilePath)).toBe(true);
        });

        it('keeps repos separate', () => {
            const file1 = path.join(tara.global.home.getPath(), 'file1.txt');
            const file2 = path.join(tara.global.home.getPath(), 'file2.txt');

            fs.writeFileSync(file1, 'content 1', 'utf-8');
            fs.writeFileSync(file2, 'content 2', 'utf-8');

            const link1 = tara.global.gitst.commit(file1, { repoId: 'repo-a' });
            const link2 = tara.global.gitst.commit(file2, { repoId: 'repo-b' });

            // Different repos
            expect(link1.repoId).toBe('repo-a');
            expect(link2.repoId).toBe('repo-b');
            expect(link1.repoPath).not.toBe(link2.repoPath);

            // Each has own git repo
            expect(fs.existsSync(path.join(link1.repoPath, '.git'))).toBe(true);
            expect(fs.existsSync(path.join(link2.repoPath, '.git'))).toBe(true);
        });

        it('batch commits to specified repo', () => {
            const file1 = path.join(tara.global.home.getPath(), 'batch1.txt');
            const file2 = path.join(tara.global.home.getPath(), 'batch2.txt');

            fs.writeFileSync(file1, 'content 1', 'utf-8');
            fs.writeFileSync(file2, 'content 2', 'utf-8');

            const links = tara.global.gitst.commitBatch([file1, file2], { repoId: 'batch-repo' });

            expect(links[0].repoId).toBe('batch-repo');
            expect(links[1].repoId).toBe('batch-repo');
            expect(links[0].repoPath).toContain('batch-repo');
        });

        it('exists() checks specific repo', () => {
            expect(tara.global.gitst.exists()).toBe(false);
            expect(tara.global.gitst.exists('custom')).toBe(false);

            tara.global.gitst.instantiate('custom');

            expect(tara.global.gitst.exists()).toBe(false); // default still doesn't exist
            expect(tara.global.gitst.exists('custom')).toBe(true);
        });
    });

    describe('Batch Commit', () => {
        it('commits multiple files in single operation', () => {
            const file1 = path.join(tara.global.home.getPath(), 'batch1.txt');
            const file2 = path.join(tara.global.home.getPath(), 'batch2.txt');
            const file3 = path.join(tara.global.home.getPath(), 'batch3.txt');

            fs.writeFileSync(file1, 'batch content 1', 'utf-8');
            fs.writeFileSync(file2, 'batch content 2', 'utf-8');
            fs.writeFileSync(file3, 'batch content 3', 'utf-8');

            const links = tara.global.gitst.commitBatch([file1, file2, file3]);

            expect(links).toHaveLength(3);
            expect(links[0].commitHash).toBe(links[1].commitHash);
            expect(links[1].commitHash).toBe(links[2].commitHash);
        });

        it('returns individual links with unique content hashes', () => {
            const file1 = path.join(tara.global.home.getPath(), 'batch1.txt');
            const file2 = path.join(tara.global.home.getPath(), 'batch2.txt');

            fs.writeFileSync(file1, 'content A', 'utf-8');
            fs.writeFileSync(file2, 'content B', 'utf-8');

            const links = tara.global.gitst.commitBatch([file1, file2]);

            expect(links[0].contentHash).not.toBe(links[1].contentHash);
            expect(links[0].recordId).not.toBe(links[1].recordId);
        });

        it('accepts custom message and metadata', () => {
            const file1 = path.join(tara.global.home.getPath(), 'batch1.txt');
            const file2 = path.join(tara.global.home.getPath(), 'batch2.txt');

            fs.writeFileSync(file1, 'content 1', 'utf-8');
            fs.writeFileSync(file2, 'content 2', 'utf-8');

            const links = tara.global.gitst.commitBatch([file1, file2], {
                message: 'Custom batch message',
                metadata: { batch: true }
            });

            expect(links[0].message).toBe('Custom batch message');
            expect(links[1].message).toBe('Custom batch message');
        });

        it('throws error for empty array', () => {
            expect(() => {
                tara.global.gitst.commitBatch([]);
            }).toThrow('filePaths must be a non-empty array');
        });

        it('throws error if any file does not exist', () => {
            const file1 = path.join(tara.global.home.getPath(), 'exists.txt');
            const file2 = path.join(tara.global.home.getPath(), 'nonexistent.txt');

            fs.writeFileSync(file1, 'content', 'utf-8');

            expect(() => {
                tara.global.gitst.commitBatch([file1, file2]);
            }).toThrow('File not found');
        });

        it('throws error if any path is relative', () => {
            expect(() => {
                tara.global.gitst.commitBatch(['relative/path.txt']);
            }).toThrow('Path must be absolute');
        });

        it('creates tape records for all files', async () => {
            const file1 = path.join(tara.global.home.getPath(), 'batch1.txt');
            const file2 = path.join(tara.global.home.getPath(), 'batch2.txt');

            fs.writeFileSync(file1, 'content 1', 'utf-8');
            fs.writeFileSync(file2, 'content 2', 'utf-8');

            const links = tara.global.gitst.commitBatch([file1, file2]);

            const tape = tara.global.tapes.get(tara.global.gitst.getTapeId());
            const foundRecords: string[] = [];

            await tape.readRecords(({ parsed }) => {
                if (parsed.type === 'taralib/git-storage-commit') {
                    const recordId = parsed.__tararecord?.id;
                    if (recordId && links.some(l => l.recordId === recordId)) {
                        foundRecords.push(recordId);
                    }
                }
            });

            expect(foundRecords).toHaveLength(2);
        });
    });

    describe('commitFromRepo', () => {
        let externalRepoPath: string;

        beforeEach(() => {
            // Create an external git repo for testing
            externalRepoPath = path.join(tara.global.home.getPath(), 'external-repo');
            fs.mkdirSync(externalRepoPath, { recursive: true });

            // Initialize git repo
            execSync('git init', { cwd: externalRepoPath, stdio: 'pipe' });

            // Configure git user for commits
            execSync('git config user.email "test@test.com"', { cwd: externalRepoPath, stdio: 'pipe' });
            execSync('git config user.name "Test User"', { cwd: externalRepoPath, stdio: 'pipe' });
        });

        it('commits all tracked files from external repo', () => {
            // Create and track files
            fs.writeFileSync(path.join(externalRepoPath, 'file1.txt'), 'content 1', 'utf-8');
            fs.writeFileSync(path.join(externalRepoPath, 'file2.txt'), 'content 2', 'utf-8');
            execSync('git add .', { cwd: externalRepoPath, stdio: 'pipe' });
            execSync('git commit -m "initial"', { cwd: externalRepoPath, stdio: 'pipe' });

            const links = tara.global.gitst.commitFromRepo(externalRepoPath);

            expect(links).toHaveLength(2);
            expect(links[0].commitHash).toBe(links[1].commitHash); // Same batch commit
        });

        it('respects .gitignore of source repo', () => {
            // Create files
            fs.writeFileSync(path.join(externalRepoPath, 'tracked.txt'), 'tracked', 'utf-8');
            fs.writeFileSync(path.join(externalRepoPath, 'ignored.txt'), 'ignored', 'utf-8');

            // Create .gitignore
            fs.writeFileSync(path.join(externalRepoPath, '.gitignore'), 'ignored.txt\n', 'utf-8');

            // Track files (ignored.txt won't be tracked due to .gitignore)
            execSync('git add .', { cwd: externalRepoPath, stdio: 'pipe' });
            execSync('git commit -m "initial"', { cwd: externalRepoPath, stdio: 'pipe' });

            const links = tara.global.gitst.commitFromRepo(externalRepoPath);

            // Should only commit tracked files (tracked.txt and .gitignore)
            const originalPaths = links.map(l => path.basename(l.originalPath));
            expect(originalPaths).toContain('tracked.txt');
            expect(originalPaths).toContain('.gitignore');
            expect(originalPaths).not.toContain('ignored.txt');
        });

        it('throws error if path does not exist', () => {
            const nonExistentPath = path.join(tara.global.home.getPath(), 'nonexistent');

            expect(() => {
                tara.global.gitst.commitFromRepo(nonExistentPath);
            }).toThrow('Path does not exist');
        });

        it('throws error if path is not a git repo', () => {
            const nonRepoPath = path.join(tara.global.home.getPath(), 'not-a-repo');
            fs.mkdirSync(nonRepoPath, { recursive: true });

            expect(() => {
                tara.global.gitst.commitFromRepo(nonRepoPath);
            }).toThrow('Not a git repository');
        });

        it('filters files by maxFileSizeBytes when provided', () => {
            // Create files of different sizes
            fs.writeFileSync(path.join(externalRepoPath, 'small.txt'), 'small', 'utf-8'); // 5 bytes
            fs.writeFileSync(path.join(externalRepoPath, 'large.txt'), 'x'.repeat(1000), 'utf-8'); // 1000 bytes

            execSync('git add .', { cwd: externalRepoPath, stdio: 'pipe' });
            execSync('git commit -m "initial"', { cwd: externalRepoPath, stdio: 'pipe' });

            const links = tara.global.gitst.commitFromRepo(externalRepoPath, {
                maxFileSizeBytes: 100
            });

            const originalPaths = links.map(l => path.basename(l.originalPath));
            expect(originalPaths).toContain('small.txt');
            expect(originalPaths).not.toContain('large.txt');
        });

        it('includes sourceRepo in metadata', async () => {
            fs.writeFileSync(path.join(externalRepoPath, 'file.txt'), 'content', 'utf-8');
            execSync('git add .', { cwd: externalRepoPath, stdio: 'pipe' });
            execSync('git commit -m "initial"', { cwd: externalRepoPath, stdio: 'pipe' });

            const links = tara.global.gitst.commitFromRepo(externalRepoPath);

            const tape = tara.global.tapes.get(tara.global.gitst.getTapeId());
            let foundSourceRepo = false;

            await tape.readRecords(({ parsed }) => {
                if (parsed.__tararecord?.id === links[0].recordId) {
                    expect(parsed.metadata?.sourceRepo).toBe(externalRepoPath);
                    foundSourceRepo = true;
                    return 'stop';
                }
            });

            expect(foundSourceRepo).toBe(true);
        });

        it('returns empty array for repo with no files', () => {
            // Empty git repo with just initial commit
            fs.writeFileSync(path.join(externalRepoPath, 'temp.txt'), 'temp', 'utf-8');
            execSync('git add .', { cwd: externalRepoPath, stdio: 'pipe' });
            execSync('git commit -m "initial"', { cwd: externalRepoPath, stdio: 'pipe' });

            // Remove file and commit
            fs.unlinkSync(path.join(externalRepoPath, 'temp.txt'));
            execSync('git add .', { cwd: externalRepoPath, stdio: 'pipe' });
            execSync('git commit -m "remove"', { cwd: externalRepoPath, stdio: 'pipe' });

            const links = tara.global.gitst.commitFromRepo(externalRepoPath);

            expect(links).toHaveLength(0);
        });

        it('uses custom message when provided', () => {
            fs.writeFileSync(path.join(externalRepoPath, 'file.txt'), 'content', 'utf-8');
            execSync('git add .', { cwd: externalRepoPath, stdio: 'pipe' });
            execSync('git commit -m "initial"', { cwd: externalRepoPath, stdio: 'pipe' });

            const customMessage = 'My custom backup message';
            const links = tara.global.gitst.commitFromRepo(externalRepoPath, {
                message: customMessage
            });

            expect(links[0].message).toBe(customMessage);
        });

        it('uses default message with repo basename when not provided', () => {
            fs.writeFileSync(path.join(externalRepoPath, 'file.txt'), 'content', 'utf-8');
            execSync('git add .', { cwd: externalRepoPath, stdio: 'pipe' });
            execSync('git commit -m "initial"', { cwd: externalRepoPath, stdio: 'pipe' });

            const links = tara.global.gitst.commitFromRepo(externalRepoPath);

            expect(links[0].message).toBe('gitst: from repo external-repo');
        });

        it('merges custom metadata with sourceRepo', async () => {
            fs.writeFileSync(path.join(externalRepoPath, 'file.txt'), 'content', 'utf-8');
            execSync('git add .', { cwd: externalRepoPath, stdio: 'pipe' });
            execSync('git commit -m "initial"', { cwd: externalRepoPath, stdio: 'pipe' });

            const links = tara.global.gitst.commitFromRepo(externalRepoPath, {
                metadata: { customKey: 'customValue' }
            });

            const tape = tara.global.tapes.get(tara.global.gitst.getTapeId());

            await tape.readRecords(({ parsed }) => {
                if (parsed.__tararecord?.id === links[0].recordId) {
                    expect(parsed.metadata?.customKey).toBe('customValue');
                    expect(parsed.metadata?.sourceRepo).toBe(externalRepoPath);
                    return 'stop';
                }
            });
        });

        it('commits to specified repoId', () => {
            fs.writeFileSync(path.join(externalRepoPath, 'file.txt'), 'content', 'utf-8');
            execSync('git add .', { cwd: externalRepoPath, stdio: 'pipe' });
            execSync('git commit -m "initial"', { cwd: externalRepoPath, stdio: 'pipe' });

            const links = tara.global.gitst.commitFromRepo(externalRepoPath, {
                repoId: 'backup-repo'
            });

            expect(links[0].repoId).toBe('backup-repo');
            expect(links[0].repoPath).toContain('backup-repo');
        });

        it('handles nested directories', () => {
            // Create nested structure
            fs.mkdirSync(path.join(externalRepoPath, 'src', 'utils'), { recursive: true });
            fs.writeFileSync(path.join(externalRepoPath, 'src', 'index.ts'), 'export {}', 'utf-8');
            fs.writeFileSync(path.join(externalRepoPath, 'src', 'utils', 'helper.ts'), 'export {}', 'utf-8');

            execSync('git add .', { cwd: externalRepoPath, stdio: 'pipe' });
            execSync('git commit -m "initial"', { cwd: externalRepoPath, stdio: 'pipe' });

            const links = tara.global.gitst.commitFromRepo(externalRepoPath);

            expect(links).toHaveLength(2);
            const originalPaths = links.map(l => l.originalPath);
            expect(originalPaths.some(p => p.endsWith('index.ts'))).toBe(true);
            expect(originalPaths.some(p => p.endsWith('helper.ts'))).toBe(true);
        });

        it('handles typical node project structure', () => {
            // Create a typical node project structure
            fs.mkdirSync(path.join(externalRepoPath, 'src'), { recursive: true });
            fs.mkdirSync(path.join(externalRepoPath, 'node_modules', 'some-package'), { recursive: true });

            fs.writeFileSync(path.join(externalRepoPath, 'package.json'), '{}', 'utf-8');
            fs.writeFileSync(path.join(externalRepoPath, 'src', 'index.js'), 'console.log("hi")', 'utf-8');
            fs.writeFileSync(path.join(externalRepoPath, 'node_modules', 'some-package', 'index.js'), 'module.exports = {}', 'utf-8');

            // Create .gitignore that ignores node_modules
            fs.writeFileSync(path.join(externalRepoPath, '.gitignore'), 'node_modules/\n', 'utf-8');

            execSync('git add .', { cwd: externalRepoPath, stdio: 'pipe' });
            execSync('git commit -m "initial"', { cwd: externalRepoPath, stdio: 'pipe' });

            const links = tara.global.gitst.commitFromRepo(externalRepoPath);

            const originalPaths = links.map(l => l.originalPath);
            // Should include tracked files
            expect(originalPaths.some(p => p.endsWith('package.json'))).toBe(true);
            expect(originalPaths.some(p => p.endsWith('index.js') && p.includes('src'))).toBe(true);
            // Should NOT include node_modules
            expect(originalPaths.some(p => p.includes('node_modules'))).toBe(false);
        });
    });
});
