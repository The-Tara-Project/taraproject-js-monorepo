import type { TaraStack } from '../tara-stack';
import { GTapeManager } from './managers/tape-manager';
import { AppManager } from './managers/app-manager';
import { HomeManager } from './managers/home-manager';
import { GitStorageManager } from './managers/git-storage-manager';

/**
 * GlobalScope provides access to global Tara resources in ~/.taraproject/
 */
export class GlobalScope {
    readonly tapes: GTapeManager;
    readonly apps: AppManager;
    readonly home: HomeManager;
    readonly gitst: GitStorageManager;

    constructor(
        private context: TaraStack
    ) {
        // Initialize home handler using settings from context
        this.home = new HomeManager(context);

        // Initialize managers
        this.tapes = new GTapeManager(context);
        this.apps = new AppManager(context);
        this.gitst = new GitStorageManager(context);
    }
}
