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

    describe('execCmd', () => {
        const cases = [
            {
                name: 'sync',
                fn: (cmd: string) => gitHandler.execCmdSync(cmd)
            },
            {
                name: 'async',
                fn: (cmd: string) => gitHandler.execCmdAsync(cmd)
            }
        ];

        for (const { name, fn } of cases) {
            describe(name, () => {
                it('should throw error if not in a git working tree', async () => {
                    if (name === 'async') {
                        await expect(fn('status')).rejects.toThrow('Not inside a git working tree');
                    } else {
                        expect(() => fn('status')).toThrow('Not inside a git working tree');
                    }
                });

                it('should execute git rev-parse --show-toplevel', async () => {
                    gitHandler.instanciate();
                    const result = await fn('rev-parse --show-toplevel');
                    expect(fs.realpathSync(result as string)).toBe(fs.realpathSync(tempDir));
                });

                it('should throw error for invalid git commands', async () => {
                    gitHandler.instanciate();
                    if (name === 'async') {
                        await expect(fn('invalid-command')).rejects.toThrow('Git command failed');
                    } else {
                        expect(() => fn('invalid-command')).toThrow('Git command failed');
                    }
                });
            });
        }
    });
});
