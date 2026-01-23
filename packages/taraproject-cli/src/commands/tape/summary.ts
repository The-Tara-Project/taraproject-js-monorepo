import { Command } from 'commander';
import { GTapeHandler } from '@jose_pereiro/taralib-js';
import { getAllRecords, formatFileSize } from '../../utils/tape-utils.js';
import { getOutputFormat } from '../../utils/output.js';
import { printJSON } from '../../formatters/json.js';
import { formatHeader, formatKeyValue, formatListItem } from '../../formatters/text.js';
import type { GlobalOptions, TapeSummary } from '../../types.js';
import * as fs from 'node:fs';

async function generateSummary(tapeId: string): Promise<TapeSummary> {
  const tape = new GTapeHandler(tapeId);
  const records = await getAllRecords(tape);

  // Basic stats
  const totalRecords = records.length;
  let earliest: Date | null = null;
  let latest: Date | null = null;

  // Record type distribution
  const recordTypes = new Map<string, number>();

  // Field frequency
  const fieldFrequency = new Map<string, number>();

  for (const record of records) {
    // Check for timestamps (common fields like createdAt, timestamp, date, etc.)
    const timestamp = record.createdAt || record.timestamp || record.date || record.at;
    if (timestamp) {
      const date = new Date(timestamp as string);
      if (!isNaN(date.getTime())) {
        if (!earliest || date < earliest) {
          earliest = date;
        }
        if (!latest || date > latest) {
          latest = date;
        }
      }
    }

    // Count record types
    const type = String(record.type || 'unknown');
    recordTypes.set(type, (recordTypes.get(type) || 0) + 1);

    // Count field occurrences
    for (const key of Object.keys(record)) {
      fieldFrequency.set(key, (fieldFrequency.get(key) || 0) + 1);
    }
  }

  // Get file size
  const filePath = tape.getPath();
  const fileSize = fs.existsSync(filePath) ? fs.statSync(filePath).size : 0;

  // Calculate top fields
  const topFields = Array.from(fieldFrequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([field, count]) => ({
      field,
      count,
      percentage: totalRecords > 0 ? (count / totalRecords) * 100 : 0,
    }));

  return {
    tapeId,
    basicStats: {
      totalRecords,
      dateRange: { earliest, latest },
      fileSize,
    },
    recordTypes,
    fieldFrequency,
    topFields,
  };
}

export function registerSummaryCommand(tapeCommand: Command): void {
  tapeCommand
    .command('summary <tapeId>')
    .description('Show tape statistics and analysis')
    .action(async (tapeId: string) => {
      const options = tapeCommand.optsWithGlobals() as GlobalOptions;
      const summary = await generateSummary(tapeId);

      const format = getOutputFormat(options);

      if (format === 'json') {
        printJSON({
          tapeId: summary.tapeId,
          basicStats: {
            totalRecords: summary.basicStats.totalRecords,
            dateRange: {
              earliest: summary.basicStats.dateRange.earliest?.toISOString() || null,
              latest: summary.basicStats.dateRange.latest?.toISOString() || null,
            },
            fileSize: summary.basicStats.fileSize,
          },
          recordTypes: Object.fromEntries(summary.recordTypes),
          topFields: summary.topFields,
        });
        return;
      }

      // Text format
      console.log(formatHeader(`Summary: ${summary.tapeId}`));
      console.log();

      // Basic Stats
      console.log(formatHeader('Basic Statistics'));
      console.log();
      console.log(formatKeyValue('Total Records', String(summary.basicStats.totalRecords)));
      console.log(formatKeyValue('File Size', formatFileSize(summary.basicStats.fileSize)));

      if (summary.basicStats.dateRange.earliest && summary.basicStats.dateRange.latest) {
        console.log(formatKeyValue('Date Range',
          `${summary.basicStats.dateRange.earliest.toISOString()} to ${summary.basicStats.dateRange.latest.toISOString()}`
        ));
      }

      // Record Types
      if (summary.recordTypes.size > 0) {
        console.log();
        console.log(formatHeader('Record Type Distribution'));
        console.log();

        const sortedTypes = Array.from(summary.recordTypes.entries())
          .sort((a, b) => b[1] - a[1]);

        for (const [type, count] of sortedTypes) {
          const percentage = summary.basicStats.totalRecords > 0
            ? ((count / summary.basicStats.totalRecords) * 100).toFixed(1)
            : '0.0';
          console.log(formatListItem(type, `${count} (${percentage}%)`));
        }
      }

      // Top Fields
      if (summary.topFields.length > 0) {
        console.log();
        console.log(formatHeader('Top 10 Fields by Frequency'));
        console.log();

        for (const { field, count, percentage } of summary.topFields) {
          console.log(formatListItem(field, `${count} (${percentage.toFixed(1)}%)`));
        }
      }
    });
}
