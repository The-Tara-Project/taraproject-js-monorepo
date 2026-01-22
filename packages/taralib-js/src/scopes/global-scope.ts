import type { TaraStack } from '../tara-project';
import { TapeManager } from '../managers/tape-manager';
import { AppManager } from '../managers/app-manager';
import { RecordManager } from '../managers/record-manager';
import { SettingsManager } from '../managers/settings-manager';
import { HomeHandler } from '../base/home-handler';

/**
 * GlobalScope provides access to global Tara resources in ~/.taraproject/
 */
export class GlobalScope {
  readonly tapes: TapeManager;
  readonly apps: AppManager;
  readonly records: RecordManager;
  readonly settings: SettingsManager;
  readonly home: HomeHandler;

  constructor(context: TaraStack) {
    // Initialize settings first (needed by other components)
    this.settings = new SettingsManager(context);

    // Initialize home handler using settings handler
    this.home = new HomeHandler(this.settings.handler);

    // Initialize other managers
    this.tapes = new TapeManager(context);
    this.apps = new AppManager(context);
    this.records = new RecordManager(context);
  }
}
