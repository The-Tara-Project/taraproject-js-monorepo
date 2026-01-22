# TaraStack vs Base: Architectural Layers

## The Two-Layer Architecture

```
┌─────────────────────────────────────────────┐
│  STACK LAYER (Integration/Application)     │
│  - Depends on or receives TaraStack        │
│  - Provides workflows and coordination      │
│  - Can have sub-layers                      │
└─────────────────────────────────────────────┘
                    ↓ uses
┌─────────────────────────────────────────────┐
│  BASE LAYER (Primitives/Building Blocks)   │
│  - Zero dependency on TaraStack             │
│  - Pure functions and standalone classes    │
│  - Can compose with each other              │
└─────────────────────────────────────────────┘
```

---

## Current Classification

### BASE Layer (Primitives)

**Location**: `src/base/`

These are building blocks with **zero knowledge of TaraStack**. They can be used independently or composed together.

#### Record Primitives
- **`record.ts`** - `TaraRecord` class
  - Immutable, UUID-addressed data atoms
  - Static methods: `fromObject()`, `fromJSON()`, `isValid()`
  - No dependencies

#### Tape Primitives
- **`tape-handler.ts`** - `TapeHandler` class
  - Coordinates operations on a specific tape
  - Constructor: `TapeHandler(tapeId, tapePath?)`
  - Composes: `TapeFileHandler` + `TapeGitHandler`
  - No TaraStack dependency

- **`tape-file-handler.ts`** - `TapeFileHandler` class
  - File I/O operations for tapes
  - JSONL reading/writing, metadata handling
  - Depends on: `TapeHandler` (base primitive)

- **`tape-git-handler.ts`** - `TapeGitHandler` class
  - Git operations for tapes
  - Init, commit, checkout
  - Depends on: `TapeHandler` + `GitHandler`

#### Git Primitive
- **`git.ts`** - `GitHandler` class
  - Low-level git operations
  - Constructor: `GitHandler(repoPath)`
  - Pure git wrapper, no Tara concepts

#### Settings Primitives
- **`settings.ts`** - Settings functions
  - `refreshSettings(workingDir?)` - load settings
  - `getSetting(key, defaultValue?)` - retrieve value
  - `getRawValue(key, source)` - get from specific source
  - `isSettingsLoaded()` - check state
  - Pure functions, no TaraStack

#### Home Path Primitives
- **`home.ts`** - Path utility functions
  - `getTaraHomePath()` - get TARA_HOME
  - `getTapesFolderPath()` - get tapes folder
  - `ensureTaraHome()` - create folders
  - Pure functions, no TaraStack

#### App/Question Primitives
- **`app-handler.ts`** - App/question functions
  - `getAppFolderPath(appName)` - get app path
  - `loadQuestion(filePath)` - load question JSON
  - `saveQuestion(appName, fileName, question)` - save question
  - `listQuestionFiles(appName)` - list questions
  - Pure functions, no TaraStack

#### Type Definitions
- **`types.ts`** - Core type definitions
  - `ITaraRecord` - record structure
  - `ITapeMetadata` - tape metadata
  - `ReadRecordsCallback` - streaming callback
  - `SettingsState` - settings structure

---

### STACK Layer (Integration)

**Location**: `src/`, `src/managers/`, `src/scopes/`

These components integrate primitives into workflows. They receive or depend on `TaraStack` context.

#### Core Stack
- **`tara-project.ts`** - `TaraStack` class
  - Main entry point
  - Manages global/local scopes
  - Sets up environment (TARA_HOME, debug)
  - Coordinates managers

#### Scope Sub-Layer
- **`scopes/global-scope.ts`** - `GlobalScope` class
  - Container for global managers
  - Constructor: `GlobalScope(context: TaraStack)`
  - Instantiates: all managers

- **`scopes/local-scope.ts`** - `LocalScope` class
  - Container for local managers (stub)
  - Constructor: `LocalScope(context: TaraStack, workingDir?)`
  - Manages working directory

#### Manager Sub-Layer

**Pattern**: All managers receive `TaraStack` context (even if currently unused)

- **`managers/tape-manager.ts`** - `TapeManager`
  - Workflow: list, create, delete tapes
  - Uses: base tape primitives
  - Context: `TaraStack` (for future extension)

