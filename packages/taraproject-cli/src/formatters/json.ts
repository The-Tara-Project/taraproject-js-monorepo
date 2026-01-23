/**
 * Format data as JSON output.
 */
export function formatAsJSON(data: unknown, pretty: boolean = true): string {
  return JSON.stringify(data, null, pretty ? 2 : 0);
}

/**
 * Print data as JSON to stdout.
 */
export function printJSON(data: unknown, pretty: boolean = true): void {
  console.log(formatAsJSON(data, pretty));
}
