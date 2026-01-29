# TaraLib-JS Model Report

## The Big Picture

**TaraLib is a framework for managing append-only data streams (tapes) with git-based versioning and application contexts.**

Think of it like:
- **Git**: Acyclic directed graph of commits
- **TaraLib**: Append-only JSONL streams with UUID-addressed records, git-tracked, organized into scopes

---

## Core Mental Model

### The Hierarchy

```
TaraStack (entry point)
    ├─ Global Scope (resources in ~/.taraproject/)
    │   ├─ Tapes (collection manager)
    │   │   └─ TapeHandler (specific tape instance)
    │   │       ├─ TapeFileHandler (file operations)
    │   │       └─ TapeGitHandler (git operations)
    │   ├─ Apps (collection manager)
    │   │   └─ App (specific app instance)
    │   │       └─ QuestionManager (questions collection)
    │   ├─ Records (factory for creating records)
    │   ├─ Settings (configuration system)
    │   └─ Home (path utilities)
    │
    └─ Local Scope (resources in current project - stub for now)
        └─ (mirrors global structure, not yet implemented)
```

### The Pattern: Manager → Handler/Instance

**Manager** = Collection operations (list, create, delete)
**Handler/Instance** = Operations on a specific item

Example:
- `TapeManager.list()` → all tapes
- `TapeManager.create('journal')` → creates tape, returns handler
- `TapeHandler` → works with one specific tape
- `tape.fileHandler.appendRecord()` → append to this specific tape

---

## Key Abstractions

### 1. Record (The Atom)

**What**: Immutable, UUID-addressed JSON objects
**Like**: A git blob - content-addressable, immutable
**Structure**:
```typescript
{
  __tara: { id: "uuid-v4" },  // System metadata
  ...yourData                  // Your custom fields
}
```

**Properties**:
- Every record has a unique UUID v4
- Immutable after creation (frozen)
- Can be serialized to/from JSON
- No schema enforcement (flexible)

**State Machine**: Records are created → validated → serialized → written

---

### 2. Tape (The Stream)

**What**: Append-only JSONL file of records
**Like**: A git branch - linear history that only grows
**File Format**: `{tapeId}.tara.jsonl`

**Structure**:
```
Line 1: Metadata record (type: 'taralib/tape-metadata')
Line 2: First data record
Line 3: Second data record
...
```

**Properties**:
- Append-only (no edits, no deletions)
- JSONL format (one JSON object per line)
- Git-tracked (every append triggers a commit)
- Metadata record always first line
- Records can be streamed (no need to load entire file)

**Lifecycle**:
1. `TapeManager.create('name')` → creates file + folder + git repo
2. `tape.fileHandler.appendRecord(record)` → adds line to file
3. `tape.gitHandler.commit('message')` → commits change
4. `tape.fileHandler.readRecords()` → streams records back

---

### 3. App (The Context)

**What**: A named folder for organizing application data
**Like**: A namespace or project directory
**Structure**: `~/.taraproject/apps/{appName}/questions/`

**Properties**:
- Folder-based organization
- Contains question files (JSON)
- Each app is independent
- Used for separating concerns (different apps = different use cases)

**Use Case**: Different applications can have different question sets, workflows, etc.

---

### 4. Scope (Global vs Local)

**What**: Explicit separation between system-wide and project-local resources
**Philosophy**: **Never assume scope - always be explicit**

**Global Scope** (`~/.taraproject/`):
- System-wide resources
- Shared across all projects
- Default for most operations

**Local Scope** (`./.taraproject/` - not yet implemented):
- Project-specific resources
- Isolated to current working directory
- For project-specific data

**API Design**:
```typescript
tara.global.tapes.create('journal')  // Explicit global
tara.local.tapes.list()              // Explicit local
// tara.tapes.create() ❌ NOT ALLOWED - must specify scope
```

---

## Object Roles

### Manager Pattern

**What**: High-level collection operations
**Responsibilities**:
- List all items
- Create new items
- Check existence
- Delete items
- Return Handler/Instance for specific items

**Examples**:
- `TapeManager` - manages all tapes
- `AppManager` - manages all apps
- `RecordManager` - factory for creating records
- `SettingsManager` - configuration access
- `HomeManager` - path utilities

**Key Insight**: Managers don't hold state about specific items - they're stateless utilities

---

### Handler Pattern

**What**: Operations on a specific resource instance
**Responsibilities**:
- Encapsulate state (ID, path, metadata)
- Provide operations specific to this instance
- Coordinate between specialized sub-handlers

**Examples**:
- `TapeHandler` - operations on one tape
  - Holds: `tapeId`, `path`
  - Delegates to: `fileHandler`, `gitHandler`
- `App` - operations on one app
  - Holds: `name`, `context`
  - Delegates to: `QuestionManager`

