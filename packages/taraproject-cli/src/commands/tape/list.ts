import { Command } from 'commander';
import { getAllTapes, formatFileSize, formatDate } from '../../utils/tape-utils.js';
import { getOutputFormat } from '../../utils/output.js';
import { printJSON } from '../../formatters/json.js';
import { printTable, type TableColumn } from '../../formatters/table.js';
import type { GlobalOptions } from '../../types.js';

export function registerListCommand(tapeCommand: Command): void {
  tapeCommand
    .command('list')
    .description('List all tapes')
    .action(async () => {
      const options = tapeCommand.optsWithGlobals() as GlobalOptions;
      const tapes = await getAllTapes();

      const format = getOutputFormat(options);

      if (format === 'json') {
        printJSON(tapes.map(tape => ({
          tapeId: tape.tapeId,
          createdAt: tape.createdAt.toISOString(),
          recordCount: tape.recordCount,
          fileSize: tape.fileSize,
          lastModified: tape.lastModified.toISOString(),
        })));
        return;
      }

      // Table format
      const columns: TableColumn[] = [
        { key: 'tapeId', header: 'Tape ID', width: 30 },
        { key: 'createdAt', header: 'Created At', width: 25, formatter: (v) => formatDate(v as Date) },
        { key: 'recordCount', header: 'Records', width: 10, align: 'right' },
        { key: 'fileSize', header: 'File Size', width: 12, align: 'right', formatter: (v) => formatFileSize(v as number) },
        { key: 'lastModified', header: 'Last Modified', width: 25, formatter: (v) => formatDate(v as Date) },
      ];

      printTable(columns, tapes as unknown as Record<string, unknown>[]);

      if (tapes.length === 0) {
        console.log('\nNo tapes found.');
      }
    });
}
