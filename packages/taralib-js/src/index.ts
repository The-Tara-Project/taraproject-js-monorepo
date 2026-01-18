// Types
export type { TaraRecordMeta, TaraTapeMetadata, SettingSource, SettingsState } from './base/types';


// Home folder utilities
export { getTaraHomePath, getTapesFolderPath, ensureTaraHome } from './base/home';

// Record utilities
export { TaraRecord, isValidUuid4 } from './base/record';

// Tape operations
export {
    TaraTapeHandler,
    createTapeHandler,
    buildTapePath,
} from './base/tape';

// Settings system
export { refreshSettings, getSetting, getRawValue, isLoaded } from './base/settings';

// Git operations
export { GitHandler } from './base/git';