**Key Insight**: Handlers are stateful - they represent a specific thing

---

### Sub-Handler Pattern

**What**: Specialized operations for a specific concern
**Responsibilities**:
- Handle one aspect of a resource (file I/O, git, etc.)
- Keep related operations together
- Separation of concerns

**Examples**:
- `TapeFileHandler` - all file operations for a tape
  - `instantiate()` - create tape file
  - `appendRecord()` - add record
  - `readRecords()` - stream records
  - `getMetadata()` - read first line
- `TapeGitHandler` - all git operations for a tape
  - `init()` - initialize git repo
  - `commit()` - commit changes

**Key Insight**: Sub-handlers enable focused, testable units

---

## Data Flow Patterns

### Creating & Writing Records

```
1. RecordManager.create(data)
   └─> TaraRecord (immutable, UUID assigned)

2. tape.fileHandler.appendRecord(record)
   ├─> Serialize record to JSON
   ├─> Append line to JSONL file
   └─> (file grows, never modified)

3. tape.gitHandler.commit('Added entry')
   └─> Git commit (snapshots tape state)
```

### Reading Records

```
1. tape.fileHandler.readRecords(callback)
   ├─> Open file stream
   ├─> For each line:
   │   ├─> Parse JSON
   │   ├─> Validate structure
   │   └─> Call callback({ parsed, lineNumber, line })
   └─> Close stream

Callback can return 'stop' to halt streaming
```

---

## Design Patterns

### 1. **Immutability**
- Records are frozen after creation
- Tapes are append-only
- No in-place edits

**Why**: Simplicity, auditability, git-friendly

---

### 2. **Stateless Managers, Stateful Handlers**
- Managers: pure functions over collections
- Handlers: encapsulate instance state

**Why**: Clear separation between "what exists" vs "working with one thing"

---

### 3. **Delegation Composition**
- TapeHandler delegates to FileHandler + GitHandler
- App delegates to QuestionManager
- Each handler focuses on one concern

**Why**: Testability, modularity, single responsibility

---

### 4. **Lazy Construction**
- Managers return new handler instances on each `.get()`
- No caching, no singletons
- Fresh state every time

**Why**: No state leaks, simpler reasoning, GC-friendly

---

### 5. **UUID as Universal Identifier**
- Every record has UUID v4
- No sequential IDs, no collisions
- Globally unique across time and space

**Why**: Distributed-friendly, no coordination needed

---

### 6. **JSONL Streaming Format**
- One JSON object per line
- Can read line-by-line (no full parse)
- Append-friendly (just add line)

**Why**: Memory-efficient for large files, simple append operations

---

### 7. **Git as Change Tracker**
- Every tape lives in a git repo
- Commits snapshot state changes
- Version history comes for free

**Why**: Time travel, auditability, existing git tools work

---

## Workflows

### Workflow 1: Creating a Tape & Adding Data

```typescript
// 1. Initialize system
const tara = new TaraStack();

// 2. Create tape (creates folder, file, git repo)
const tape = tara.global.tapes.create('journal');

// 3. Create records
const record1 = tara.global.records.create({ entry: 'Hello' });
const record2 = tara.global.records.create({ entry: 'World' });

// 4. Append records (appends to JSONL file)
tape.fileHandler.appendRecord(record1);
tape.fileHandler.appendRecord(record2);

// 5. Commit changes (git commit)
tape.gitHandler.commit('Added journal entries');
```

---

### Workflow 2: Reading from a Tape

```typescript
// 1. Get tape handler
const tape = tara.global.tapes.get('journal');

// 2. Stream records
const records: ITaraRecord[] = [];
tape.fileHandler.readRecords(({ parsed }) => {
  if (parsed.type !== 'taralib/tape-metadata') {
    records.push(parsed);
  }
});

// 3. Use records
console.log(records);
```

---

### Workflow 3: Creating an App with Questions

```typescript
// 1. Create app (creates folder structure)
const app = tara.global.apps.create('interview');

// 2. Save question
app.questions.save('greeting', {
  question: 'What is your name?',
  prompt: 'Please enter your full name'
});

// 3. List questions
const questionFiles = app.questions.list();

// 4. Load question
const question = app.questions.load('greeting.json');
```

---

## Settings System

**What**: Multi-source configuration with precedence
**Sources** (highest to lowest priority):
1. Environment variables (`TARA_*`)
2. Project config (`./taraproject.json`)
3. Global config (`~/.taraproject/config.json`)

**Behavior**:
- Settings loaded on startup
- Can be refreshed with working directory
- Used for paths, debug flags, etc.

---

## Path Structure

