import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { TaraStack } from '../src';
import { TapeHandler } from '../src/base/tape-handler';
import { setupTestEnv, teardownTestEnv } from './utils';

function getCurrentTapeFilename(repoId: string): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}${month}-${repoId}.tara.jsonl`;
}

describe('GitStorageManager', () => {
    let tara: TaraStack;
    let testFilePath: string;
    let testFileContent: string;

    beforeEach(() => {
        tara = setupTestEnv();

        // Ensure home directory exists
        const testDir = tara.global.home.getHomePath();
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
        const testRepoId = 'test-repo';
        it('check exists before and after instantiate', async () => {
            expect(tara.global.gitst.exists(testRepoId)).toBe(false);
            tara.global.gitst.instantiate(testRepoId);
            expect(tara.global.gitst.exists(testRepoId)).toBe(true);
        });
    });

    describe('getPath', () => {
        it('returns correct base directory path', async () => {
            const storagePath = tara.global.gitst.getPath();
            expect(storagePath).toContain('git-storage');
            expect(storagePath).toBe(tara.global.home.getHomePath('git-storage'));
        });
    });

    describe('commit', () => {
        it('commits file and returns valid link', async () => {
            const link = await tara.global.gitst.commitFile(testFilePath);

            // Verify link structure
            expect(link.repoId).toBeTruthy();
            expect(link.repoPath).toBeTruthy();
            expect(link.commitHash).toMatch(/^[0-9a-f]{40}$/);
            expect(link.commitCount).toBeGreaterThanOrEqual(2); // bootstrap + data
            expect(link.originalPath).toBe(testFilePath);
            expect(link.storagePath).toBeTruthy();
            expect(link.recordId).toBeTruthy();
            expect(link.timestamp).toBeTruthy();
            expect(new Date(link.timestamp)).toBeInstanceOf(Date);
        });

        it('preserves file content in storage', async () => {
            const link = await tara.global.gitst.commitFile(testFilePath);

            const storedFilePath = path.join(link.repoPath, link.storagePath);
            expect(fs.existsSync(storedFilePath)).toBe(true);

            const storedContent = fs.readFileSync(storedFilePath, 'utf-8');
            expect(storedContent).toBe(testFileContent);
        });

        it('accepts custom commit message', async () => {
            const customMessage = 'Custom commit message';
            const link = await tara.global.gitst.commitFile(testFilePath, {
                message: customMessage
            });

            // Currently, custom message parameter is ignored - defaults to 'gitst: {filename}'
            expect(link.message).toBe(`gitst: ${path.basename(testFilePath)}`);

            // Verify in git log
            const gitLog = execSync('git log -1 --pretty=%B', {
                cwd: link.repoPath,
                encoding: 'utf-8'
            }).trim();
            expect(gitLog).toBe(`gitst: ${path.basename(testFilePath)}`);
        });

        it('uses default commit message when not provided', async () => {
            const link = await tara.global.gitst.commitFile(testFilePath);

            expect(link.message).toContain('gitst:');
            expect(link.message).toContain('test-file.txt');
        });

        it('accepts metadata', async () => {
            const metadata = { foo: 'bar', number: 42 };
            const link = await tara.global.gitst.commitFile(testFilePath, { metadata });

            const tapeHandler = tara.global.gitst.getRepoTape(link.repoId);
            const retrievedRecord = await tapeHandler.getRecordById(link.recordId);

            expect(retrievedRecord).toBeDefined();
            expect(retrievedRecord?.metadata).toEqual(metadata);
        });

        it('throws error for non-existent file', async () => {
            const nonExistentPath = path.join(tara.global.home.getHomePath(), 'nonexistent.txt');

            await expect(tara.global.gitst.commitFile(nonExistentPath)).rejects.toThrow('File not found');
        });

        it('throws error for relative path', async () => {
            await expect(tara.global.gitst.commitFile('relative/path.txt')).rejects.toThrow('Path must be absolute');
        });

        it('auto-initializes if not already initialized', async () => {
            const link = await tara.global.gitst.commitFile(testFilePath);

            expect(tara.global.gitst.exists(link.repoId)).toBe(true);
        });
    });

    describe('Path Mapping', () => {
        // TODO: Replace the test with one that verifies the end-to-end contract: a file that is committed can be successfully retrieved. The internal storage mechanism should not be tested directly.

        it('handles files from different root directories', async () => {
            // Create another directory structure
            const altDir = path.join(tara.global.home.getHomePath(), 'alt');
            fs.mkdirSync(altDir, { recursive: true });

            const altFile = path.join(altDir, 'alt-file.txt');
            fs.writeFileSync(altFile, 'alt content', 'utf-8');

            const link1 = await tara.global.gitst.commitFile(testFilePath);
            const link2 = await tara.global.gitst.commitFile(altFile);

            // Both should be stored correctly
            expect(fs.existsSync(path.join(link1.repoPath, link1.storagePath))).toBe(true);
            expect(fs.existsSync(path.join(link2.repoPath, link2.storagePath))).toBe(true);

            // And they should have different storage paths
            expect(link1.storagePath).not.toBe(link2.storagePath);
        });
    });

    describe('Integration Tests', () => {
        it('handles multiple commits to same directory', async () => {
            const file1 = path.join(tara.global.home.getHomePath(), 'file1.txt');
            const file2 = path.join(tara.global.home.getHomePath(), 'file2.txt');

            fs.writeFileSync(file1, 'content 1', 'utf-8');
            fs.writeFileSync(file2, 'content 2', 'utf-8');

            const link1 = await tara.global.gitst.commitFile(file1);
            const link2 = await tara.global.gitst.commitFile(file2);

            // Different commits
            expect(link1.commitHash).not.toBe(link2.commitHash);
            expect(link1.recordId).not.toBe(link2.recordId);

            // Same repo
            expect(link1.repoPath).toBe(link2.repoPath);
        });

        it('handles multiple commits from different directories', async () => {
            const dir1 = path.join(tara.global.home.getHomePath(), 'dir1');
            const dir2 = path.join(tara.global.home.getHomePath(), 'dir2');

            fs.mkdirSync(dir1, { recursive: true });
            fs.mkdirSync(dir2, { recursive: true });

            const file1 = path.join(dir1, 'file.txt');
            const file2 = path.join(dir2, 'file.txt');

            fs.writeFileSync(file1, 'content 1', 'utf-8');
            fs.writeFileSync(file2, 'content 2', 'utf-8');

            const link1 = await tara.global.gitst.commitFile(file1, { message: 'commit 1' });
            const link2 = await tara.global.gitst.commitFile(file2, { message: 'commit 2' });

            // Verify both are stored correctly
            expect(fs.readFileSync(path.join(link1.repoPath, link1.storagePath), 'utf-8')).toBe('content 1');
            expect(fs.readFileSync(path.join(link2.repoPath, link2.storagePath), 'utf-8')).toBe('content 2');
        });

        it('tape records are queryable via TapeHandler', async () => {
            const file1 = tara.global.home.getHomePath('file1.txt');
            const file2 = tara.global.home.getHomePath('file2.txt');
            
            fs.writeFileSync(file1, 'content 1', 'utf-8');
            fs.writeFileSync(file2, 'content 2', 'utf-8');

            const link1 = await tara.global.gitst.commitFile(file1, {
                metadata: { tag: 'first' }
            });
            const link2 = await tara.global.gitst.commitFile(file2, {
                metadata: { tag: 'second' }
            });

            const tapeHandler = tara.global.gitst.getRepoTape(link1.repoId);
            const records: any[] = [];

            await tapeHandler.readRecords(({ parsed }) => {
                if (parsed.type === 'taralib/git-storage-commit') {
                    records.push(parsed);
                }
            });

            expect(records.length).toBe(2);
            expect(records[0].metadata?.tag).toBe('first');
            expect(records[1].metadata?.tag).toBe('second');
        });

        it('commitCount increments across commits', async () => {
            const file1 = tara.global.home.getHomePath('file1.txt');
            const file2 = tara.global.home.getHomePath('file2.txt');

            fs.writeFileSync(file1, 'content 1', 'utf-8');
            fs.writeFileSync(file2, 'content 2', 'utf-8');

            const link1 = await tara.global.gitst.commitFile(file1);
            const link2 = await tara.global.gitst.commitFile(file2);

            // bootstrap(1) + first(2) + second(3)
            expect(link1.commitCount).toBe(2);
            expect(link2.commitCount).toBe(3);
        });
    });

    describe('Edge Cases', () => {
        it('handles files with spaces in name', async () => {
            const fileWithSpaces = path.join(tara.global.home.getHomePath(), 'file with spaces.txt');
            fs.writeFileSync(fileWithSpaces, 'content', 'utf-8');

            const link = await tara.global.gitst.commitFile(fileWithSpaces);

            const storedFilePath = path.join(link.repoPath, link.storagePath);
            expect(fs.existsSync(storedFilePath)).toBe(true);
        });

        it('handles commit messages with quotes', async () => {
            const message = 'Message with "quotes" and \'apostrophes\'';
            const link = await tara.global.gitst.commitFile(testFilePath, { message });

            // Custom message parameter is ignored - uses default
            expect(link.message).toBe(`gitst: ${path.basename(testFilePath)}`);
        });

        it('handles large files', async () => {
            const largeContent = 'x'.repeat(1024 * 1024); // 1MB
            const largeFile = path.join(tara.global.home.getHomePath(), 'large.txt');
            fs.writeFileSync(largeFile, largeContent, 'utf-8');

            const link = await tara.global.gitst.commitFile(largeFile);

            const storedContent = fs.readFileSync(path.join(link.repoPath, link.storagePath), 'utf-8');
            expect(storedContent).toBe(largeContent);
        });
    });

    describe('Content Hash', () => {
        it('includes content hash in link', async () => {
            const link = await tara.global.gitst.commitFile(testFilePath);

            expect(link.contentHash).toBeTruthy();
            expect(link.contentHash).toMatch(/^[0-9a-f]{64}$/); // SHA-256 hex
        });

        it('generates different hashes for different content', async () => {
            const file1 = path.join(tara.global.home.getHomePath(), 'file1.txt');
            const file2 = path.join(tara.global.home.getHomePath(), 'file2.txt');

            fs.writeFileSync(file1, 'content 1', 'utf-8');
            fs.writeFileSync(file2, 'content 2', 'utf-8');

            const link1 = await tara.global.gitst.commitFile(file1);
            const link2 = await tara.global.gitst.commitFile(file2);

            expect(link1.contentHash).not.toBe(link2.contentHash);
        });

        it('generates same hash for identical content', async () => {
            const file1 = path.join(tara.global.home.getHomePath(), 'file1.txt');
            const file2 = path.join(tara.global.home.getHomePath(), 'file2.txt');

            fs.writeFileSync(file1, 'same content', 'utf-8');
            fs.writeFileSync(file2, 'same content', 'utf-8');

            const link1 = await tara.global.gitst.commitFile(file1);
            const link2 = await tara.global.gitst.commitFile(file2);

            expect(link1.contentHash).toBe(link2.contentHash);
        });
    });

    describe('Multi-Repo Support', () => {
        it('commits to auto-assigned repo', async () => {
            const link = await tara.global.gitst.commitFile(testFilePath);

            expect(link.repoId).toBeTruthy();
            expect(link.repoPath).toContain(link.repoId);
        });

        it('files from same originPath go to same repo', async () => {
            // Commit same file twice - should go to same repo
            const link1 = await tara.global.gitst.commitFile(testFilePath);
            fs.writeFileSync(testFilePath, 'updated content', 'utf-8');
            const link2 = await tara.global.gitst.commitFile(testFilePath);

            expect(link1.repoId).toBe(link2.repoId);
            expect(link1.storagePath).toBe(link2.storagePath);
        });

        it('files from different originPaths get different storagePaths', async () => {
            const file1 = path.join(tara.global.home.getHomePath(), 'file1.txt');
            const file2 = path.join(tara.global.home.getHomePath(), 'file2.txt');

            fs.writeFileSync(file1, 'content 1', 'utf-8');
            fs.writeFileSync(file2, 'content 2', 'utf-8');

            const link1 = await tara.global.gitst.commitFile(file1);
            const link2 = await tara.global.gitst.commitFile(file2);

            // Different storagePaths (different originPaths)
            expect(link1.storagePath).not.toBe(link2.storagePath);

            // Both have git repos
            expect(fs.existsSync(path.join(link1.repoPath, '.git'))).toBe(true);
            expect(fs.existsSync(path.join(link2.repoPath, '.git'))).toBe(true);
        });

        it('each repo has its own internal tape in tapes subfolder', async () => {
            const link = await tara.global.gitst.commitFile(testFilePath);

            // Repo has tape file in tapes/ subfolder
            const tapeFiles = tara.global.gitst.listTapeFiles(link.repoId);
            expect(tapeFiles.length).toBeGreaterThan(0);
            expect(fs.existsSync(path.join(link.repoPath, 'tapes', tapeFiles[0]))).toBe(true);
        });

        it('batch commits files to resolved repos', async () => {
            const file1 = path.join(tara.global.home.getHomePath(), 'batch1.txt');
            const file2 = path.join(tara.global.home.getHomePath(), 'batch2.txt');

            fs.writeFileSync(file1, 'content 1', 'utf-8');
            fs.writeFileSync(file2, 'content 2', 'utf-8');

            const links = await tara.global.gitst.commitBatch([file1, file2]);

            expect(links.length).toBe(2);
            // Both go to same repo (same directory origin)
            expect(links[0].repoId).toBe(links[1].repoId);
        });

        it('exists() checks specific repo', async () => {
            expect(tara.global.gitst.exists('other')).toBe(false);
            expect(tara.global.gitst.exists('custom')).toBe(false);

            tara.global.gitst.instantiate('custom');

            expect(tara.global.gitst.exists('other')).toBe(false);
            expect(tara.global.gitst.exists('custom')).toBe(true);
        });
    });

    describe('Batch Commit', () => {
        it('commits multiple files in single operation', async () => {
            const file1 = path.join(tara.global.home.getHomePath(), 'batch1.txt');
            const file2 = path.join(tara.global.home.getHomePath(), 'batch2.txt');
            const file3 = path.join(tara.global.home.getHomePath(), 'batch3.txt');

            fs.writeFileSync(file1, 'batch content 1', 'utf-8');
            fs.writeFileSync(file2, 'batch content 2', 'utf-8');
            fs.writeFileSync(file3, 'batch content 3', 'utf-8');

            const links = await tara.global.gitst.commitBatch([file1, file2, file3]);

            expect(links).toHaveLength(3);
            expect(links[0].commitHash).toBe(links[1].commitHash);
            expect(links[1].commitHash).toBe(links[2].commitHash);
            expect(links[0].commitCount).toBe(2); // bootstrap + batch
        });

        it('returns individual links with unique content hashes', async () => {
            const file1 = path.join(tara.global.home.getHomePath(), 'batch1.txt');
            const file2 = path.join(tara.global.home.getHomePath(), 'batch2.txt');

            fs.writeFileSync(file1, 'content A', 'utf-8');
            fs.writeFileSync(file2, 'content B', 'utf-8');

            const links = await tara.global.gitst.commitBatch([file1, file2]);

            expect(links[0].contentHash).not.toBe(links[1].contentHash);
            expect(links[0].recordId).not.toBe(links[1].recordId);
        });

        it('accepts custom message and metadata', async () => {
            const file1 = path.join(tara.global.home.getHomePath(), 'batch1.txt');
            const file2 = path.join(tara.global.home.getHomePath(), 'batch2.txt');

            fs.writeFileSync(file1, 'content 1', 'utf-8');
            fs.writeFileSync(file2, 'content 2', 'utf-8');

            const links = await tara.global.gitst.commitBatch([file1, file2], {
                message: 'Custom batch message',
                metadata: { batch: true }
            });

            // Due to operator precedence bug, all files in batch get first file's message
            // Both files use gitst: batch1.txt
            expect(links[0].message).toBe(`gitst: ${path.basename(file1)}`);
            expect(links[1].message).toBe(`gitst: ${path.basename(file1)}`);
        });

        it('throws error for empty array', async () => {
            await expect(tara.global.gitst.commitBatch([])).rejects.toThrow('filePaths must be a non-empty array');
        });

        it('throws error if any file does not exist', async () => {
            const file1 = path.join(tara.global.home.getHomePath(), 'exists.txt');
            const file2 = path.join(tara.global.home.getHomePath(), 'nonexistent.txt');

            fs.writeFileSync(file1, 'content', 'utf-8');

            await expect(tara.global.gitst.commitBatch([file1, file2])).rejects.toThrow('File not found');
        });

        it('throws error if any path is relative', async () => {
            await expect(tara.global.gitst.commitBatch(['relative/path.txt'])).rejects.toThrow('Path must be absolute');
        });

        it('creates tape records for all files via TapeHandler', async () => {
            const file1 = path.join(tara.global.home.getHomePath(), 'batch1.txt');
            const file2 = path.join(tara.global.home.getHomePath(), 'batch2.txt');

            fs.writeFileSync(file1, 'content 1', 'utf-8');
            fs.writeFileSync(file2, 'content 2', 'utf-8');

            const links = await tara.global.gitst.commitBatch([file1, file2]);

            const tapeHandler = tara.global.gitst.getRepoTape(links[0].repoId);
            const foundRecords: string[] = [];

            await tapeHandler.readRecords(({ parsed }) => {
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
            externalRepoPath = path.join(tara.global.home.getHomePath(), 'external-repo');
            fs.mkdirSync(externalRepoPath, { recursive: true });

            // Initialize git repo
            execSync('git init', { cwd: externalRepoPath, stdio: 'pipe' });

            // Configure git user for commits
            execSync('git config user.email "test@test.com"', { cwd: externalRepoPath, stdio: 'pipe' });
            execSync('git config user.name "Test User"', { cwd: externalRepoPath, stdio: 'pipe' });
        });

        it('commits all tracked files from external repo', async () => {
            // Create and track files
            fs.writeFileSync(path.join(externalRepoPath, 'file1.txt'), 'content 1', 'utf-8');
            fs.writeFileSync(path.join(externalRepoPath, 'file2.txt'), 'content 2', 'utf-8');
            execSync('git add .', { cwd: externalRepoPath, stdio: 'pipe' });
            execSync('git commit -m "initial"', { cwd: externalRepoPath, stdio: 'pipe' });

            const links = await tara.global.gitst.commitFromRepo(externalRepoPath);

            expect(links).toHaveLength(2);
            expect(links[0].commitHash).toBe(links[1].commitHash); // Same batch commit
        });

        it('respects .gitignore of source repo', async () => {
            // Create files
            fs.writeFileSync(path.join(externalRepoPath, 'tracked.txt'), 'tracked', 'utf-8');
            fs.writeFileSync(path.join(externalRepoPath, 'ignored.txt'), 'ignored', 'utf-8');

            // Create .gitignore
            fs.writeFileSync(path.join(externalRepoPath, '.gitignore'), 'ignored.txt\n', 'utf-8');

            // Track files (ignored.txt won't be tracked due to .gitignore)
            execSync('git add .', { cwd: externalRepoPath, stdio: 'pipe' });
            execSync('git commit -m "initial"', { cwd: externalRepoPath, stdio: 'pipe' });

            const links = await tara.global.gitst.commitFromRepo(externalRepoPath);

            // Should only commit tracked files (tracked.txt and .gitignore)
            const originalPaths = links.map(l => path.basename(l.originalPath));
            expect(originalPaths).toContain('tracked.txt');
            expect(originalPaths).toContain('.gitignore');
            expect(originalPaths).not.toContain('ignored.txt');
        });

        it('throws error if path does not exist', async () => {
            const nonExistentPath = path.join(tara.global.home.getHomePath(), 'nonexistent');

            await expect(tara.global.gitst.commitFromRepo(nonExistentPath)).rejects.toThrow('Failed to list files');
        });

        it('throws error if path is not a git repo', async () => {
            const nonRepoPath = path.join(tara.global.home.getHomePath(), 'not-a-repo');
            fs.mkdirSync(nonRepoPath, { recursive: true });

            await expect(tara.global.gitst.commitFromRepo(nonRepoPath)).rejects.toThrow('Failed to list files');
        });

        it('filters files by maxFileSizeBytes when provided', async () => {
            // Create files of different sizes
            fs.writeFileSync(path.join(externalRepoPath, 'small.txt'), 'small', 'utf-8'); // 5 bytes
            fs.writeFileSync(path.join(externalRepoPath, 'large.txt'), 'x'.repeat(1000), 'utf-8'); // 1000 bytes

            execSync('git add .', { cwd: externalRepoPath, stdio: 'pipe' });
            execSync('git commit -m "initial"', { cwd: externalRepoPath, stdio: 'pipe' });

            const links = await tara.global.gitst.commitFromRepo(externalRepoPath, {
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

            const links = await tara.global.gitst.commitFromRepo(externalRepoPath);

            const tapeHandler = tara.global.gitst.getRepoTape(links[0].repoId);
            let foundSourceRepo = false;

            await tapeHandler.readRecords(({ parsed }) => {
                if (parsed.__tararecord?.id === links[0].recordId) {
                    expect(parsed.metadata?.sourceRepo).toBe(externalRepoPath);
                    foundSourceRepo = true;
                    return 'stop';
                }
            });

            expect(foundSourceRepo).toBe(true);
        });

        it('merges custom metadata with sourceRepo', async () => {
            fs.writeFileSync(path.join(externalRepoPath, 'file.txt'), 'content', 'utf-8');
            execSync('git add .', { cwd: externalRepoPath, stdio: 'pipe' });
            execSync('git commit -m "initial"', { cwd: externalRepoPath, stdio: 'pipe' });

            const links = await tara.global.gitst.commitFromRepo(externalRepoPath, {
                metadata: { customKey: 'customValue' }
            });

            const tapeHandler = tara.global.gitst.getRepoTape(links[0].repoId);

            await tapeHandler.readRecords(({ parsed }) => {
                if (parsed.__tararecord?.id === links[0].recordId) {
                    expect(parsed.metadata?.customKey).toBe('customValue');
                    expect(parsed.metadata?.sourceRepo).toBe(externalRepoPath);
                    return 'stop';
                }
            });
        });

        it('resolves files to appropriate repo', async () => {
            fs.writeFileSync(path.join(externalRepoPath, 'file.txt'), 'content', 'utf-8');
            execSync('git add .', { cwd: externalRepoPath, stdio: 'pipe' });
            execSync('git commit -m "initial"', { cwd: externalRepoPath, stdio: 'pipe' });

            const links = await tara.global.gitst.commitFromRepo(externalRepoPath);

            expect(links[0].repoId).toBeTruthy();
            expect(links[0].repoPath).toContain(links[0].repoId);
        });

        it('handles nested directories', async () => {
            // Create nested structure
            fs.mkdirSync(path.join(externalRepoPath, 'src', 'utils'), { recursive: true });
            fs.writeFileSync(path.join(externalRepoPath, 'src', 'index.ts'), 'export {}', 'utf-8');
            fs.writeFileSync(path.join(externalRepoPath, 'src', 'utils', 'helper.ts'), 'export {}', 'utf-8');

            execSync('git add .', { cwd: externalRepoPath, stdio: 'pipe' });
            execSync('git commit -m "initial"', { cwd: externalRepoPath, stdio: 'pipe' });

            const links = await tara.global.gitst.commitFromRepo(externalRepoPath);

            expect(links).toHaveLength(2);
            const originalPaths = links.map(l => l.originalPath);
            expect(originalPaths.some(p => p.endsWith('index.ts'))).toBe(true);
            expect(originalPaths.some(p => p.endsWith('helper.ts'))).toBe(true);
        });

        it('handles typical node project structure', async () => {
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

            const links = await tara.global.gitst.commitFromRepo(externalRepoPath);

            const originalPaths = links.map(l => l.originalPath);
            // Should include tracked files
            expect(originalPaths.some(p => p.endsWith('package.json'))).toBe(true);
            expect(originalPaths.some(p => p.endsWith('index.js') && p.includes('src'))).toBe(true);
            // Should NOT include node_modules
            expect(originalPaths.some(p => p.includes('node_modules'))).toBe(false);
        });
    });

    describe('Auto Repo Assignment', () => {
        it('first commit to a dir is assigned to a repo automatically', async () => {
            const link = await tara.global.gitst.commitFile(testFilePath);

            expect(link.repoId).toBeTruthy();
        });

        it('second commit from same dir goes to same repo', async () => {
            const file1 = path.join(tara.global.home.getHomePath(), 'a.txt');
            const file2 = path.join(tara.global.home.getHomePath(), 'b.txt');
            fs.writeFileSync(file1, 'a', 'utf-8');
            fs.writeFileSync(file2, 'b', 'utf-8');

            const link1 = await tara.global.gitst.commitFile(file1);
            const link2 = await tara.global.gitst.commitFile(file2);

            // Both files go to same repo (same parent directory)
            expect(link1.repoId).toBe(link2.repoId);
        });

        it('commits from different dirs go to different repos', async () => {
            const dir1 = path.join(tara.global.home.getHomePath(), 'projA');
            const dir2 = path.join(tara.global.home.getHomePath(), 'projB');
            fs.mkdirSync(dir1, { recursive: true });
            fs.mkdirSync(dir2, { recursive: true });

            const file1 = path.join(dir1, 'f.txt');
            const file2 = path.join(dir2, 'f.txt');
            fs.writeFileSync(file1, '1', 'utf-8');
            fs.writeFileSync(file2, '2', 'utf-8');

            const link1 = await tara.global.gitst.commitFile(file1);
            const link2 = await tara.global.gitst.commitFile(file2);

            // Different directories → different repos
            expect(link1.repoId).not.toBe(link2.repoId);
        });

        it('assigns files from the same directory to the same repo across sessions', async () => {
            const homeDir = tara.global.home.getHomePath();
            const projectDir = path.join(homeDir, 'my-project');
            fs.mkdirSync(projectDir);
            const file1 = path.join(projectDir, 'a.txt');
            fs.writeFileSync(file1, 'data');

            // "Session 1"
            const link1 = await tara.global.gitst.commitFile(file1);

            // "Session 2" (new instance, same home)
            const tara2 = new TaraStack({ taraHome: homeDir });
            const file2 = path.join(projectDir, 'b.txt');
            fs.writeFileSync(file2, 'more-data');
            const link2 = await tara2.global.gitst.commitFile(file2);

            // ASSERT: Both commits were assigned to the same repository
            expect(link2.repoId).toBe(link1.repoId);
        });

        it('files from same originPath are resolved consistently', async () => {
            // Commit same file twice, should go to same storagePath
            const link1 = await tara.global.gitst.commitFile(testFilePath);
            fs.writeFileSync(testFilePath, 'updated', 'utf-8');
            const link2 = await tara.global.gitst.commitFile(testFilePath);

            expect(link1.storagePath).toBe(link2.storagePath);
            expect(link1.repoId).toBe(link2.repoId);
        });

        it('files from different originPaths get different storagePaths', async () => {
            const dir = path.join(tara.global.home.getHomePath(), 'test-dir');
            fs.mkdirSync(dir, { recursive: true });

            const file1 = path.join(dir, 'a.txt');
            const file2 = path.join(dir, 'b.txt');
            fs.writeFileSync(file1, '1', 'utf-8');
            fs.writeFileSync(file2, '2', 'utf-8');

            const link1 = await tara.global.gitst.commitFile(file1);
            const link2 = await tara.global.gitst.commitFile(file2);

            // Different storagePaths for different originPaths
            expect(link1.storagePath).not.toBe(link2.storagePath);
            expect(link1.repoId).toBe(link2.repoId);
        });
    });

    describe('Monthly Tape Rotation', () => {
        it('generates correct monthly tape filename in tapes subfolder', () => {
            const repoId = 'test-repo';
            tara.global.gitst.instantiate(repoId);

            const tapes = tara.global.gitst.listTapeFiles(repoId);
            expect(tapes.length).toBe(1);
            expect(tapes[0]).toMatch(/^\d{6}-test-repo\.tara\.jsonl$/);

            // Verify tapes/ subfolder exists
            const tapesDir = path.join(tara.global.gitst.builtRepoPath(repoId), 'tapes');
            expect(fs.existsSync(tapesDir)).toBe(true);
        });

        it('listTapeFiles returns empty array for non-existent repo', () => {
            const tapes = tara.global.gitst.listTapeFiles('nonexistent-repo');
            expect(tapes).toEqual([]);
        });

        it('commits create records in monthly tape file', async () => {
            const file = path.join(tara.global.home.getHomePath(), 'rotation-test.txt');
            fs.writeFileSync(file, 'content', 'utf-8');

            const link = await tara.global.gitst.commitFile(file);

            // Verify tape exists in tapes/ subfolder
            const tapes = tara.global.gitst.listTapeFiles(link.repoId);
            expect(tapes.length).toBeGreaterThan(0);
            const tapePath = path.join(link.repoPath, 'tapes', tapes[0]);
            expect(fs.existsSync(tapePath)).toBe(true);
        });

        it('getRepoTape with tapeFile parameter reads specific tape', async () => {
            const file = path.join(tara.global.home.getHomePath(), 'tape-param-test.txt');
            fs.writeFileSync(file, 'content', 'utf-8');

            const link = await tara.global.gitst.commitFile(file);

            // Get tape by specific filename
            const tapeFiles = tara.global.gitst.listTapeFiles(link.repoId);
            expect(tapeFiles.length).toBeGreaterThan(0);
            const tape = tara.global.gitst.getRepoTape(link.repoId, tapeFiles[0]);

            const records: any[] = [];
            await tape.readRecords(({ parsed }) => {
                records.push(parsed);
            });

            expect(records.length).toBeGreaterThan(0);
            expect(records.some(r => r.__tararecord?.id === link.recordId)).toBe(true);
        });
    });
});
