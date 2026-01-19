import { Command } from 'commander';
import { GitHandler, getTapesFolderPath } from '@jose_pereiro/taralib-js';
import { TaraCLIError, ErrorCode } from '../../utils/errors.js';
import type { GlobalOptions } from '../../types.js';

export function registerDiffCommand(gitCommand: Command): void {
  gitCommand
    .command('diff [ref]')
    .description('Show changes (unstaged by default, or compared to ref)')
    .option('--cached', 'Show staged changes')
    .action(async (ref: string | undefined, cmdOptions: { cached?: boolean }) => {
      const options = { ...gitCommand.optsWithGlobals(), ...cmdOptions } as GlobalOptions & { cached?: boolean };

      const repoPath = getTapesFolderPath();
      const git = new GitHandler(repoPath);

      if (!git.isGitRepo()) {
        throw new TaraCLIError(
          'Not a git repository. Initialize with `git init` in the tapes folder.',
          ErrorCode.INVALID_ARGUMENT
        );
      }

      const diffOutput = git.getDiff(ref, options.cached);

      if (!diffOutput) {
        console.log('No changes');
        return;
      }

      console.log(diffOutput);
    });
}
