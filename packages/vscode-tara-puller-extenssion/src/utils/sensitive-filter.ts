import * as fs from 'fs';
import * as path from 'path';

/**
 * Default sensitive patterns to filter
 */
const DEFAULT_PATTERNS = [
    'password',
    'passwd',
    'token',
    'secret',
    'apikey',
    'api_key',
    'api-key',
    'auth',
    'credentials',
    'private',
    'ssh',
    'curl.*-H.*Authorization',
    'export.*TOKEN',
    'export.*PASSWORD',
    'export.*SECRET',
];

export interface SensitiveFilterConfig {
    patterns: string[];
    maxCommandLength: number;
}

/**
 * Load filter patterns from config file or use defaults
 */
export function loadFilterConfig(configPath?: string): SensitiveFilterConfig {
    const defaultConfig: SensitiveFilterConfig = {
        patterns: DEFAULT_PATTERNS,
        maxCommandLength: 500,
    };

    if (!configPath || !fs.existsSync(configPath)) {
        return defaultConfig;
    }

    try {
        const content = fs.readFileSync(configPath, 'utf-8');
        const userConfig = JSON.parse(content);
        return {
            patterns: userConfig.patterns || DEFAULT_PATTERNS,
            maxCommandLength: userConfig.maxCommandLength || 500,
        };
    } catch (error) {
        console.warn('Failed to load sensitive filter config, using defaults:', error);
        return defaultConfig;
    }
}

/**
 * Check if command contains sensitive data
 */
export function isSensitiveCommand(command: string, patterns: string[]): boolean {
    const lowerCommand = command.toLowerCase();
    
    for (const pattern of patterns) {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(command)) {
            return true;
        }
    }
    
    return false;
}

/**
 * Filter and sanitize commands
 */
export function filterCommands(
    commands: string[],
    config: SensitiveFilterConfig
): string[] {
    return commands
        .filter(cmd => cmd.trim().length > 0)
        .filter(cmd => !isSensitiveCommand(cmd, config.patterns))
        .map(cmd => cmd.length > config.maxCommandLength 
            ? cmd.substring(0, config.maxCommandLength) + '...[truncated]'
            : cmd
        );
}
