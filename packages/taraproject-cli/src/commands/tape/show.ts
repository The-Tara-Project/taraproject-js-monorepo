import { Command } from 'commander';
import { TaraStack } from '@jose_pereiro/taralib-js';
import { getLastRecords } from '../../utils/tape-utils.js';
import { getOutputFormat } from '../../utils/output.js';
import { printJSON } from '../../formatters/json.js';
import { printRecords } from '../../formatters/text.js';
import type { GlobalOptions } from '../../types.js';

interface ShowOptions extends GlobalOptions {
  n?: string;
}

export function registerShowCommand(tapeCommand: Command): void {
  tapeCommand
    .command('show <tapeId>')
    .description('Show last N records from a tape')
    .option('-n <count>', 'Number of records to show', '10')
    .action(async (tapeId: string, cmdOptions: ShowOptions) => {
      const options = { ...tapeCommand.optsWithGlobals(), ...cmdOptions } as GlobalOptions;
      const count = parseInt(cmdOptions.n || '10', 10);

      const tara = new TaraStack();
      const tape = tara.global.tapes.get(tapeId);
      const records = await getLastRecords(tape, count);

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
