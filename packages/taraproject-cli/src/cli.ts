import { Command } from 'commander';
import { handleError } from './utils/errors.js';
import { registerTapeCommands } from './commands/tape/index.js';
import { registerGitCommands } from './commands/git/index.js';

async function main() {
  const program = new Command();

  program
    .name('tara')
    .description('Command-line interface for Tara tape management')
    .version('0.0.1');

  // Global options
  program
    .option('--json', 'Output as JSON')
    .option('--quiet', 'Minimal output')
    .option('--verbose', 'Verbose output');

  // Register tape commands
  registerTapeCommands(program);

  // Register git commands
  registerGitCommands(program);

  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    handleError(error);
  }
}

main().catch(handleError);
