// Types
export type { TaraRecordMeta, TaraTapeMetadata, SettingSource, SettingsState } from './base/types';
export type { TaraGitRepo } from './base/git';

// Home folder utilities
export { getTaraHomePath, getTapesFolderPath, ensureTaraHome } from './base/home';

// Record utilities
export { TaraRecord, createRecord, isValidRecord, isValidUuid4, stringifyRecord, parseRecord } from './base/record';

// Tape operations
export {
    TaraTape,
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

// Settings system
export { refreshSettings, getSetting, getRawValue, isLoaded } from './base/settings';

// Git operations
export { createGitRepo } from './base/git';
