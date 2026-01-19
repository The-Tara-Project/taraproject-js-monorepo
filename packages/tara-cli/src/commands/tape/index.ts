import { Command } from 'commander';
import { registerListCommand } from './list.js';
import { registerInfoCommand } from './info.js';
import { registerShowCommand } from './show.js';
import { registerCatCommand } from './cat.js';
import { registerHeadCommand } from './head.js';
import { registerTailCommand } from './tail.js';
import { registerCountCommand } from './count.js';
import { registerSummaryCommand } from './summary.js';

export function registerTapeCommands(program: Command): void {
  const tapeCommand = program
    .command('tape')
    .description('Manage and inspect tapes');

  // Register all tape subcommands
  registerListCommand(tapeCommand);
  registerInfoCommand(tapeCommand);
  registerShowCommand(tapeCommand);
  registerCatCommand(tapeCommand);
  registerHeadCommand(tapeCommand);
  registerTailCommand(tapeCommand);
  registerCountCommand(tapeCommand);
  registerSummaryCommand(tapeCommand);
}
