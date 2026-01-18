# Tape Infrastructure Specification

**Location**: `packages/taralib-js/src/base/tape.ts`

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

## Implementation

### Class-Based API (Current)

```typescript
// Create tape handler
const tape = new TaraTape(tapeId, tapePath);
// or use factory
const tape = createTapeHandler(tapeId, tapePath?);

// File management
tape.instantiate()        // Create tape file if it doesn't exist (idempotent)
tape.exists()             // Check if tape file exists
tape.delete()             // Delete tape file (silent no-op if missing)
tape.checkFile()          // Validate file exists (throws if missing)

// Read operations
await tape.readRecords(callback)   // Stream records with callback
await tape.readMetadata()          // Read and cache metadata record

// Write operations (append-only)
tape.appendRecord(record)          // Append single record
tape.appendRecordBatch(records)    // Append multiple records atomically

// Access methods
tape.getTapeId()          // Get tape identifier
tape.getPath()            // Get file path
```

## Reading Records

The tape reader provides a streaming, callback-based interface:

```typescript
await tape.readRecords(({ parsed, lineNumber, line }) => {
  // Process each record
  console.log(`Line ${lineNumber}: ${parsed.__tara.id}`);

  // Optionally stop iteration
  if (someCondition) return 'stop';
});
```

- Records are read lazily using Node.js readline interface
- Only necessary data is loaded into memory
- Empty lines are skipped
- Corrupted records throw errors with line numbers
- Callback can return `'stop'` to halt iteration early

## Writing Records

The tape writer ensures consistent, atomic writes:

```typescript
// Single record
const record = createRecord({ data: "value" });
tape.appendRecord(record);

// Multiple records (atomic batch)
const records = [
  createRecord({ item: 1 }),
  createRecord({ item: 2 }),
];
tape.appendRecordBatch(records);
```

- Records are assumed valid (created via `createRecord`)
- Each write appends a newline-terminated JSON line
- Batch writes are atomic (single `appendFileSync` call)
- No validation on write (validation happens on read)

## Design Philosophy

**Authoritative Source**: The tape file is the single source of truth. Derived indexes or caches are non-authoritative and rebuildable.

**Immutability**: Records cannot be modified after writing. Update semantics are handled at application level.

**Simplicity**: No complex indexing, query engines, or transaction logs. Simple file-based storage.

**Transparency**: Human-readable format allows manual inspection and editing with standard tools.

**Durability**: Designed for long-term record stability and integrity.

**Not a Database**: Tapes are not optimized for high-performance queries or concurrent access. Use appropriate tools for those needs.

## Git Integration

- Tapes can be tracked in Git repositories for version control
- All tapes in a project typically share the same Git repository
- See `packages/taralib-js/src/base/git.ts` for Git operations
- Append-only nature makes tapes Git-friendly (minimal merge conflicts)