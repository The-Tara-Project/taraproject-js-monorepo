import { TaraStack } from "../tara-stack";

/**
 * LocalScope provides access to local project Tara resources.
 *
 * Bootstrap pattern: Constructor only reads context.bootstrap.workingDir (no cross-manager dependencies).
 * This ensures clean construction-time separation.
 *
 * Currently a stub - full implementation coming later.
 */
export class LocalScope {

    private workingDir: string;

    constructor(
        private context: TaraStack,
    ) {
        // Bootstrap: Cache workingDir from bootstrap (construction-time only)
        this.workingDir = context.bootstrap.workingDir;
        // Note: Local tape listing is a stub - not yet implemented
        // do not implement anything here yet
    }

    getWorkingDir(): string {
        return this.workingDir;
    }
}
