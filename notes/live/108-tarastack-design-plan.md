# Tara Stack Design Plan: Top-Level Entry Point

## Overview

This document outlines the design strategy for creating a top-level entry point class (`TaraStack`) for the Tara stack, inspired by the Obsidian app pattern. This will provide a unified interface to access all Tara subsystems: tapes, apps, records, settings, and home infrastructure.

---

## Current Architecture Analysis

### Project Structure

```
taralib-js/src/
├── base/
│   ├── types.ts              # Core type definitions
│   ├── record.ts             # TaraRecord class
│   ├── home.ts               # TARA_HOME path utilities
│   ├── settings.ts           # Settings system
│   ├── tape-handler.ts       # Tape coordinator
│   ├── tape-file-handler.ts  # File I/O
│   ├── tape-git-handler.ts   # Git operations
│   ├── git.ts                # GitHandler class
│   └── app-handler.ts        # App/questions management
└── index.ts                  # Main exports
```

### Current Data Organization

**Tapes** - Append-only JSONL files in `~/.taraproject/tapes/`
- Format: `{tapeId}.tara.jsonl`
- First line: Metadata record
- Following lines: User data as JSON records

**Apps** - Configuration containers in `~/.taraproject/apps/`
- Structure: `~/.taraproject/apps/{appName}/questions/`
- Questions stored as individual JSON files

**Records** - Immutable versioned objects
- Every record has unique UUID v4 in `__tara.id`
- Content frozen after creation via `Object.freeze()`

### Existing Architectural Patterns

1. **Composition over Inheritance**
   - `TapeHandler` composes `TapeFileHandler` and `TapeGitHandler`
   - No class inheritance hierarchies

2. **Strategy Pattern**
   - File operations and Git operations are separate strategies
   - Coordinator selects which to use

3. **Settings Cascade**
   - Multiple sources: env → project → global
   - Per-key source priority overrides available

4. **Immutability Pattern**
   - Records frozen after creation
   - Content accessed through getters

5. **Callback Pattern**
   - Streaming reads via callbacks
   - Allows `return 'stop'` to halt iteration

### Design Strengths

- ✅ Separation of concerns (File I/O isolated from Git)
- ✅ Immutability & safety (Append-only operations)
- ✅ Composition-based (Easy to understand dependencies)
- ✅ Type safety (Full TypeScript with interfaces)
- ✅ Testability (Pure functions, dependency injection)
- ✅ Flexibility (Settings cascade, TARA_HOME configurability)

---

## Design Recommendation: TaraStack Class

### Vision: Single Context Object

Create a `TaraStack` class as the main entry point, similar to how Obsidian provides a unified `app` object:

```typescript
// Usage example
const tara = new TaraStack();
await tara.initialize();

// Now you can:
const tapes = tara.tapes.list();
const apps = tara.apps.list();
const record = tara.records.create({ data: 'value' });
```

### Proposed Architecture

```typescript
class TaraStack {
  // Sub-managers (lazy-loaded)
  readonly tapes: TapeManager;
  readonly apps: AppManager;
  readonly records: RecordManager;
  readonly settings: SettingsManager;
  readonly home: HomeManager;

  // Initialization
  async initialize(options?: TaraStackOptions): Promise<void>;

  // Utility methods
  getVersion(): string;
  getHomePath(): string;
  isInitialized(): boolean;
}
```

---

## Key Design Decisions

### 1. Initialization Pattern

Settings must be loaded first (affects everything else):

```typescript
class TaraStack {
  private _initialized = false;

  async initialize(): Promise<void> {
    if (this._initialized) return;

    // 1. Load settings first (affects everything)
    refreshSettings();

    // 2. Ensure home directory structure
    await ensureTaraHome();

    // 3. Mark as ready
    this._initialized = true;
  }

  assertInitialized(): void {
    if (!this._initialized) {
      throw new Error('TaraStack not initialized. Call initialize() first.');
    }
  }
}
```

**Why:** Settings control TARA_HOME location, debug flags, and other global configuration. Everything depends on knowing the correct home path.

### 2. Manager Pattern for Each Domain

Instead of putting all methods on one giant class, use specialized managers:

#### TapeManager

```typescript
class TapeManager {
  list(): string[];                          // List all tape IDs
  get(tapeId: string): TapeHandler;     // Get handler for specific tape
  create(tapeId: string): TapeHandler;   // Create new tape
  exists(tapeId: string): boolean;           // Check if tape exists
  delete(tapeId: string): void;              // Delete a tape
}
```

#### AppManager & App

```typescript
class AppManager {
  list(): string[];                          // List all app names
  get(appName: string): App;                 // Get app context
  create(appName: string): App;              // Create new app
  exists(appName: string): boolean;          // Check if app exists
}

class App {
  readonly name: string;
  readonly questions: QuestionManager;

  getPath(): string;
  delete(): void;
}
```

