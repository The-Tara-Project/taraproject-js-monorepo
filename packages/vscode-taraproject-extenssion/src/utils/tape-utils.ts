import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  TaraStack,
  type ITapeMetaRecord,
  TapeHandler,
} from '@jose_pereiro/taralib-js';
import type { TapeInfo } from '../models/types';

/**
 * Get all tapes from the tapes folder.
 */
export async function getAllTapes(tara: TaraStack): Promise<TapeInfo[]> {
  const tapeRepoIds = tara.global.tapes.list();
  const allTapes: TapeInfo[] = [];

  for (const tapeRepoId of tapeRepoIds) {
    const tapeFiles = tara.global.tapes.listTapeFiles(tapeRepoId);

    for (const tapeFile of tapeFiles) {
        const tapeRepoPath = tara.global.home.getTapesPath(tapeRepoId);
        const filePath = path.join(tapeRepoPath, tapeFile);

        try {
            const tapeHandler = new TapeHandler({
                tapeId: tapeRepoId,
                tapePath: filePath,
                options: { writer: tara.settings.getSetting('writer') }
            });

            const stats = fs.statSync(filePath);
            
            let metadata: ITapeMetaRecord | null = null;
            try {
                metadata = await tapeHandler.readMetadata();
            } catch (error) {
                // Metadata is optional
            }

            const lineCount = await tapeHandler.countLines();
            const recordCount = lineCount > 0 ? lineCount - 1 : 0;

            allTapes.push({
                tapeRepoId,
                tapeFile,
                filePath,
                createdAt: metadata?.__taratape?.createdAt ? new Date(metadata.__taratape.createdAt) : stats.birthtime,
                recordCount,
                fileSize: stats.size,
                lastModified: stats.mtime,
                metadata,
            });
        } catch (error) {
            console.warn(`Warning: Failed to read tape ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
  }

  return allTapes;
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
 * Format date in human-readable format.
 */
export function formatDate(date: Date): string {
  return date.toLocaleString();
}
