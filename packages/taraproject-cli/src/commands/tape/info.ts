import { Command } from 'commander';
import { getTape, formatFileSize } from '../../utils/tape-utils.js';
import { getOutputFormat } from '../../utils/output.js';
import { printJSON } from '../../formatters/json.js';
import { formatHeader, formatKeyValue } from '../../formatters/text.js';
import type { GlobalOptions } from '../../types.js';

export function registerInfoCommand(tapeCommand: Command): void {
  tapeCommand
    .command('info <tapeId>')
    .description('Show tape metadata and information')
    .action(async (tapeId: string) => {
      const options = tapeCommand.optsWithGlobals() as GlobalOptions;
      const tape = await getTape(tapeId);

      const format = getOutputFormat(options);

      if (format === 'json') {
        printJSON({
          tapeId: tape.tapeId,
          filePath: tape.filePath,
          createdAt: tape.createdAt.toISOString(),
          recordCount: tape.recordCount,
          fileSize: tape.fileSize,
          lastModified: tape.lastModified.toISOString(),
          metadata: tape.metadata,
        });
        return;
      }

      // Text format
      console.log(formatHeader(`Tape: ${tape.tapeId}`));
      console.log();
      console.log(formatKeyValue('File Path', tape.filePath));
      console.log(formatKeyValue('Created At', tape.createdAt.toISOString()));
      console.log(formatKeyValue('Record Count', String(tape.recordCount)));
      console.log(formatKeyValue('File Size', formatFileSize(tape.fileSize)));
      console.log(formatKeyValue('Last Modified', tape.lastModified.toISOString()));

      if (tape.metadata?.__taratape) {
        console.log();
        console.log(formatHeader('Metadata'));
        console.log();
        console.log(formatKeyValue('Format Version', tape.metadata.__taratape.formatVersion));
        console.log(formatKeyValue('Tape ID (UUID)', tape.metadata.__taratape.id));
        console.log(formatKeyValue('Tape Name', tape.metadata.__taratape.name));
        console.log(formatKeyValue('Created At', tape.metadata.__taratape.createdAt));
        console.log(formatKeyValue('Created By', tape.metadata.__taratape.writer));
      }
    });
}
