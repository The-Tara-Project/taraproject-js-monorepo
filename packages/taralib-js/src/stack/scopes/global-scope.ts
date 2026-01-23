import type { TaraStack } from '../tara-stack';
import { GTapeManager } from '../managers/tape-manager';
import { AppManager } from '../managers/app-manager';
import { HomeHandler } from '../../base/home-handler';

/**
 * GlobalScope provides access to global Tara resources in ~/.taraproject/
 */
export class GlobalScope {
  readonly tapes: GTapeManager;
  readonly apps: AppManager;
  readonly home: HomeHandler;

  constructor(context: TaraStack) {
    // Initialize home handler using settings from context
    this.home = new HomeHandler(context.settings);

    // Initialize managers
    this.tapes = new GTapeManager(context);
    this.apps = new AppManager(context);
  }
}