```
~/.taraproject/                    (TARA_HOME)
├── tapes/                         (tapes folder)
│   ├── journal.tara.jsonl         (tape file)
│   └── notes.tara.jsonl
├── apps/                          (apps folder)
│   ├── interview/
│   │   └── questions/             (questions folder)
│   │       ├── greeting.json
│   │       └── farewell.json
│   └── survey/
│       └── questions/
└── config.json                    (global settings)
```

---

## Questions & Answers

### What is a Manager?
A stateless collection operator. It lists, creates, deletes items. Returns handlers for specific items.

### What is a Handler?
A stateful instance operator. It works with one specific resource (tape, app). Coordinates operations.

### What is a Sub-Handler?
A focused specialist for one concern (file I/O, git). Keeps related operations together.

### What is a Record?
An immutable, UUID-addressed JSON object. The atomic unit of data.

### What is a Tape?
An append-only JSONL file of records, git-tracked. The linear stream of data.

### What is an App?
A named context/namespace for organizing application-specific data (questions).

### What is a Scope?
Explicit separation between global (~/.taraproject/) and local (./project) resources.

### Why append-only?
- Immutability: simpler reasoning
- Auditability: never lose history
- Git-friendly: only additions, clean diffs
- Streaming: can read without loading entire file

### Why git for tapes?
- Version control built-in
- Time travel (checkout old states)
- Existing tools work (git log, diff, etc.)
- Auditability (who changed what when)

### Why UUID over sequential IDs?
- No coordination needed
- Globally unique
- Works in distributed systems
- No collision risk

### Why JSONL over JSON array?
- Streamable (read line-by-line)
- Appendable (just add line)
- Memory-efficient (no full parse)
- Fault-tolerant (partial reads work)

---

## Type System

### Core Types

**ITaraRecord**: Any valid Tara record
```typescript
{
  __tara: { id: string },
  [key: string]: unknown
}
```

**ITapeMetadata**: Special metadata record (first line of tape)
```typescript
{
  __tara: { id: string },
  type: 'taralib/tape-metadata',
  tapeId: string,
  formatVersion: string,
  createdAt: string
}
```

**ReadRecordsCallback**: Streaming callback
```typescript
(args: { parsed: ITaraRecord, lineNumber: number, line: string }) => void | 'stop'
```

---

## Key Files

### Entry Points
- `src/tara-project.ts` - Main entry point
- `src/scopes/global-scope.ts` - Global scope wrapper
- `src/scopes/local-scope.ts` - Local scope (stub)

### Managers
- `src/managers/tape-manager.ts` - Tape collection operations
- `src/managers/app-manager.ts` - App collection operations
- `src/managers/record-manager.ts` - Record factory
- `src/managers/settings-manager.ts` - Settings access
- `src/managers/home-manager.ts` - Path utilities

### Handlers
- `src/base/tape-handler.ts` - Tape instance coordinator
- `src/base/tape-file-handler.ts` - Tape file operations
- `src/base/tape-git-handler.ts` - Tape git operations

### Core Models
- `src/base/record.ts` - TaraRecord class
- `src/base/types.ts` - Type definitions
- `src/base/settings.ts` - Settings system
- `src/base/git.ts` - Git operations

---

## Philosophy

### Explicit Over Implicit
- Always specify scope (global/local)
- No magic defaults
- Clear about what you're operating on

### Immutability
- Records can't change
- Tapes only grow
- History preserved

### Separation of Concerns
- Managers: collections
- Handlers: instances
- Sub-handlers: specialized operations
- Each does one thing well

### Git as Foundation
- Leverage existing, proven technology
- Don't reinvent version control
- Interop with git tools

### Streaming Over Loading
- JSONL enables line-by-line processing
- Don't load entire tapes into memory
- Callback-based reading

---

## Future: Local Scope

**Current State**: Stub (throws "not implemented" errors)

**Future Vision**:
- Local tapes in `./.taraproject/tapes/`
- Project-specific apps
- Isolated from global resources
- Same API as global scope

**Use Case**: Project-specific journals, logs, or data without polluting global space

---

## Summary

**TaraLib is structured as a clean hierarchy:**

1. **TaraStack** - entry point with explicit scopes
2. **Scopes** - separate global and local resources
3. **Managers** - collection operations (list, create, delete)
4. **Handlers** - instance operations (specific tape/app)
5. **Sub-Handlers** - specialized concerns (file, git)
6. **Records** - immutable, UUID-addressed data atoms
7. **Tapes** - append-only JSONL streams, git-tracked

**Key patterns:**
- Immutability everywhere
- Stateless managers, stateful handlers
- Delegation for separation of concerns
- UUID for universal identity
- Git for version control
- JSONL for streaming

**Mental model:**
Think of tapes like git branches (append-only history), records like git blobs (immutable content), and the whole system as a framework for managing data streams with built-in versioning and organization.
