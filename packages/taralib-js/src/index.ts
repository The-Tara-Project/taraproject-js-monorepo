// Types
export type { TaraRecordMeta, ITaraRecord, TaraTapeMetadata, SettingSource, SettingsState } from './base/types';


// Home folder utilities
export { getTaraHomePath, getTapesFolderPath, ensureTaraHome } from './base/home';

// Record utilities
export { TaraRecord, isValidUuid4 } from './base/record';

// Tape operations
export {
    TaraTapeHandler,
    buildGlobalTapePath,
} from './base/tape-handler';

export { TapeFileHandler } from './base/tape-file-handler';
export { TapeGitHandler } from './base/tape-git-handler';

// Settings system
export { refreshSettings, getSetting, getRawValue, isLoaded } from './base/settings';

// Git operations
export { GitHandler } from './base/git';
