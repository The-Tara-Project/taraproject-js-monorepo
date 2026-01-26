import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  TaraStack,
  GTapeHandler,
  type ITaraRecord,
  type ITapeMetaRecord,
} from '@jose_pereiro/taralib-js';
import type { TapeInfo } from '../types.js';
import { TaraCLIError, ErrorCode } from './errors.js';

// Singleton TaraStack instance
let tara: TaraStack | null = null;

/**
 * Initialize TaraStack (lazy initialization)
 */
function getTaraStack(): TaraStack {
  if (!tara) {
    tara = new TaraStack();
  }
  return tara;
}

/**
 * Get all tapes from the tapes folder.
 */
export async function getAllTapes(): Promise<TapeInfo[]> {
  const taraStack = getTaraStack();
  const tapesFolder = taraStack.global.home.getTapesPath();

  if (!fs.existsSync(tapesFolder)) {
    return [];
  }

  const files = fs.readdirSync(tapesFolder);
  const tapeFiles = files.filter(f => f.endsWith('.tara.jsonl'));

  const tapes: TapeInfo[] = [];

  for (const file of tapeFiles) {
    const tapeId = file.replace('.tara.jsonl', '');
    const filePath = path.join(tapesFolder, file);

    try {
      const tape = taraStack.global.tapes.get(tapeId);
      const stats = fs.statSync(filePath);

      let metadata: ITapeMetaRecord | null = null;
      try {
        metadata = await tape.readMetadata();
      } catch (error) {
        // Metadata is optional, continue without it
      }

      const recordCount = await countRecords(tape);

      tapes.push({
        tapeId,
        filePath,
        createdAt: metadata?.__taratape?.createdAt ? new Date(metadata.__taratape.createdAt) : stats.birthtime,
        recordCount,
        fileSize: stats.size,
        lastModified: stats.mtime,
        metadata,
      });
    } catch (error) {
      // Skip invalid tapes
      console.warn(`Warning: Failed to read tape ${tapeId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return tapes;
}

/**
 * Get a specific tape by ID.
 */
export async function getTape(tapeId: string): Promise<TapeInfo> {
  const taraStack = getTaraStack();
  const tape = taraStack.global.tapes.get(tapeId);
  const filePath = tape.getHomePath();

  if (!fs.existsSync(filePath)) {
    throw new TaraCLIError(
      `Tape not found: ${tapeId}`,
      ErrorCode.TAPE_NOT_FOUND,
      { tapeId }
    );
  }

  const stats = fs.statSync(filePath);
  let metadata: ITapeMetaRecord | null = null;

  try {
    metadata = await tape.readMetadata();
  } catch (error) {
    throw new TaraCLIError(
      `Failed to read tape metadata: ${error instanceof Error ? error.message : String(error)}`,
      ErrorCode.INVALID_TAPE,
      { tapeId, error }
    );
  }

  const recordCount = await countRecords(tape);

  return {
    tapeId,
    filePath,
    createdAt: metadata?.__taratape?.createdAt ? new Date(metadata.__taratape.createdAt) : stats.birthtime,
    recordCount,
    fileSize: stats.size,
    lastModified: stats.mtime,
    metadata,
  };
}

/**
 * Count records in a tape (excluding metadata).
 */
export async function countRecords(tape: GTapeHandler): Promise<number> {
  let count = 0;

  await tape.readRecords(({ parsed }) => {
    // Skip metadata record
    if (parsed.type !== 'taralib/tape-metadata') {
      count++;
    }
  });

  return count;
}

/**
 * Get the last N records from a tape.
 */
export async function getLastRecords(tape: GTapeHandler, n: number): Promise<ITaraRecord[]> {
  const records: ITaraRecord[] = [];

  await tape.readRecords(({ parsed }) => {
    // Skip metadata record
    if (parsed.type !== 'taralib/tape-metadata') {
      records.push(parsed);
    }
  });

  // Return last N records
  return records.slice(-n);
}

/**
 * Get the first N records from a tape.
 */
export async function getFirstRecords(tape: GTapeHandler, n: number): Promise<ITaraRecord[]> {
  const records: ITaraRecord[] = [];

  await tape.readRecords(({ parsed }) => {
    // Skip metadata record
    if (parsed.type !== 'taralib/tape-metadata') {
      records.push(parsed);

      // Stop when we have enough records
      if (records.length >= n) {
        return 'stop';
      }
    }
  });

  return records;
}

/**
 * Get all records from a tape (excluding metadata).
 */
export async function getAllRecords(tape: GTapeHandler): Promise<ITaraRecord[]> {
  const records: ITaraRecord[] = [];

  await tape.readRecords(({ parsed }) => {
    // Skip metadata record
    if (parsed.type !== 'taralib/tape-metadata') {
      records.push(parsed);
    }
  });

  return records;
}

/**
 * Format file size in human-readable format.
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Format date in ISO format.
 */
export function formatDate(date: Date): string {
  return date.toISOString();
}