- **`managers/app-manager.ts`** - `AppManager` + `App`
  - Workflow: list, create, delete apps
  - Uses: base app primitives
  - `App` class: instance representation
  - Context: `TaraStack` (for future extension)

- **`managers/record-manager.ts`** - `RecordManager`
  - Workflow: create, parse, validate records
  - Uses: base `TaraRecord` primitive
  - Context: `TaraStack` (for future extension)

- **`managers/settings-manager.ts`** - `SettingsManager`
  - Workflow: access settings via object API
  - Uses: base settings functions
  - Context: `TaraStack` (for future extension)

- **`managers/home-manager.ts`** - `HomeManager`
  - Workflow: access paths via object API
  - Uses: base home functions
  - Context: `TaraStack` (for future extension)

- **`managers/question-manager.ts`** - `QuestionManager`
  - Workflow: manage questions for a specific app
  - Uses: base app-handler functions
  - Context: `TaraStack` (for future extension)

---

## Key Distinctions

### BASE Primitives
- ✅ Can be imported and used standalone
- ✅ No TaraStack import or dependency
- ✅ Can compose with other base primitives
- ✅ Pure functions or self-contained classes
- ✅ Example: `new TapeHandler('journal', '/path/to/tape')`

### STACK Components
- ✅ Integrate primitives into workflows
- ✅ Receive `TaraStack` context (for coordination)
- ✅ Provide high-level, opinionated APIs
- ✅ Handle scope (global/local) concerns
- ✅ Example: `tara.global.tapes.create('journal')`

---

## Design Rationale

### Why Managers Receive Context (Even if Unused)

Currently, managers receive `context: TaraStack` but don't use it. This is intentional:

1. **Future Extensibility**: Managers may need settings, logging, or inter-manager communication
2. **Consistent Signature**: All managers follow the same construction pattern
3. **Clear Layer Boundary**: Receiving context marks them as "Stack layer"
4. **Refactoring Safety**: If we add stack-level features, managers can access them

### The Context is Reserved, Not Required

```typescript
// Manager doesn't use context now
class TapeManager {
  constructor(private context: TaraStack) {}

  list(): string[] {
    // Uses base primitives directly
    return listTapesFromFolder(getTapesFolderPath());
  }
}

// But context is available for future needs:
// - this.context.global.settings.get('debug')
// - this.context.global.home.getPath()
// - Inter-manager coordination
```

---

## Ontology History

### Phase 1: Pre-Architecture (Initial State)

**Problem**: Everything mixed together
- No clear separation between primitives and workflows
- Direct file system operations scattered everywhere
- Hard to test, hard to understand dependencies

### Phase 2: Base/Handlers Extraction

**Insight**: Core operations don't need `TaraStack`
- Extracted tape operations → `TapeHandler`
- Extracted git operations → `GitHandler`
- Extracted record operations → `TaraRecord`
- Created pure functions for settings, home paths

**Result**: Primitives emerged naturally

### Phase 3: Manager Pattern Introduction

**Insight**: Need high-level workflows
- Created managers for collections (list, create, delete)
- Managers coordinate primitives
- Introduced `TaraStack` (now `TaraStack`) as integration point

**Result**: Two-layer architecture formed

### Phase 4: Scope Introduction (Recent)

**Insight**: Need explicit global/local separation
- Introduced `GlobalScope` and `LocalScope`
- All access requires explicit scope
- Managers live inside scopes

**Result**: Stack layer gained structure

### Phase 5: Naming Clarification (Current)

**Insight**: "Project" implies user code, not framework
- Renamed `TaraStack` → `TaraStack`
- Clarified: Stack = framework integration layer
- Clarified: Base = reusable primitives

**Result**: Architecture intent is now clear

---

## Usage Patterns

### Direct Primitive Usage (Advanced)

When you need full control:

```typescript
import { TapeHandler } from '@jose_pereiro/taralib-js';

// Directly use primitive
const tape = new TapeHandler('journal', '/custom/path/journal.tara.jsonl');
tape.fileHandler.appendRecord(record);
tape.gitHandler.commit('Added entry');
```

### Stack Usage (Standard)

When you want workflows and coordination:

```typescript
import { TaraStack } from '@jose_pereiro/taralib-js';

// Use integrated stack
const tara = new TaraStack();
const tape = tara.global.tapes.create('journal');
tape.fileHandler.appendRecord(record);
tape.gitHandler.commit('Added entry');
```

