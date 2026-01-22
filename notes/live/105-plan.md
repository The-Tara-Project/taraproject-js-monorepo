# TapeHandler Refactoring Plan

## Goal

Refactor `TapeHandler` to separate concerns into distinct handlers:
- `TapeFileHandler` - handles file operations
- `TapeGitHandler` - handles git operations

This enables explicit workflows:
- `tape.fileHandler.appendRecord(...)`
- `tape.gitHandler.commit(...)`

## Design Principles

### Independence & Coordination
- Handlers are independent; they do not share state
- `TapeHandler` coordinates handlers externally
- No direct communication between handlers

### Error Handling
- Fail-fast with exceptions
- No result objects or callbacks for error handling

### No Formal Interface
- "Handler" is a generic term; no shared interface/base class
- Each handler defines its own interface
- Can be unified later if needed

### Explicit API Surface
- Callers use `tape.fileHandler.*` and `tape.gitHandler.*` explicitly
- The caller knows exactly what storage is being touched (file vs repo)
- No convenience methods that mix concerns

### Breaking Change
- No backwards compatibility
- Old: `tape.appendRecord(...)`
- New: `tape.fileHandler.appendRecord(...)`

## Architecture

```
GitHandler (base/git.ts)
    │ generic, reusable across subsystems
    │
    └── wrapped by ──► TapeGitHandler
                           │ tape-specific git operations
                           │
                           └── exposed via ──► TapeHandler.gitHandler

TapeFileHandler
    │ all file operations for a tape
    │
    └── exposed via ──► TapeHandler.fileHandler
```

### Two-Layer Strategy
- **File operations**: Direct `TapeFileHandler` (no intermediate layer)
- **Git operations**: `TapeGitHandler` wraps existing `GitHandler` from `base/git.ts`
  - `GitHandler` will be reused by other subsystems
  - Modify `GitHandler` if required

## Handler Specifications

### TapeFileHandler

**Context** (from tape):
- `tapeId`
- `path` (tape file path)

**Methods migrated from TapeHandler**:
- `instantiate()` - create tape file if not exists
- `readRecords(callback)` - read records with callback
- `appendRecord(record)` - append single record
- `appendRecordBatch(records)` - append multiple records
- `checkFile()` - throw if tape file doesn't exist
- `exists()` - check if tape file exists
- `delete()` - delete tape file
- `readMetadata()` - read and cache tape metadata

**Private helpers move here**:
- `_isValidTapeMetadata()`
- `_createTapeMetadata()`
- `_bootstrapTape()`

**Parameters**: Minimal, focused. Tape context is baked in (no need to pass `filePath`).

**Naming**: Explicit - `appendRecord`, `appendRecordBatch` (not just `append`)

### TapeGitHandler

**Context** (from tape):
- Tape file path
- Repo path (`~/.tara/tapes/`)

**Wraps**: `GitHandler` instance

**Operations**:
- Add and commit only the specific tape file (not all tapes)
- Provide proper commit messages

**Git Repository Context**:
- Repo is at `~/.tara/tapes/`
- All tapes are tracked under the same repo
- Operations are scoped to the individual tape file

### TapeHandler (Orchestrator)

**Keeps**:
- `tapeId` property
- `path` property
- `getTapeId()` method
- `getPath()` method
- Constructor

**New properties**:
- `fileHandler: TapeFileHandler`
- `gitHandler: TapeGitHandler`

**Constructor responsibilities**:
- Store `tapeId` and `path`
- Create `TapeFileHandler` instance with tape context
- Create `TapeGitHandler` instance with tape context

## File Organization

New files:
- `packages/taralib-js/src/base/tape-file-handler.ts`
- `packages/taralib-js/src/base/tape-git-handler.ts`

Modified files:
- `packages/taralib-js/src/base/tape.ts` - reduced to orchestrator
- `packages/taralib-js/src/base/git.ts` - modify if required
- `packages/taralib-js/src/index.ts` - update exports if needed

## Migration Summary

| Old API | New API |
|---------|---------|
| `tape.instantiate()` | `tape.fileHandler.instantiate()` |
| `tape.readRecords(cb)` | `tape.fileHandler.readRecords(cb)` |
| `tape.appendRecord(r)` | `tape.fileHandler.appendRecord(r)` |
| `tape.appendRecordBatch(rs)` | `tape.fileHandler.appendRecordBatch(rs)` |
| `tape.checkFile()` | `tape.fileHandler.checkFile()` |
| `tape.exists()` | `tape.fileHandler.exists()` |
| `tape.delete()` | `tape.fileHandler.delete()` |
| `tape.readMetadata()` | `tape.fileHandler.readMetadata()` |
| N/A | `tape.gitHandler.commit(...)` |
