import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { readBashHistory, getLastNCommands, parseBashHistory } from '../../src/utils/bash-history-parser';

describe('Bash History Parser', () => {
    describe('readBashHistory - File Operations', () => {
        let tempHistoryPath: string;

        beforeEach(() => {
            tempHistoryPath = path.join(os.tmpdir(), `test-bash-history-${Date.now()}`);
        });

        afterEach(() => {
            if (fs.existsSync(tempHistoryPath)) {
                fs.unlinkSync(tempHistoryPath);
            }
        });

        it('should read commands from history file', () => {
            const mockHistory = 'ls -la\nnpm run build\ngit status\n';
            fs.writeFileSync(tempHistoryPath, mockHistory);

            const commands = readBashHistory(tempHistoryPath);
            expect(commands).toEqual(['ls -la', 'npm run build', 'git status']);
        });

        it('should handle file with trailing newline', () => {
            const mockHistory = 'cmd1\ncmd2\ncmd3\n\n\n';
            fs.writeFileSync(tempHistoryPath, mockHistory);

            const commands = readBashHistory(tempHistoryPath);
            expect(commands).toEqual(['cmd1', 'cmd2', 'cmd3']);
        });

        it('should filter out empty lines', () => {
            const mockHistory = 'ls -la\n\nnpm run build\n\n\ngit status\n';
            fs.writeFileSync(tempHistoryPath, mockHistory);

            const commands = readBashHistory(tempHistoryPath);
            expect(commands).toEqual(['ls -la', 'npm run build', 'git status']);
        });

        it('should return empty array if file does not exist', () => {
            const commands = readBashHistory('/nonexistent/path/.bash_history');
            expect(commands).toEqual([]);
        });

        it('should handle empty file', () => {
            fs.writeFileSync(tempHistoryPath, '');
            const commands = readBashHistory(tempHistoryPath);
            expect(commands).toEqual([]);
        });

        it('should handle file with only whitespace', () => {
            fs.writeFileSync(tempHistoryPath, '\n\n  \n\t\n');
            const commands = readBashHistory(tempHistoryPath);
            expect(commands).toEqual([]);
        });

        it('should preserve command text exactly (no trimming)', () => {
            const mockHistory = '  ls -la  \n\tnpm run build\t\n';
            fs.writeFileSync(tempHistoryPath, mockHistory);

            const commands = readBashHistory(tempHistoryPath);
            expect(commands[0]).toBe('  ls -la  ');
            expect(commands[1]).toBe('\tnpm run build\t');
        });
    });

    describe('getLastNCommands - Slicing Operations', () => {
        let tempHistoryPath: string;

        beforeEach(() => {
            tempHistoryPath = path.join(os.tmpdir(), `test-bash-history-${Date.now()}`);
        });

        afterEach(() => {
            if (fs.existsSync(tempHistoryPath)) {
                fs.unlinkSync(tempHistoryPath);
            }
        });

        it('should return last N commands', () => {
            const mockHistory = 'cmd1\ncmd2\ncmd3\ncmd4\ncmd5\n';
            fs.writeFileSync(tempHistoryPath, mockHistory);

            const commands = getLastNCommands(3, tempHistoryPath);
            expect(commands).toEqual(['cmd3', 'cmd4', 'cmd5']);
        });

        it('should return all commands if N >= total', () => {
            const mockHistory = 'cmd1\ncmd2\n';
            fs.writeFileSync(tempHistoryPath, mockHistory);

            const commands = getLastNCommands(10, tempHistoryPath);
            expect(commands).toEqual(['cmd1', 'cmd2']);
        });

        it('should return exactly N commands if available', () => {
            const mockHistory = 'cmd1\ncmd2\ncmd3\ncmd4\ncmd5\n';
            fs.writeFileSync(tempHistoryPath, mockHistory);

            const commands = getLastNCommands(5, tempHistoryPath);
            expect(commands).toHaveLength(5);
            expect(commands).toEqual(['cmd1', 'cmd2', 'cmd3', 'cmd4', 'cmd5']);
        });

        it('should handle N=0', () => {
            const mockHistory = 'cmd1\ncmd2\ncmd3\n';
            fs.writeFileSync(tempHistoryPath, mockHistory);

            const commands = getLastNCommands(0, tempHistoryPath);
            expect(commands).toEqual([]);
        });

        it('should handle N=1', () => {
            const mockHistory = 'cmd1\ncmd2\ncmd3\n';
            fs.writeFileSync(tempHistoryPath, mockHistory);

            const commands = getLastNCommands(1, tempHistoryPath);
            expect(commands).toEqual(['cmd3']);
        });
    });

    describe('parseBashHistory - Structuring Operations', () => {
        it('should parse commands into BashCommand objects', () => {
            const commands = ['npm run build', 'git status'];
            const parsed = parseBashHistory(commands, '/test/cwd');

            expect(parsed).toHaveLength(2);
            expect(parsed[0]).toMatchObject({
                command: 'npm run build',
                cwd: '/test/cwd',
            });
            expect(parsed[0].timestamp).toBeDefined();
            expect(parsed[1]).toMatchObject({
                command: 'git status',
                cwd: '/test/cwd',
            });
        });

        it('should use current directory if cwd not provided', () => {
            const commands = ['ls'];
            const parsed = parseBashHistory(commands);

            expect(parsed[0].cwd).toBe(process.cwd());
        });

        it('should assign approximate timestamps in ascending order', () => {
            const commands = ['cmd1', 'cmd2', 'cmd3'];
            const parsed = parseBashHistory(commands);

            const t1 = new Date(parsed[0].timestamp).getTime();
            const t2 = new Date(parsed[1].timestamp).getTime();
            const t3 = new Date(parsed[2].timestamp).getTime();

            expect(t1).toBeLessThan(t2);
            expect(t2).toBeLessThan(t3);
        });

        it('should space timestamps by 1 second', () => {
            const commands = ['cmd1', 'cmd2'];
            const parsed = parseBashHistory(commands);

            const t1 = new Date(parsed[0].timestamp).getTime();
            const t2 = new Date(parsed[1].timestamp).getTime();

            expect(t2 - t1).toBeGreaterThanOrEqual(1000);
            expect(t2 - t1).toBeLessThan(1100); // allow some tolerance
        });

        it('should handle empty commands array', () => {
            const parsed = parseBashHistory([]);
            expect(parsed).toEqual([]);
        });

        it('should handle single command', () => {
            const parsed = parseBashHistory(['single command']);
            expect(parsed).toHaveLength(1);
            expect(parsed[0].command).toBe('single command');
        });

        it('should preserve exact command text', () => {
            const commands = ['  spaces  ', '\ttabs\t', 'normal'];
            const parsed = parseBashHistory(commands);

            expect(parsed[0].command).toBe('  spaces  ');
            expect(parsed[1].command).toBe('\ttabs\t');
            expect(parsed[2].command).toBe('normal');
        });

        it('should produce valid ISO timestamp strings', () => {
            const commands = ['cmd'];
            const parsed = parseBashHistory(commands);

            const timestamp = parsed[0].timestamp;
            expect(() => new Date(timestamp)).not.toThrow();
            expect(new Date(timestamp).toISOString()).toBe(timestamp);
        });
    });
});
