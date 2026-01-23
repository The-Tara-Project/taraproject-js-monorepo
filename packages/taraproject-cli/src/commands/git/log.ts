import { Command } from 'commander';
import { GitHandler, getTapesFolderPath } from '@jose_pereiro/taralib-js';
import { getOutputFormat } from '../../utils/output.js';
import { printJSON } from '../../formatters/json.js';
import { TaraCLIError, ErrorCode } from '../../utils/errors.js';
import type { GlobalOptions } from '../../types.js';

export function registerLogCommand(gitCommand: Command): void {
  gitCommand
    .command('log [limit]')
    .description('Show commit history')
    .option('--oneline', 'Show one line per commit')
    .action(async (limit: string | undefined, cmdOptions: { oneline?: boolean }) => {
      const options = { ...gitCommand.optsWithGlobals(), ...cmdOptions } as GlobalOptions & { oneline?: boolean };

      const repoPath = getTapesFolderPath();
      const git = new GitHandler(repoPath);

      if (!git.isGitRepo()) {
        throw new TaraCLIError(
          'Not a git repository. Initialize with `git init` in the tapes folder.',
          ErrorCode.INVALID_ARGUMENT
        );
      }

      const limitNum = limit ? parseInt(limit, 10) : undefined;
      const format = getOutputFormat(options);

      if (format === 'json') {
        // Use format string to get structured data
        const logOutput = git.getLog({
          limit: limitNum,
          format: '%H%n%h%n%an%n%ae%n%at%n%s%n---'
        });

        // Parse into structured format
        const commits = logOutput.split('---\n')
          .filter(block => block.trim())
          .map(block => {
            const [hash, shortHash, author, email, timestamp, subject] = block.split('\n');
            return {
              hash,
              shortHash,
              author,
              email,
              timestamp: parseInt(timestamp, 10),
              subject
            };
          });

        printJSON({ commits });
      } else {
        const logOutput = git.getLog({
          limit: limitNum,
          oneline: options.oneline
        });
        console.log(logOutput);
      }
    });
}
