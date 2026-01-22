import type { TaraStack } from '../tara-stack';
import { TapeManager } from '../managers/tape-manager';
import { AppManager } from '../managers/app-manager';
import { RecordManager } from '../managers/record-manager';
import { HomeHandler } from '../../base/home-handler';

/**
 * GlobalScope provides access to global Tara resources in ~/.taraproject/
 */
export class GlobalScope {
  readonly tapes: TapeManager;
  readonly apps: AppManager;
  readonly records: RecordManager;
  readonly home: HomeHandler;

  constructor(context: TaraStack) {
    // Initialize home handler using settings from context
    this.home = new HomeHandler(context.settings);

    // Initialize managers
    this.tapes = new TapeManager(context);
    this.apps = new AppManager(context);
    this.records = new RecordManager(context);
  }
}
