import type { TaraStack } from '../tara-stack';
import { RecordManager } from '../managers/record-manager';

/**
 * LocalScope provides access to local project Tara resources.
 * Currently a stub - full implementation coming later.
 */
export class LocalScope {
  readonly tapes: LocalTapeManager;
  readonly apps: LocalAppManager;
  readonly records: RecordManager; // Shared - no scope dependency
  readonly home: LocalHomeManager;

  private workingDir: string;

  constructor(
    context: TaraStack,
    workingDir: string = process.cwd()
  ) {
    this.workingDir = workingDir;

    // Stub managers
    this.tapes = new LocalTapeManager(this.workingDir);
    this.apps = new LocalAppManager(this.workingDir);
    this.home = new LocalHomeManager(this.workingDir);

    // Shared handlers (work for both scopes)
    this.records = new RecordManager(context);
  }

  getWorkingDir(): string {
    return this.workingDir;
  }
}

/**
 * Stub implementation - minimal interface for future implementation
 */
export class LocalTapeManager {
  constructor(private workingDir: string) {}

  list(): string[] {
    // TODO: Implement local tape listing
    return [];
  }

  get(tapeId: string): never {
    throw new Error('Local tapes not yet implemented. Use tara.global.tapes instead.');
  }

  create(tapeId: string): never {
    throw new Error('Local tapes not yet implemented. Use tara.global.tapes instead.');
  }

  exists(tapeId: string): boolean {
    return false;
  }

  delete(tapeId: string): void {
    throw new Error('Local tapes not yet implemented.');
  }
}

export class LocalAppManager {
  constructor(private workingDir: string) {}

  list(): string[] {
    return [];
  }

  get(appName: string): never {
    throw new Error('Local apps not yet implemented. Use tara.global.apps instead.');
  }

  create(appName: string): never {
    throw new Error('Local apps not yet implemented. Use tara.global.apps instead.');
  }

  exists(appName: string): boolean {
    return false;
  }
}

export class LocalHomeManager {
  constructor(private workingDir: string) {}

  getPath(): string {
    return this.workingDir;
  }

  getTapesPath(): never {
    throw new Error('Local tapes path not yet defined.');
  }

  getAppsPath(): never {
    throw new Error('Local apps path not yet defined.');
  }

  getSubPath(subfolder: string): never {
    throw new Error('Local sub-paths not yet defined.');
  }
}
