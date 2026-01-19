import type { OutputFormat, GlobalOptions } from '../types.js';

export function getOutputFormat(options: GlobalOptions): OutputFormat {
  if (options.json) {
    return 'json';
  }
  if (options.quiet) {
    return 'text'; // Simple text output without formatting
  }
  return 'table'; // Default to rich table formatting
}

export function shouldShowOutput(options: GlobalOptions): boolean {
  return !options.quiet;
}

export function log(message: string, options: GlobalOptions): void {
  if (shouldShowOutput(options)) {
    console.log(message);
  }
}

export function error(message: string): void {
  console.error(message);
}
