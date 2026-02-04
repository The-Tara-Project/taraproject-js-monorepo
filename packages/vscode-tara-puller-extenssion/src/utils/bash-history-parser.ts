import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface BashCommand {
    command: string;
    timestamp: string;
    cwd: string;
}

/**
 * Get the bash history file path
 */
export function getBashHistoryPath(): string {
    return path.join(os.homedir(), '.bash_history');
}

/**
 * Read raw bash history file
 */
export function readBashHistory(historyPath?: string): string[] {
    const filePath = historyPath || getBashHistoryPath();
    
    if (!fs.existsSync(filePath)) {
        return [];
    }

    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return content.split('\n').filter(line => line.trim().length > 0);
    } catch (error) {
        console.error('Failed to read bash history:', error);
        return [];
    }
}

/**
 * Get last N commands from bash history
 */
export function getLastNCommands(count: number, historyPath?: string): string[] {
    const allCommands = readBashHistory(historyPath);
    if (count <= 0) {
        return [];
    }
    return allCommands.slice(-count);
}

/**
 * Parse bash history into structured format
 * Note: Standard bash_history doesn't include timestamps by default
 * We'll use current time and current directory as approximations
 */
export function parseBashHistory(
    commands: string[],
    cwd?: string
): BashCommand[] {
    const currentCwd = cwd || process.cwd();
    const now = new Date();
    
    return commands.map((command, index) => ({
        command,
        timestamp: new Date(now.getTime() - (commands.length - index - 1) * 1000).toISOString(),
        cwd: currentCwd,
    }));
}
