// ===== New TaraStack API =====
export { TaraStack } from './stack/tara-stack';

// Scopes
export { GlobalScope } from './stack/global/global-scope';

// Managers (for direct use if needed)
export { AppManager } from './stack/global/managers/app-manager';
export { GTapeManager } from './stack/global/managers/tape-manager';
export { GitStorageManager, type TaraGitSTLink } from './stack/global/managers/git-storage-manager';

// ===== Existing exports =====

// Types
export type {
    ITapeMetaRecord,    // Tape metadata (nested in __taratape)
    ITaraTapeMeta,      // __taratape structure
    ITaraRecord,
    SettingSource,
    SettingsState,
    ITaraRecordMeta,
    ReadJSONLCallback,
    ReadJSONLCallbackArgs,
    ReadRecordsCallback,
    ReadRecordsCallbackArgs
} from './base/types';


// Home handler (primary way to manage paths - use TaraStack.global.home or SettingsManager + HomeManager)
// See HomeManager class for path resolution and directory management

// Record utilities
export { RecordHandler } from './base/record-handler';

// Tape operations
export { GTapeHandler } from './base/tape-handler';

// Settings system
export { SettingsManager } from './stack/global/managers/settings-manager';

// Home handler
export { HomeManager } from './stack/global/managers/home-manager';

// App handler
export { AppHandler } from './base/app-handler';

// Git DB handler
export { GitDBHandler, type GitDBCommitLink } from './base/git-db-handler';


