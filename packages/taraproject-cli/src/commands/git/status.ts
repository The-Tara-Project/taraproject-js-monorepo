import { Command } from 'commander';
import { GitHandler, getTapesFolderPath } from '@jose_pereiro/taralib-js';
import { getOutputFormat } from '../../utils/output.js';
import { printJSON } from '../../formatters/json.js';
import { TaraCLIError, ErrorCode } from '../../utils/errors.js';
import type { GlobalOptions } from '../../types.js';

export function registerStatusCommand(gitCommand: Command): void {
  gitCommand
    .command('status')
    .description('Show git repository status')
    .option('--porcelain', 'Machine-readable output')
    .action(async (cmdOptions: { porcelain?: boolean }) => {
      const options = { ...gitCommand.optsWithGlobals(), ...cmdOptions } as GlobalOptions & { porcelain?: boolean };

      const repoPath = getTapesFolderPath();
      const git = new GitHandler(repoPath);

      if (!git.isGitRepo()) {
        throw new TaraCLIError(
          'Not a git repository. Initialize with `git init` in the tapes folder.',
          ErrorCode.INVALID_ARGUMENT
        );
      }

      const format = getOutputFormat(options);

      if (format === 'json') {
        const statusOutput = git.getStatus('porcelain');
        // Parse porcelain output into structured format
        const files = statusOutput.split('\n')
          .filter(line => line.trim())
          .map(line => {
            const status = line.substring(0, 2);
            const file = line.substring(3);
            return { status, file };
          });

        // Try to get branch and commit info, but handle case where there are no commits yet
        let branch: string | null = null;
        let commit: string | null = null;
        try {
          branch = git.getCurrentBranch();
        } catch {
          // No commits yet, branch may not exist
        }
        try {
          commit = git.getHeadCommit(true);
        } catch {
          // No commits yet
        }

        printJSON({
          repository: repoPath,
          branch,
          commit,
          files
        });
      } else if (options.porcelain) {
        console.log(git.getStatus('porcelain'));
      } else {
        console.log(git.getStatus('default'));
      }
    });
}
