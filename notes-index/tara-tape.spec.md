# Tape Infrastructure Specification

**Location**: `packages/taralib-js/src/base/tape-handler.ts`

## Core Concept

A Tape is an append-only JSONL file that serves as the authoritative source of truth for record data. Tapes prioritize simplicity, transparency, and long-term durability over performance.

## Tape File Format

- **Single file**: One tape = one `.tara.jsonl` file
- **Append-only**: Records can only be added, never modified or deleted
- **JSONL format**: One JSON record per line (newline-delimited JSON)
- **Self-describing**: Contains metadata and validation rules within the file
- **Human-readable**: Can be viewed and edited with basic text tools
- **Location**: Stored in `~/.taraproject/tapes/` directory by default
- **Naming**: `{tapeId}.tara.jsonl`

## Tape Metadata Record

The first record in every tape file is a metadata record with well-known structure:

```typescript
{
  "type": "taralib/tape-metadata",
  "tapeId": "my-tape",
  "formatVersion": "1.0.0",
  "createdAt": "2026-01-16T12:34:56.789Z",
  "__tara": {
    "id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

- **type**: Always `"taralib/tape-metadata"` for identification
- **tapeId**: Identifier for this tape
- **formatVersion**: Tape format version (currently "1.0.0")
- **createdAt**: ISO 8601 timestamp of tape creation
- Metadata is immutable once written
- Metadata is cached after first read for performance

## Handler Architecture

The tape system uses a modular handler-based architecture with clear separation of concerns:

**TaraTapeHandler (Orchestrator)**:
- Lightweight coordinator holding tape ID and path
- Exposes two specialized handlers for different storage layers
- Provides `getTapeId()` and `getPath()` accessor methods
- Created via `createTapeHandler(tapeId, tapePath?)` factory

**TapeFileHandler (File Operations)**:
- All file I/O operations for the tape
- Capabilities: instantiate, read records, append records, delete, existence checks
- Streaming reads via callback interface
- Atomic batch writes
- Accessed via `tape.fileHandler.*`

**TapeGitHandler (Git Operations)**:
- Tape-specific git operations
- Wraps generic GitHandler for reusability
- Scopes operations to individual tape file
- Repository context at tape parent folder
- Accessed via `tape.gitHandler.*`

**Explicit API Surface**:
The handler split makes storage layer interactions explicit:
- File operations: `tape.fileHandler.appendRecord(record)`
- Git operations: `tape.gitHandler.commit(message)`
- This clarity prevents confusion about which storage layer is being used

## Design Philosophy

**Authoritative Source**: The tape file is the single source of truth. Derived indexes or caches are non-authoritative and rebuildable.

**Immutability**: Records cannot be modified after writing. Update semantics are handled at application level.

**Simplicity**: No complex indexing, query engines, or transaction logs. Simple file-based storage.

**Transparency**: Human-readable format allows manual inspection and editing with standard tools.

**Durability**: Designed for long-term record stability and integrity.

**Not a Database**: Tapes are not optimized for high-performance queries or concurrent access. Use appropriate tools for those needs.

## Git Integration

**Status**: Optional (for now)

Tapes can optionally be tracked in Git repositories for version control and history.

**Repository Location**:
- Git repository is at the parent folder of the tape (for now)
- All tapes in a project typically share the same Git repository
- Example: If tape is at `~/.taraproject/tapes/my-tape.tara.jsonl`, repo is at `~/.taraproject/tapes/`

**TapeGitHandler**:
- Tape-specific git operations accessed via `tape.gitHandler.*`
- Wraps generic `GitHandler` (see `packages/taralib-js/src/base/git.ts`)
- Scopes operations to individual tape file (not all tapes)
- Operations:
  - Initialize repository
  - Commit tape file changes with custom message
  - Check repository status

**Design Benefits**:
- Append-only nature makes tapes Git-friendly (minimal merge conflicts)
- Explicit git handler separates version control from file I/O
- Silent no-op behavior when nothing to commit
- Fail-fast with exceptions for git errors