#### QuestionManager

```typescript
class QuestionManager {
  list(): string[];                          // List question file names
  get(fileName: string): TaraQuestion | null;
  getRandom(): TaraQuestion | null;
  save(fileName: string, q: TaraQuestion): void;
  delete(fileName: string): void;
}
```

#### RecordManager

```typescript
class RecordManager {
  create<T>(content: T): TaraRecord<T>;      // Create new record
  fromJSON<T>(json: string): TaraRecord<T>;  // Parse from JSON
  validate(record: any): boolean;            // Validate record format
}
```

**Why:** Each manager has a clear, focused responsibility. Easy to test, extend, and understand.

### 3. Lazy Loading for Performance

Don't initialize everything upfront:

```typescript
class TapeManager {
  private _handlers = new Map<string, TapeHandler>();

  get(tapeId: string): TapeHandler {
    if (!this._handlers.has(tapeId)) {
      this._handlers.set(tapeId, new TapeHandler(tapeId));
    }
    return this._handlers.get(tapeId)!;
  }
}
```

**Why:** Creating handlers is lightweight, but we only pay the cost when actually needed.

---

## Proposed Implementation Structure

### File Organization

```
src/
├── base/
│   └── (existing files...)
├── managers/
│   ├── index.ts              # Export all managers
│   ├── tape-manager.ts
│   ├── app-manager.ts
│   ├── question-manager.ts
│   ├── record-manager.ts
│   ├── settings-manager.ts
│   └── home-manager.ts
├── tara-project.ts           # Main entry point
└── index.ts                  # Update to export TaraStack
```

### Core Implementation: TaraStack

```typescript
// src/tara-project.ts
export class TaraStack {
  private _initialized = false;

  readonly tapes: TapeManager;
  readonly apps: AppManager;
  readonly records: RecordManager;
  readonly settings: SettingsManager;
  readonly home: HomeManager;

  constructor(private options?: TaraStackOptions) {
    this.tapes = new TapeManager(this);
    this.apps = new AppManager(this);
    this.records = new RecordManager(this);
    this.settings = new SettingsManager(this);
    this.home = new HomeManager(this);
  }

  async initialize(): Promise<void> {
    if (this._initialized) return;
    refreshSettings();
    await ensureTaraHome();
    this._initialized = true;
  }

  assertInitialized(): void {
    if (!this._initialized) {
      throw new Error('TaraStack not initialized. Call initialize() first.');
    }
  }

  isInitialized(): boolean {
    return this._initialized;
  }

  getHomePath(): string {
    return getTaraHomePath();
  }

  getVersion(): string {
    // Return version from package.json
    return '0.1.0';
  }
}

export interface TaraStackOptions {
  debug?: boolean;
  taraHome?: string; // Optional override for TARA_HOME
}
```

### TapeManager Implementation

```typescript
// src/managers/tape-manager.ts
export class TapeManager {
  private _handlers = new Map<string, TapeHandler>();

  constructor(private context: TaraStack) {}

  list(): string[] {
    this.context.assertInitialized();
    const tapesPath = getTapesFolderPath();
    if (!fs.existsSync(tapesPath)) return [];

    return fs.readdirSync(tapesPath)
      .filter(f => f.endsWith('.tara.jsonl'))
      .map(f => f.replace('.tara.jsonl', ''));
  }

  get(tapeId: string): TapeHandler {
    this.context.assertInitialized();
    if (!this._handlers.has(tapeId)) {
      this._handlers.set(tapeId, new TapeHandler(tapeId));
    }
    return this._handlers.get(tapeId)!;
  }

  create(tapeId: string): TapeHandler {
    this.context.assertInitialized();
    if (this.exists(tapeId)) {
      throw new Error(`Tape "${tapeId}" already exists`);
    }
    const tape = new TapeHandler(tapeId);
    tape.fileHandler.instantiate();
    tape.gitHandler.init();
    return tape;
  }

  exists(tapeId: string): boolean {
    this.context.assertInitialized();
    return this.list().includes(tapeId);
  }

  delete(tapeId: string): void {
    this.context.assertInitialized();
    const path = buildGlobalTapePath(tapeId);
    if (fs.existsSync(path)) {
      fs.unlinkSync(path);
      this._handlers.delete(tapeId);
    }
  }
}
```

### AppManager Implementation

