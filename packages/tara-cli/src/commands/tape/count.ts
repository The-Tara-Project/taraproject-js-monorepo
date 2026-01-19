import { Command } from 'commander';
import { TaraTapeHandler } from '@jose_pereiro/taralib-js';
import { countRecords } from '../../utils/tape-utils.js';
import { getOutputFormat } from '../../utils/output.js';
import { printJSON } from '../../formatters/json.js';
import type { GlobalOptions } from '../../types.js';

export function registerCountCommand(tapeCommand: Command): void {
  tapeCommand
    .command('count <tapeId>')
    .description('Count total records in a tape')
    .action(async (tapeId: string) => {
      const options = tapeCommand.optsWithGlobals() as GlobalOptions;
      const tape = new TaraTapeHandler(tapeId);
      const count = await countRecords(tape);

      const format = getOutputFormat(options);

      if (format === 'json') {
        printJSON({ tapeId, count });
        return;
      }

      // Simple number output for scripting
      console.log(count);
    });
}
