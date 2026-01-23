import type { ITaraRecord } from '@jose_pereiro/taralib-js';

export interface TapeInfo {
  tapeId: string;
  filePath: string;
  createdAt: Date;
  recordCount: number;
  fileSize: number;
  lastModified: Date;
  metadata: ITaraRecord | null;
}
