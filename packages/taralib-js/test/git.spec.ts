import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ensureTaraHome, getTaraHomePath, GitHandler, refreshSettings } from '../src';
import { setupTestEnv, setupTestHomeDir, teardownTestEnv } from './utils';

describe('git', () => {
    

    let testRepoPath: string;
    let repo: GitHandler;

    beforeEach(() => {

        // setup env
        setupTestEnv();

        // setup repo
        testRepoPath = getTaraHomePath();
        repo = new GitHandler(testRepoPath);

    });

    afterEach(() => {
        // clear env
        teardownTestEnv();
    });

    describe('new GitHandler', () => {
        it('creates a GitHandler instance', () => {
            expect(repo).toBeDefined();
            expect(repo.getRepoPath()).toBe(testRepoPath);
        });

        it('resolves relative paths to absolute paths', () => {
            const relativeRepo = new GitHandler('.');
            expect(path.isAbsolute(relativeRepo.getRepoPath())).toBe(true);
        });
    });

    describe('init', () => {
        it('initializes a new git repository', () => {
            repo.init();
            const gitDir = path.join(testRepoPath, '.git');
            expect(fs.existsSync(gitDir)).toBe(true);
        });

        it('is idempotent - does not error if called multiple times', () => {
            repo.init();
            expect(() => repo.init()).not.toThrow();
        });

        it('validates repository after initialization', () => {
            repo.init();
            // If validation failed, init would throw
            expect(fs.existsSync(path.join(testRepoPath, '.git'))).toBe(true);
        });

        it('creates directory if it does not exist', () => {
            const newRepoPath = path.join(testRepoPath, 'new-repo');
            const newRepo = new GitHandler(newRepoPath);
            expect(fs.existsSync(newRepoPath)).toBe(false);
            newRepo.init();
            expect(fs.existsSync(newRepoPath)).toBe(true);
            expect(fs.existsSync(path.join(newRepoPath, '.git'))).toBe(true);
        });
    });

    describe('commit', () => {
        beforeEach(() => {
            repo.init();
        });

        it('commits changes with a message', () => {
            // Create a test file
            const testFile = path.join(testRepoPath, 'test.txt');
            fs.writeFileSync(testFile, 'test content');

            repo.commit('Add test file');

            // Verify commit was created
            const { execSync } = require('child_process');
            const log = execSync('git log --oneline', { cwd: testRepoPath, encoding: 'utf-8' });
            expect(log).toContain('Add test file');
        });

        it('stages all changes automatically', () => {
            // Create multiple test files
            fs.writeFileSync(path.join(testRepoPath, 'file1.txt'), 'content1');
            fs.writeFileSync(path.join(testRepoPath, 'file2.txt'), 'content2');

            repo.commit('Add multiple files');

            // Verify all files were committed
            const { execSync } = require('child_process');
            const files = execSync('git ls-files', { cwd: testRepoPath, encoding: 'utf-8' });
            expect(files).toContain('file1.txt');
            expect(files).toContain('file2.txt');
        });

        it('is a no-op when there are no changes', () => {
            // Create initial commit
            fs.writeFileSync(path.join(testRepoPath, 'test.txt'), 'content');
            repo.commit('Initial commit');

            // Try to commit again with no changes
            expect(() => repo.commit('Empty commit')).not.toThrow();

            // Verify no new commit was created
            const { execSync } = require('child_process');
            const log = execSync('git log --oneline', { cwd: testRepoPath, encoding: 'utf-8' });
            const commits = log.trim().split('\n');
            expect(commits.length).toBe(1);
        });

        it('escapes quotes in commit messages', () => {
            fs.writeFileSync(path.join(testRepoPath, 'test.txt'), 'content');
            repo.commit('Message with "quotes" inside');

            const { execSync } = require('child_process');
            const log = execSync('git log --oneline', { cwd: testRepoPath, encoding: 'utf-8' });
            expect(log).toContain('Message with "quotes" inside');
        });

        it('throws error if repository is not initialized', () => {
            const uninitRepo = new GitHandler(path.join(os.tmpdir(), `uninit-${Date.now()}`));
            fs.mkdirSync(uninitRepo.getRepoPath());

            expect(() => uninitRepo.commit('Test')).toThrow();

            // Clean up
            fs.rmSync(uninitRepo.getRepoPath(), { recursive: true, force: true });
        });
    });

    describe('checkout', () => {
        beforeEach(() => {
            repo.init();
        });

        it('checks out a specific ref', () => {
            // Create initial commit
            fs.writeFileSync(path.join(testRepoPath, 'test.txt'), 'initial');
            repo.commit('Initial commit');

            // Create a branch and switch to it
            const { execSync } = require('child_process');
            execSync('git checkout -b test-branch', { cwd: testRepoPath });

            // Modify and commit on branch
            fs.writeFileSync(path.join(testRepoPath, 'test.txt'), 'branch content');
            repo.commit('Branch commit');

            // Checkout back to main/master
            const mainBranch = execSync('git rev-parse --abbrev-ref HEAD', {
                cwd: testRepoPath,
                encoding: 'utf-8'
            }).includes('main') ? 'main' : 'master';

            // Switch back to test-branch first, then to main
            const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', {
                cwd: testRepoPath,
                encoding: 'utf-8'
            }).trim();

            if (currentBranch === 'test-branch') {
                // We need to be on main first
                execSync(`git checkout ${mainBranch} 2>/dev/null || git checkout -b ${mainBranch}`, {
                    cwd: testRepoPath
                });
            }

            repo.checkout('test-branch');

            // Verify we're on the branch
            const branch = execSync('git rev-parse --abbrev-ref HEAD', {
                cwd: testRepoPath,
                encoding: 'utf-8'
            }).trim();
            expect(branch).toBe('test-branch');
        });

        it('discards uncommitted changes with force checkout', () => {
            // Create initial commit
            fs.writeFileSync(path.join(testRepoPath, 'test.txt'), 'initial');
            repo.commit('Initial commit');

            // Get the commit hash
            const { execSync } = require('child_process');
            const commitHash = execSync('git rev-parse HEAD', {
                cwd: testRepoPath,
                encoding: 'utf-8'
            }).trim();

            // Make uncommitted changes
            fs.writeFileSync(path.join(testRepoPath, 'test.txt'), 'uncommitted changes');

            // Force checkout (should discard changes)
            repo.checkout(commitHash);

            // Verify changes were discarded
            const content = fs.readFileSync(path.join(testRepoPath, 'test.txt'), 'utf-8');
            expect(content).toBe('initial');
        });

        it('throws error for invalid ref', () => {
            fs.writeFileSync(path.join(testRepoPath, 'test.txt'), 'content');
            repo.commit('Initial commit');

            expect(() => repo.checkout('non-existent-branch')).toThrow();
        });

        it('throws error if repository is not initialized', () => {
            const uninitRepo = new GitHandler(path.join(os.tmpdir(), `uninit-${Date.now()}`));
            fs.mkdirSync(uninitRepo.getRepoPath());

            expect(() => uninitRepo.checkout('main')).toThrow();

            // Clean up
            fs.rmSync(uninitRepo.getRepoPath(), { recursive: true, force: true });
        });
    });

    describe('validation', () => {
        it('validates repository path on commit', () => {
            repo.init();

            // Create a subdirectory
            const subDir = path.join(testRepoPath, 'subdir');
            fs.mkdirSync(subDir);

            // Try to use the subdirectory as repo path
            const subRepo = new GitHandler(subDir);

            // Validation should pass because subdir is within the initialized repo
            fs.writeFileSync(path.join(subDir, 'test.txt'), 'content');

            // This should throw because the repo path doesn't match the git root
            expect(() => subRepo.commit('Test')).toThrow(/validation failed/i);
        });

        it('validates repository path on checkout', () => {
            repo.init();

            const subDir = path.join(testRepoPath, 'subdir');
            fs.mkdirSync(subDir);

            const subRepo = new GitHandler(subDir);

            expect(() => subRepo.checkout('main')).toThrow(/validation failed/i);
        });
    });

    describe('error handling', () => {
        it('provides meaningful error messages for git failures', () => {
            repo.init();

            // Try to checkout non-existent ref
            try {
                repo.checkout('non-existent-ref');
                expect.fail('Should have thrown an error');
            } catch (error: any) {
                expect(error.message).toContain('Git command failed');
            }
        });

        it('handles invalid repository path gracefully', () => {
            const invalidRepo = new GitHandler('/invalid/path/that/does/not/exist');

            expect(() => invalidRepo.commit('Test')).toThrow();
        });
    });
});
