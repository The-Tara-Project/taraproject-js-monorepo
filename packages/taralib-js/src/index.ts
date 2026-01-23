// ===== New TaraStack API =====
export { TaraStack } from './stack/tara-stack';
export type { TaraStackOptions } from './stack/tara-stack';

// Scopes
export { GlobalScope } from './stack/scopes/global-scope';
export {
    LocalAppManager,
    LocalHomeManager, LocalScope,
    LocalTapeManager
} from './stack/scopes/local-scope';

// Managers (for direct use if needed)
export { AppManager } from './stack/managers/app-manager';
export { GTapeManager } from './stack/managers/tape-manager';

// ===== Existing exports =====

// Types
export type { ITapeMetadata, ITaraRecord, SettingSource, SettingsState, TaraRecordMeta } from './base/types';


// Home handler (primary way to manage paths - use TaraStack.global.home or SettingsHandler + HomeHandler)
// See HomeHandler class for path resolution and directory management

// Record utilities
export { RecordHandler } from './base/record-handler';

// Tape operations
export { GTapeHandler } from './base/tape-handler';

export { TapeFileHandler } from './base/tape-file-handler';
export { GTapeGitHandler } from './base/tape-git-handler';

// Settings system
export { SettingsHandler } from './base/settings-handler';

// Home handler
export { HomeHandler } from './base/home-handler';

// Git operations
export { GitHandler } from './base/git-handler';

// App handler
export { AppHandler } from './base/app-handler';

