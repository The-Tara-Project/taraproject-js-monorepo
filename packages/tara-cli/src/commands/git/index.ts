import { Command } from 'commander';
import { registerStatusCommand } from './status.js';
import { registerLogCommand } from './log.js';
import { registerDiffCommand } from './diff.js';

export function registerGitCommands(program: Command): void {
  const gitCommand = program
    .command('git')
    .description('Git repository operations (read-only)');

  // Register all git subcommands
  registerStatusCommand(gitCommand);
  registerLogCommand(gitCommand);
  registerDiffCommand(gitCommand);
}
