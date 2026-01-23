import Table from 'cli-table3';
import chalk from 'chalk';

export interface TableColumn {
  key: string;
  header: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  formatter?: (value: unknown) => string;
}

/**
 * Create and format a table with the given data.
 */
export function createTable(
  columns: TableColumn[],
  rows: Record<string, unknown>[]
): string {
  const table = new Table({
    head: columns.map(col => chalk.bold.cyan(col.header)),
    colWidths: columns.map(col => col.width),
    colAligns: columns.map(col => col.align || 'left') as Array<'left' | 'center' | 'right'>,
    style: {
      head: [],
      border: ['gray'],
    },
  });

  for (const row of rows) {
    const tableRow = columns.map(col => {
      const value = row[col.key];
      if (col.formatter) {
        return col.formatter(value);
      }
      return value != null ? String(value) : '';
    });
    table.push(tableRow);
  }

  return table.toString();
}

/**
 * Print a table to stdout.
 */
export function printTable(
  columns: TableColumn[],
  rows: Record<string, unknown>[]
): void {
  console.log(createTable(columns, rows));
}
