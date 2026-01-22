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
export { App, AppManager } from './stack/managers/app-manager';
export { QuestionManager } from './stack/managers/question-manager';
export { RecordManager } from './stack/managers/record-manager';
export { TapeManager } from './stack/managers/tape-manager';

// ===== Existing exports =====

// Types
export type { ITapeMetadata, ITaraRecord, SettingSource, SettingsState, TaraRecordMeta } from './base/types';


// Home folder utilities (deprecated - use HomeHandler or TaraStack.global.home instead)
export { ensureTaraHome, getTapesFolderPath, getTaraHomePath } from './base/home';

// Record utilities
export { isValidUuid4, TaraRecord } from './base/record';

// Tape operations
export {
    buildGlobalTapePath, TapeHandler
} from './base/tape-handler';

export { TapeFileHandler } from './base/tape-file-handler';
export { TapeGitHandler } from './base/tape-git-handler';

// Settings system
export { SettingsHandler } from './base/settings';

// Home handler
export { HomeHandler } from './base/home-handler';

// Git operations
export { GitHandler } from './base/git';

// App handler
export {
    ensureAppQuestionsFolder, getAppFolderPath,
    getAppQuestionsFolderPath, getAppsFolderPath, listQuestionFiles,
    loadQuestion,
    loadRandomQuestion,
    saveQuestion
} from './base/app-handler';
export type { TaraQuestion } from './base/app-handler';

