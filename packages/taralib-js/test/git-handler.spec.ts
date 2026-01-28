import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { GitHandler } from '../src/base/git-handler';

describe('GitHandler', () => {
    let tempDir: string;
    let gitHandler: GitHandler;

    beforeEach(() => {
        // Create a temporary directory for testing
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-handler-test-'));
        gitHandler = new GitHandler(tempDir);
    });

    afterEach(() => {
        // Clean up temporary directory
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    describe('constructor and getRepoPath', () => {
        it('should create a GitHandler instance with the given path', () => {
            expect(gitHandler.getRepoPath()).toBe(tempDir);
        });

        it('should resolve relative paths to absolute paths', () => {
            const relativeHandler = new GitHandler('./test-repo');
            expect(path.isAbsolute(relativeHandler.getRepoPath())).toBe(true);
        });
    });

    describe('checkInsideWorkingTree', () => {
        it('should return false for a non-git directory', () => {
            expect(gitHandler.checkInsideWorkingTree()).toBe(false);
        });

        it('should return true after instanciate()', () => {
            gitHandler.instanciate();
            expect(gitHandler.checkInsideWorkingTree()).toBe(true);
        });
    });

    describe('instanciate', () => {
        it('should initialize a git repository', () => {
            gitHandler.instanciate();
            expect(gitHandler.checkInsideWorkingTree()).toBe(true);
            expect(fs.existsSync(path.join(tempDir, '.git'))).toBe(true);
        });

        it('should create directory if it does not exist', () => {
            const nonExistentPath = path.join(tempDir, 'new-repo');
            const newHandler = new GitHandler(nonExistentPath);
            
            expect(fs.existsSync(nonExistentPath)).toBe(false);
            newHandler.instanciate();
            expect(fs.existsSync(nonExistentPath)).toBe(true);
            expect(newHandler.checkInsideWorkingTree()).toBe(true);
            
            // Cleanup
            fs.rmSync(nonExistentPath, { recursive: true, force: true });
        });

        it('should not fail if already initialized', () => {
            gitHandler.instanciate();
            expect(() => gitHandler.instanciate()).not.toThrow();
        });
    });

    describe('execCmdSync', () => {
        it('should throw error if not in a git working tree', () => {
            expect(() => gitHandler.execCmdSync('status')).toThrow('Not inside a git working tree');
        });

        it('should execute git commands successfully', () => {
            gitHandler.instanciate();
            const result = gitHandler.execCmdSync('status');
            expect(result).toContain('On branch');
        });

        it('should execute git rev-parse --show-toplevel', () => {
            gitHandler.instanciate();
            const result = gitHandler.execCmdSync('rev-parse --show-toplevel');
            expect(fs.realpathSync(result)).toBe(fs.realpathSync(tempDir));
        });

        it('should throw error for invalid git commands', () => {
            gitHandler.instanciate();
            expect(() => gitHandler.execCmdSync('invalid-command')).toThrow('Git command failed');
        });
    });

    describe('execCmdAsync', () => {
        it('should throw error if not in a git working tree', async () => {
            await expect(gitHandler.execCmdAsync('status')).rejects.toThrow('Not inside a git working tree');
        });

        it('should execute git commands successfully', async () => {
            gitHandler.instanciate();
            const result = await gitHandler.execCmdAsync('status');
            expect(result).toContain('On branch');
        });

        it('should execute git rev-parse --show-toplevel', async () => {
            gitHandler.instanciate();
            const result = await gitHandler.execCmdAsync('rev-parse --show-toplevel');
            expect(fs.realpathSync(result)).toBe(fs.realpathSync(tempDir));
        });

        it('should throw error for invalid git commands', async () => {
            gitHandler.instanciate();
            await expect(gitHandler.execCmdAsync('invalid-command')).rejects.toThrow('Git command failed');
        });
    });
});
