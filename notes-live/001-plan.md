# Tara Project Bootstrap Implementation Plan

## Overview

Bootstrap the core Tara system with minimal viable functionality:
- `.taraproject` folder management
- Tara Record creation with UUID identifiers
- Tara Tape file format (JSONL, append-only)
- Basic read/write workflow

**Scope**: Minimal, simple, extensible. No Git-Storage, no plugins, no MCP server.

---

## Milestone 1: Project Setup & Core Types

### 1.1 Define Core Types
- `TaraRecord` interface with `__tara.id` (uuid4) as the only required field
- `TaraTapeMetadata` interface for the first record in a tape
- `TaraTape` type representing the tape abstraction

### 1.2 File Structure
```
packages/taralib-js/src/
├── index.ts              # Public exports
├── types.ts              # Core type definitions
├── record.ts             # Record creation utilities
├── tape.ts               # Tape read/write operations
└── home.ts               # .taraproject folder management
```

---

## Milestone 2: `.taraproject` Home Folder

### 2.1 Home Folder Utilities
- `getTaraHomePath()` → returns `~/.taraproject`
- `getTapesFolderPath()` → returns `~/.taraproject/tapes`
- `ensureTaraHome()` → creates folders if missing

### 2.2 Behavior
- Lazy initialization (create on first write, not on read)
- Platform-agnostic path resolution using `os.homedir()`

---

## Milestone 3: Tara Record

### 3.1 Record Creation
- `createRecord(content: object)` → adds `__tara.id` (uuid4) to content
- Uses `crypto.randomUUID()` for identifier generation

### 3.2 Record Validation
- `isValidRecord(obj)` → checks for valid `__tara.id` uuid4 format
- Minimal validation: only `__tara.id` is enforced

---

## Milestone 4: Tara Tape

### 4.1 Tape Metadata
- First line of tape is always a metadata record
- Contains: `tapeId`, `formatVersion`, `createdAt` (ISO 8601)

### 4.2 Tape Operations
- `createTape(tapeId: string)` → creates new tape file with metadata record
- `appendRecord(tapePath: string, record: TaraRecord)` → appends JSONL line
- `readTape(tapePath: string)` → reads and parses all records
- `getTapePath(tapeId: string)` → resolves path in `~/.taraproject/tapes/`

### 4.3 JSONL Format
- One JSON object per line
- No pretty-printing (single line per record)
- Append-only (no in-place edits)

---

## Milestone 5: Integration Test

### 5.1 End-to-End Validation Test
Implement `test/integration.spec.ts`:
1. Create a new tape with unique ID
2. Create a record with test content
3. Append record to tape
4. Read tape back
5. Assert record content matches original
6. Clean up test tape

### 5.2 Unit Tests
- `record.spec.ts` → record creation, uuid validation
- `tape.spec.ts` → tape CRUD operations
- `home.spec.ts` → folder path resolution

---

## Implementation Order

| Step | Task | Output |
|------|------|--------|
| 1 | Define `types.ts` with core interfaces | Type definitions |
| 2 | Implement `home.ts` folder utilities | Home folder management |
| 3 | Implement `record.ts` record creation | Record factory |
| 4 | Implement `tape.ts` tape operations | Tape read/write |
| 5 | Update `index.ts` with public exports | Public API |
| 6 | Write unit tests for each module | Test coverage |
| 7 | Write integration test (create→store→read→check) | E2E validation |

---

## Design Principles

- **Minimal**: Only what's needed for bootstrap
- **Extensible**: Types and functions designed for future generalization
- **Immutable**: Records and tapes are append-only
- **Transparent**: JSONL format is human-readable
- **Testable**: Pure functions where possible, clear I/O boundaries

---

## Out of Scope (Later Milestones)

- Git-Storage subsystem
- Plugin architecture
- MCP Server API
- Remote/cloud storage
- Content hashing (`content.hash`, `canonical.hash`)
- CLI commands
- StdLib utilities
