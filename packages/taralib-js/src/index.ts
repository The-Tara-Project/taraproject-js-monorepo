// Types
export type { TaraRecord, TaraRecordMeta, TaraTapeMetadata, TaraTape } from './base/types';

// Home folder utilities
export { getTaraHomePath, getTapesFolderPath, ensureTaraHome } from './base/home';

// Record utilities
export { createRecord, isValidRecord, isValidUuid4, stringifyRecord, parseRecord } from './base/record';

// Tape operations
export {
    createTapeHandler,
    instantiateTape,
    buildTapePath,
    getTapePath,
    appendRecord,
    appendRecordBatch,
    readTapeRecords,
    readTapeMetadata,
    tapeExists,
    deleteTape,
} from './base/tape';
