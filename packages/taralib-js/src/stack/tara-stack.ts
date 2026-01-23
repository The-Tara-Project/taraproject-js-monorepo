import { GlobalScope } from './global/global-scope';
import { LocalScope } from './local/local-scope';
import { SettingsManager } from './global/managers/settings-manager';
import path from 'path/posix';
import { TaraStackSettings } from './types';

interface TaraStackOptions extends TaraStackSettings {
    [keys: string]: any;
}

/**
 * TaraStack is a unified entry point for all Tara subsystems.
 * Always use explicit scopes: tara.global.* or tara.local.*
 *
 * Bootstrap pattern: Initialization follows strict two-phase separation:
 * 1. Construction phase: Managers only use bootstrap values (no cross-manager dependencies)
 * 2. Post-construction: Settings cascade includes bootstrap as bottom fallback source
 *
 * @example
 * ```typescript
 * import { TaraStack, RecordHandler } from '@jose_pereiro/taralib-js';
 *
 * const tara = new TaraStack({ taraHome: '/custom/path' });
 *
 * // Global scope - resources in ~/.taraproject/
 * const globalTape = tara.global.tapes.get('my-journal');
 * globalTape.instantiate();
 * const record = new RecordHandler({ entry: 'Hello World' });
 * globalTape.appendRecord(record);
 *
 * // Local scope - resources in current project (stub for now)
 * const localTapes = tara.local.tapes.list();
 * ```
 */
export class TaraStack {
    readonly bootstrap: Record<string, any> = {};
    readonly settings: SettingsManager;
    readonly global: GlobalScope;
    readonly local: LocalScope;

    constructor(
        options?: TaraStackOptions
    ) {
        // Bootstrap - Resolve initialization values from options/env/defaults
        this.bootstrap.taraHome = options?.taraHome;
        this.bootstrap.workingDir = options?.workingDir ?
            path.resolve(options.workingDir) :
            process.cwd();


        // Initialize managers
        this.settings = new SettingsManager(this);
        this.global = new GlobalScope(this);
        this.local = new LocalScope(this);

        // refresh
        this.settings.refresh(options);
    }

    /**
     * Get the version of taralib.
     */
    getVersion(): string {
        // Read from package.json at runtime
        try {
            const pkg = require('../../package.json');
            return pkg.version || '0.0.0';
        } catch {
            return '0.0.0';
        }
    }
}
