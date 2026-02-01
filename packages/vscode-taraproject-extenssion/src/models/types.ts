import type { ITapeMetaRecord } from '@jose_pereiro/taralib-js';

export interface TapeInfo {
  tapeRepoId: string;
  tapeFile: string;
  filePath: string;
  createdAt: Date;
  recordCount: number;
  fileSize: number;
  lastModified: Date;
  metadata: ITapeMetaRecord | null;
}
