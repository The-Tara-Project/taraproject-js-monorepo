// ===== New TaraStack API =====
export { TaraStack } from './tara-project';
export type { TaraStackOptions } from './tara-project';

// Scopes
export { GlobalScope } from './scopes/global-scope';
export {
  LocalScope,
  LocalTapeManager,
  LocalAppManager,
  LocalHomeManager
} from './scopes/local-scope';

// Managers (for direct use if needed)
export { TapeManager } from './managers/tape-manager';
export { AppManager, App } from './managers/app-manager';
export { QuestionManager } from './managers/question-manager';
export { RecordManager } from './managers/record-manager';
export { SettingsManager } from './managers/settings-manager';

// ===== Existing exports (unchanged) =====

// Types
export type { TaraRecordMeta, ITaraRecord, ITapeMetadata, SettingSource, SettingsState } from './base/types';


// Home folder utilities
export { getTaraHomePath, getTapesFolderPath, ensureTaraHome } from './base/home';

// Record utilities
export { TaraRecord, isValidUuid4 } from './base/record';

// Tape operations
export {
    TapeHandler,
    buildGlobalTapePath,
} from './base/tape-handler';

export { TapeFileHandler } from './base/tape-file-handler';
export { TapeGitHandler } from './base/tape-git-handler';

// Settings system
export { SettingsHandler } from './base/settings';
export { refreshSettings, getSetting, getRawValue, isSettingsLoaded } from './base/settings';

// Home handler
export { HomeHandler } from './base/home-handler';

// Git operations
export { GitHandler } from './base/git';

// App handler
export type { TaraQuestion } from './base/app-handler';
export {
    getAppsFolderPath,
    getAppFolderPath,
    getAppQuestionsFolderPath,
    ensureAppQuestionsFolder,
    listQuestionFiles,
    loadQuestion,
    loadRandomQuestion,
    saveQuestion,
} from './base/app-handler';
