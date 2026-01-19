import type { ITaraRecord } from '@jose_pereiro/taralib-js';

export type OutputFormat = 'json' | 'table' | 'text';

export interface GlobalOptions {
  json?: boolean;
  quiet?: boolean;
  verbose?: boolean;
}

export interface TapeInfo {
  tapeId: string;
  filePath: string;
  createdAt: Date;
  recordCount: number;
  fileSize: number;
  lastModified: Date;
  metadata: ITaraRecord | null;
}

export interface TapeSummary {
  tapeId: string;
  basicStats: {
    totalRecords: number;
    dateRange: {
      earliest: Date | null;
      latest: Date | null;
    };
    fileSize: number;
  };
  recordTypes: Map<string, number>;
  fieldFrequency: Map<string, number>;
  topFields: Array<{ field: string; count: number; percentage: number }>;
}
