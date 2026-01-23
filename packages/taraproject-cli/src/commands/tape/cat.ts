import { Command } from 'commander';
import { TaraStack } from '@jose_pereiro/taralib-js';
import type { GlobalOptions } from '../../types.js';

export function registerCatCommand(tapeCommand: Command): void {
  tapeCommand
    .command('cat <tapeId>')
    .description('Stream all records as JSONL (one JSON object per line)')
    .action(async (tapeId: string) => {
      const tara = new TaraStack();
      const tape = tara.global.tapes.get(tapeId);

      // Stream records as JSONL
      await tape.readRecords(({ parsed }) => {
        // Skip metadata record
        if (parsed.type !== 'taralib/tape-metadata') {
          console.log(JSON.stringify(parsed));
        }
      });
    });
}
