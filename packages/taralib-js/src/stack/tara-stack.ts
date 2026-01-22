import { GlobalScope } from './scopes/global-scope';
import { LocalScope } from './scopes/local-scope';
import { SettingsHandler } from '../base/settings';

export interface TaraStackOptions {
  debug?: boolean;
  taraHome?: string; // Override TARA_HOME (global)
  workingDir?: string; // Override working directory (local)
}

/**
 * TaraStack is a unified entry point for all Tara subsystems.
 * Always use explicit scopes: tara.global.* or tara.local.*
 *
 * @example
 * ```typescript
 * const tara = new TaraStack();
 *
 * // Global scope - resources in ~/.taraproject/
 * const globalTape = tara.global.tapes.create('my-journal');
 * const record = tara.global.records.create({ entry: 'Hello World' });
 * globalTape.fileHandler.appendRecord(record);
 *
 * // Local scope - resources in current project (stub for now)
 * const localTapes = tara.local.tapes.list();
 * ```
 */
export class TaraStack {
  readonly settings: SettingsHandler;
  readonly global: GlobalScope;
  readonly local: LocalScope;

  constructor(options?: TaraStackOptions) {
    // Apply options to environment
    if (options?.taraHome) {
      process.env.TARA_HOME = options.taraHome;
    }
    if (options?.debug !== undefined) {
      process.env.TARA_DEBUG = String(options.debug);
    }

    // Initialize settings handler (used by scopes)
    this.settings = new SettingsHandler();
    this.settings.refresh(options?.workingDir);

    // Initialize scopes
    this.global = new GlobalScope(this);
    this.local = new LocalScope(this, options?.workingDir);
  }

  /**
   * Get the version of taralib.
   */
  getVersion(): string {
    return '0.1.0'; // TODO: Read from package.json
  }
}