```typescript
// src/managers/app-manager.ts
export class AppManager {
  constructor(private context: TaraStack) {}

  list(): string[] {
    this.context.assertInitialized();
    const appsPath = getAppsFolderPath();
    if (!fs.existsSync(appsPath)) return [];

    return fs.readdirSync(appsPath).filter(f => {
      const fullPath = path.join(appsPath, f);
      return fs.statSync(fullPath).isDirectory();
    });
  }

  get(appName: string): App {
    this.context.assertInitialized();
    return new App(appName, this.context);
  }

  create(appName: string): App {
    this.context.assertInitialized();
    const appPath = getAppFolderPath(appName);
    if (!fs.existsSync(appPath)) {
      fs.mkdirSync(appPath, { recursive: true });
    }
    return this.get(appName);
  }

  exists(appName: string): boolean {
    this.context.assertInitialized();
    return this.list().includes(appName);
  }
}

export class App {
  readonly name: string;
  readonly questions: QuestionManager;

  constructor(
    name: string,
    private context: TaraStack
  ) {
    this.name = name;
    this.questions = new QuestionManager(name, context);
  }

  getPath(): string {
    return getAppFolderPath(this.name);
  }

  delete(): void {
    const appPath = this.getPath();
    if (fs.existsSync(appPath)) {
      fs.rmSync(appPath, { recursive: true });
    }
  }
}
```

---

## Design Advantages

### Single Entry Point
- Users only need to know about `TaraStack`
- All subsystems accessible through one object
- Familiar pattern from Obsidian API

### Focused Managers
- Each manager has clear, single responsibility
- Easy to test independently
- Simple to add new managers later

### Lazy Loading
- Only create objects when needed
- Better performance for simple use cases
- No unnecessary initialization

### Type Safety
- Full TypeScript throughout
- Clear API contracts
- IDE autocomplete support

### Testability
- Easy to mock individual managers
- Can test initialization order
- Subsystems can be tested in isolation

### Extensibility
- Easy to add hooks/events later
- Plugin system can be built on top
- New managers can be added without changing TaraStack

---

## Why This Design Works

### Follows Existing Patterns
- Uses composition like `TapeHandler` already does ✅
- Respects immutability and append-only operations ✅
- Maintains separation of concerns ✅

### Compatible with Current Code
- Doesn't break existing exports
- Can migrate gradually to new API
- Old code continues to work alongside new code

### Matches User Expectations
- Similar to Obsidian's `app` pattern
- Intuitive for app developers
- Clear path to common operations

---

## Migration Path

### Phase 1: Add TaraStack Class
- Implement `TaraStack` and all managers
- Keep existing exports working
- Add new exports for managers

```typescript
// index.ts - Both old and new work
export { TaraStack } from './tara-project';
export { TapeHandler, TapeFileHandler } from './base/tape-handler';
// ... existing exports
```

### Phase 2: Gradually Migrate Consumers
```typescript
// Old way (still works):
const tape = new TapeHandler('my-tape');

// New way (recommended):
const tara = new TaraStack();
await tara.initialize();
const tape = tara.tapes.get('my-tape');
```

### Phase 3: Optional Enhancements
- Add workflow helpers (recordActivity, etc.)
- Add event system for plugins
- Add plugin registry

---

## Advanced Features (Future)

### Workflow Helpers

```typescript
class TaraStack {
  async recordActivity(tapeId: string, data: any): Promise<void> {
    const tape = this.tapes.get(tapeId);
    const record = this.records.create(data);
    tape.fileHandler.appendRecord(record);
    await tape.gitHandler.commit('Record activity');
  }

  async recordBatch(tapeId: string, records: any[]): Promise<void> {
    const tape = this.tapes.get(tapeId);
    const taraRecords = records.map(r => this.records.create(r));
    await tape.fileHandler.appendRecordBatch(taraRecords);
    await tape.gitHandler.commit(`Record ${records.length} items`);
  }
}
```

### Event System

```typescript
class TaraStack extends EventEmitter {
  on(event: 'record:created', handler: (record: TaraRecord) => void);
  on(event: 'tape:created', handler: (tapeId: string) => void);
  on(event: 'app:created', handler: (appName: string) => void);

  emit(event: string, data: any): void;
}
```

### Plugin System

```typescript
interface TaraPlugin {
  name: string;
  version: string;
  onLoad(tara: TaraStack): Promise<void>;
  onUnload(): Promise<void>;
}

class TaraStack {
  registerPlugin(plugin: TaraPlugin): void;
  getPlugin(name: string): TaraPlugin | undefined;
}
```

---

## Summary

This design provides:

1. **Unified Entry Point** - One `TaraStack` class to rule them all
2. **Manager Pattern** - Each subsystem has focused responsibility
3. **Lazy Loading** - Only create objects when needed
4. **Type Safety** - Full TypeScript support
5. **Extensibility** - Easy to add plugins, hooks, workflows
6. **Backward Compatibility** - Old code continues to work
7. **Familiar API** - Inspired by proven Obsidian pattern

The implementation can be done incrementally, starting with core managers and gradually adding advanced features.