### Composed Primitives (Custom Workflows)

When you want to build your own integration:

```typescript
import {
  TapeHandler,
  TaraRecord,
  refreshSettings
} from '@jose_pereiro/taralib-js';

// Custom composition
refreshSettings();
const tape = new TapeHandler('journal');
const record = new TaraRecord({ entry: 'Hello' });
tape.fileHandler.appendRecord(record);
```

---

## Decision: Why Context is Optional But Present

**Current State**: Managers receive `context: TaraStack` but don't use it

**Options Considered**:
1. Remove context → make managers pure primitives
2. Keep context → maintain stack integration capability
3. Make context optional → hybrid approach

**Decision**: Keep context (Option 2)

**Rationale**:
- Managers ARE workflow coordinators, not primitives
- Context enables future stack-level features (logging, settings, inter-manager communication)
- Clear architectural boundary: "receives context" = "stack layer"
- If someone wants primitive-only, they use base classes directly
- Consistent pattern across all managers

---

## Dependency Graph

```
TaraStack
    ↓
GlobalScope / LocalScope
    ↓
Managers (receive stack context)
    ↓
Base Primitives (pure functions/classes)
    ↓
Node.js APIs (fs, path, crypto)
```

**Allowed**:
- Stack → Base ✅
- Base → Base ✅
- Stack → Stack ✅

**Forbidden**:
- Base → Stack ❌

---

## File Organization

```
src/
├── tara-project.ts          [STACK] Main entry
├── index.ts                 [STACK] Public API
│
├── scopes/                  [STACK] Scope layer
│   ├── global-scope.ts
│   ├── local-scope.ts
│   └── index.ts
│
├── managers/                [STACK] Manager layer
│   ├── tape-manager.ts
│   ├── app-manager.ts
│   ├── record-manager.ts
│   ├── settings-manager.ts
│   ├── home-manager.ts
│   ├── question-manager.ts
│   └── index.ts
│
└── base/                    [BASE] Primitive layer
    ├── record.ts           (TaraRecord class)
    ├── tape-handler.ts     (TapeHandler)
    ├── tape-file-handler.ts
    ├── tape-git-handler.ts
    ├── git.ts              (GitHandler)
    ├── settings.ts         (settings functions)
    ├── home.ts             (path functions)
    ├── app-handler.ts      (app/question functions)
    └── types.ts            (type definitions)
```

---

## Testing Strategy

### Base Layer Tests
- Test primitives in isolation
- No TaraStack setup needed
- Direct instantiation: `new TapeHandler(...)`

### Stack Layer Tests
- Test workflows through TaraStack
- Setup TaraStack instance
- Test manager coordination

**Example**:

```typescript
// Base layer test
it('should append record to tape', () => {
  const tape = new TapeHandler('test', '/tmp/test.tara.jsonl');
  const record = new TaraRecord({ data: 'test' });
  tape.fileHandler.appendRecord(record);
  // ... assertions
});

// Stack layer test
it('should create tape via manager', () => {
  const tara = new TaraStack();
  const tape = tara.global.tapes.create('test');
  // ... assertions
});
```

---

## Future Considerations

### When Context Becomes Useful

Examples of future stack-level features managers might need:

1. **Logging**: `this.context.global.settings.get('debug')`
2. **Path Resolution**: `this.context.global.home.getPath()`
3. **Inter-Manager Communication**: Cross-manager workflows
4. **Hooks/Events**: Stack-level event system
5. **Transaction Coordination**: Multi-manager operations

### Local Scope Implementation

When local scope is implemented:
- Local managers will use `workingDir` from context
- Settings will resolve from local project config
- Same pattern: context enables coordination

---

## Summary

**Two Layers**:
1. **BASE** - Primitives, no TaraStack dependency
2. **STACK** - Integration, receives TaraStack context

**Philosophy**:
- Base = building blocks you can compose
- Stack = canonical composition with workflows
- Context = integration capability (present, not required)

**Key Insight**:
The architecture is already clean. Managers receive context not because they need it now, but because they're part of the stack integration layer and may need it as the system grows.

**Naming**:
- `TaraStack` (not TaraStack) - emphasizes framework integration
- "Base" (not "utils" or "lib") - emphasizes foundation layer
- "Stack" (not "app") - emphasizes layered architecture
