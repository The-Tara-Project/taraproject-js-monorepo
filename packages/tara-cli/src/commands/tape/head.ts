import { Command } from 'commander';
import { TapeHandler } from '@jose_pereiro/taralib-js';
import { getFirstRecords } from '../../utils/tape-utils.js';
import { getOutputFormat } from '../../utils/output.js';
import { printJSON } from '../../formatters/json.js';
import { printRecords } from '../../formatters/text.js';
import type { GlobalOptions } from '../../types.js';

export function registerHeadCommand(tapeCommand: Command): void {
  tapeCommand
    .command('head <tapeId> [count]')
    .description('Show first N records from a tape')
    .action(async (tapeId: string, count: string | undefined) => {
      const options = tapeCommand.optsWithGlobals() as GlobalOptions;
      const n = parseInt(count || '10', 10);

      const tape = new TapeHandler(tapeId);
      const records = await getFirstRecords(tape, n);

      const format = getOutputFormat(options);

      if (format === 'json') {
        printJSON(records);
        return;
      }

      // Text format
      if (records.length === 0) {
        console.log('No records found.');
        return;
      }

      printRecords(records);
    });
}
