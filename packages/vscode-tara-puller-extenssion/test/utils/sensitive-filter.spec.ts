import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { isSensitiveCommand, filterCommands, loadFilterConfig } from '../../src/utils/sensitive-filter';

describe('Sensitive Filter', () => {
    describe('isSensitiveCommand - Pattern Detection', () => {
        const patterns = ['password', 'token', 'secret'];

        it('should detect password in various forms', () => {
            expect(isSensitiveCommand('mysql -u root -pMyPassword', patterns)).toBe(true);
            expect(isSensitiveCommand('echo $PASSWORD', patterns)).toBe(true);
            expect(isSensitiveCommand('export MY_PASSWORD=123', patterns)).toBe(true);
        });

        it('should detect token patterns', () => {
            expect(isSensitiveCommand('export API_TOKEN=abc123', patterns)).toBe(true);
            expect(isSensitiveCommand('curl -H "Authorization: Bearer token123"', patterns)).toBe(true);
            expect(isSensitiveCommand('git config --global github.token abc', patterns)).toBe(true);
        });

        it('should detect secret patterns', () => {
            expect(isSensitiveCommand('export AWS_SECRET=xyz', patterns)).toBe(true);
            expect(isSensitiveCommand('echo $SECRET_KEY', patterns)).toBe(true);
        });

        it('should allow safe commands', () => {
            expect(isSensitiveCommand('npm run build', patterns)).toBe(false);
            expect(isSensitiveCommand('git status', patterns)).toBe(false);
            expect(isSensitiveCommand('ls -la', patterns)).toBe(false);
            expect(isSensitiveCommand('cd /home/user', patterns)).toBe(false);
        });

        it('should be case-insensitive', () => {
            expect(isSensitiveCommand('echo $PASSWORD', patterns)).toBe(true);
            expect(isSensitiveCommand('echo $password', patterns)).toBe(true);
            expect(isSensitiveCommand('echo $PaSsWoRd', patterns)).toBe(true);
        });

        it('should handle regex patterns', () => {
            const regexPatterns = ['curl.*-H.*Authorization', 'export.*TOKEN'];
            expect(isSensitiveCommand('curl -H "Authorization: Bearer x"', regexPatterns)).toBe(true);
            expect(isSensitiveCommand('export MY_TOKEN=123', regexPatterns)).toBe(true);
        });
    });

    describe('filterCommands - Bulk Operations', () => {
        const config = {
            patterns: ['password', 'token'],
            maxCommandLength: 50,
        };

        it('should filter out sensitive commands', () => {
            const commands = [
                'npm run build',
                'export TOKEN=secret',
                'git commit -m "test"',
                'echo $PASSWORD',
            ];
            const filtered = filterCommands(commands, config);
            expect(filtered).toEqual([
                'npm run build',
                'git commit -m "test"',
            ]);
        });

        it('should remove empty and whitespace-only commands', () => {
            const commands = ['npm run build', '', '  ', '\t', 'git status'];
            const filtered = filterCommands(commands, config);
            expect(filtered).toEqual(['npm run build', 'git status']);
        });

        it('should truncate commands exceeding max length', () => {
            const longCmd = 'a'.repeat(100);
            const filtered = filterCommands([longCmd], config);
            expect(filtered[0]).toContain('[truncated]');
            expect(filtered[0].length).toBeLessThanOrEqual(65); // 50 + '...[truncated]'
            expect(filtered[0]).toBe('a'.repeat(50) + '...[truncated]');
        });

        it('should not truncate commands within limit', () => {
            const okCmd = 'a'.repeat(30);
            const filtered = filterCommands([okCmd], config);
            expect(filtered[0]).toBe(okCmd);
            expect(filtered[0]).not.toContain('[truncated]');
        });

        it('should handle empty input array', () => {
            const filtered = filterCommands([], config);
            expect(filtered).toEqual([]);
        });

        it('should apply both filtering and truncation', () => {
            const commands = [
                'a'.repeat(100),           // Should be truncated
                'password=' + 'b'.repeat(100), // Should be filtered (sensitive)
                'git status',              // Should pass through
                '',                        // Should be removed
            ];
            const filtered = filterCommands(commands, config);
            expect(filtered).toHaveLength(2);
            expect(filtered[0]).toContain('[truncated]');
            expect(filtered[1]).toBe('git status');
        });
    });

    describe('loadFilterConfig - Configuration Management', () => {
        let tempConfigPath: string;

        beforeEach(() => {
            tempConfigPath = path.join(os.tmpdir(), `config-${Date.now()}.json`);
        });

        afterEach(() => {
            if (fs.existsSync(tempConfigPath)) {
                fs.unlinkSync(tempConfigPath);
            }
        });

        it('should load config from file', () => {
            const customConfig = {
                patterns: ['custom1', 'custom2'],
                maxCommandLength: 200,
            };
            fs.writeFileSync(tempConfigPath, JSON.stringify(customConfig));

            const config = loadFilterConfig(tempConfigPath);
            expect(config.patterns).toEqual(['custom1', 'custom2']);
            expect(config.maxCommandLength).toBe(200);
        });

        it('should return defaults if no path provided', () => {
            const config = loadFilterConfig();
            expect(config.patterns).toContain('password');
            expect(config.patterns).toContain('token');
            expect(config.maxCommandLength).toBe(500);
        });

        it('should return defaults if file does not exist', () => {
            const config = loadFilterConfig('/nonexistent/path.json');
            expect(config.patterns).toContain('password');
            expect(config.maxCommandLength).toBe(500);
        });

        it('should return defaults on invalid JSON', () => {
            fs.writeFileSync(tempConfigPath, 'invalid json{');
            const config = loadFilterConfig(tempConfigPath);
            expect(config.patterns).toContain('password');
            expect(config.maxCommandLength).toBe(500);
        });

        it('should merge partial config with defaults', () => {
            const partialConfig = {
                maxCommandLength: 300,
                // patterns missing
            };
            fs.writeFileSync(tempConfigPath, JSON.stringify(partialConfig));

            const config = loadFilterConfig(tempConfigPath);
            expect(config.patterns).toContain('password'); // from defaults
            expect(config.maxCommandLength).toBe(300); // from file
        });
    });
});
