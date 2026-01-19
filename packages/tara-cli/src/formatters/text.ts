import chalk from 'chalk';
import type { ITaraRecord } from '@jose_pereiro/taralib-js';

/**
 * Format a record as colored text.
 */
export function formatRecord(record: ITaraRecord, index?: number): string {
  const lines: string[] = [];

  if (index !== undefined) {
    lines.push(chalk.bold.blue(`Record #${index + 1}`));
  }

  // Format each field
  for (const [key, value] of Object.entries(record)) {
    const formattedKey = chalk.cyan(`  ${key}:`);
    const formattedValue = formatValue(value);
    lines.push(`${formattedKey} ${formattedValue}`);
  }

  return lines.join('\n');
}

/**
 * Format a value with appropriate styling.
 */
function formatValue(value: unknown): string {
  if (value === null) {
    return chalk.gray('null');
  }
  if (value === undefined) {
    return chalk.gray('undefined');
  }
  if (typeof value === 'string') {
    return chalk.green(`"${value}"`);
  }
  if (typeof value === 'number') {
    return chalk.yellow(String(value));
  }
  if (typeof value === 'boolean') {
    return chalk.magenta(String(value));
  }
  if (Array.isArray(value)) {
    return chalk.white(JSON.stringify(value));
  }
  if (typeof value === 'object') {
    return chalk.white(JSON.stringify(value, null, 2));
  }
  return String(value);
}

/**
 * Format multiple records as colored text.
 */
export function formatRecords(records: ITaraRecord[]): string {
  return records.map((record, index) => formatRecord(record, index)).join('\n\n');
}

/**
 * Print records to stdout.
 */
export function printRecords(records: ITaraRecord[]): void {
  console.log(formatRecords(records));
}

/**
 * Print a single record to stdout.
 */
export function printRecord(record: ITaraRecord, index?: number): void {
  console.log(formatRecord(record, index));
}

/**
 * Format a section header.
 */
export function formatHeader(text: string): string {
  return chalk.bold.cyan(`\n${text}\n${'='.repeat(text.length)}`);
}

/**
 * Format a key-value pair.
 */
export function formatKeyValue(key: string, value: string): string {
  return `${chalk.cyan(key + ':')} ${value}`;
}

/**
 * Format a list item.
 */
export function formatListItem(text: string, value?: string): string {
  if (value) {
    return `  ${chalk.gray('•')} ${text}: ${chalk.white(value)}`;
  }
  return `  ${chalk.gray('•')} ${text}`;
}
