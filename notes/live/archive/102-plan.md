# Tara Tape Refactoring Plan

## Overview
Refactor the Tara Tape implementation to support lazy streaming of records from disk, eliminating the need to load entire tape files into memory. This is critical for handling long tape files stored in the Tara Home directory.

## Design Decisions (from questionnaire)
1. **API Style**: Functional API (not class-based), TaraTape as TypeScript interface
2. **Error Handling**: Fail fast - stop iteration and throw on corrupted records
3. **Concurrency**: Single-writer assumption, no concurrency protection needed
4. **Iteration**: Simple forward iteration with stop control only
5. **Batch Writes**: Single fs write operation for performance

## Current Issues
- `readTape()` loads all records into memory using `fs.readFileSync()` and stores in array
- TaraTape interface has `records: TaraRecord[]` which assumes in-memory storage
- No streaming support for processing large tape files
- No way to stop iteration early

## Refactoring Steps

### 1. Update TaraTape Interface
**Location**: `packages/taralib-js/src/base/types.ts`

- Redefine `TaraTape` interface as a lightweight tape handler/descriptor
- Should contain: `tapeId: string`, `path: string`
- Remove the `records` array (this was causing memory issues)
- Keep `metadata` field from the handler
    - empty on creation
    - metadata will be read on demand

### 2. Implement Tape Handler Factory
**Location**: `packages/taralib-js/src/base/tape.ts`

- Create `createTapeHandler(tapeId: string): TaraTape` function
- Returns lightweight handler object with `tapeId` and pre-computed `path`
- Does NOT read file or validate existence (pure descriptor)

### 3. Implement instantiateTape Function
**Location**: `packages/taralib-js/src/base/tape.ts`

- Create `instantiateTape(tape: TaraTape): void` function
- Check if tape file exists at `tape.path`
- If not exists: create new tape file with metadata record
- If exists: do nothing (idempotent operation)
- Ensures Tara Home directory exists before writing

### 4. Implement Streaming readRecords Function
**Location**: `packages/taralib-js/src/base/tape.ts`

- Create `readRecords(tape: TaraTape, callback: (record: TaraRecord) => void | 'stop'): void`
- Use Node.js streaming approach:
  - Use `fs.createReadStream()` with readline or line-by-line processing
  - Parse each line as JSON lazily
  - Validate each record with `isValidRecord()`
  - Skip first line (metadata record), only process data records
  - Call callback for each record
  - Stop iteration if callback returns `'stop'`
  - Throw error immediately if corrupted/invalid record found
- Never load all records into memory

### 5. Update appendRecord Function
**Location**: `packages/taralib-js/src/base/tape.ts`

- Modify signature: `appendRecord(tape: TaraTape, record: TaraRecord): void`
- Change from taking `tapePath: string` to taking `tape: TaraTape` handler
- Use `tape.path` internally
- Keep existing validation and append logic

### 6. Implement appendRecordBatch Function
**Location**: `packages/taralib-js/src/base/tape.ts`

- Create `appendRecordBatch(tape: TaraTape, records: TaraRecord[]): void`
- Validate all records first (fail fast if any invalid)
- Concatenate all records as JSONL string
- Write all in single `fs.appendFileSync()` call for performance
- All-or-nothing approach (no partial writes)

### 7. implement getTapePath Function
**Location**: `packages/taralib-js/src/base/tape.ts`
- Create `getTapePath(tape: TaraTape): string`

### 8. implement readTapeMetadata Function
**Location**: `packages/taralib-js/src/base/tape.ts`
- Create `readTapeMetadata(tape: TaraTape): ITapeMetadata`
- Reads only the first line of the tape file to get metadata
- error if tape file does not exist or is corrupted

### 9. Update tapeExists Function
**Location**: `packages/taralib-js/src/base/tape.ts`
- Should work with `tape: TaraTape`

### 10. Update deleteTape Function
**Location**: `packages/taralib-js/src/base/tape.ts`
- Should work with `tape: TaraTape`

## Testing & Validation

### Update Test Suite
**Location**: `packages/taralib-js/test/tape.spec.ts`

1. **Test tape handler creation**
   - Verify `createTapeHandler()` returns correct structure
   - Verify handler is lightweight (no file I/O)

2. **Test instantiateTape idempotency**
   - Call multiple times, verify no errors
   - Verify file created only once

3. **Test streaming with readRecords**
   - Create tape with multiple records
   - Verify records processed one at a time
   - Test early stop with `return 'stop'`
   - Verify memory usage stays constant (not loading all records)

4. **Test error handling**
   - Test with corrupted JSON line
   - Verify immediate error thrown
   - Verify iteration stops on error

5. **Test batch append**
   - Append multiple records in batch
   - Verify all written correctly
   - Test with invalid record in batch (should fail all)

6. **Test large tape files**
   - Create tape with 10,000+ records
   - Verify streaming reads without memory issues
   - Measure performance vs old implementation

### Integration Testing
**Location**: `packages/taralib-js/test/integration.spec.ts`

1. Test complete workflow from code snippet:
   - Create handler → instantiate → append → read → batch append
2. Test with realistic data sizes
3. Verify file format compatibility

## Milestones

### Milestone 1: Core Streaming Infrastructure
- Update TaraTape interface
- Implement createTapeHandler
- Implement instantiateTape
- Implement readRecords with streaming

### Milestone 2: Write Operations
- Update appendRecord signature
- Implement appendRecordBatch
- Handle readTape deprecation/removal

### Milestone 3: API Polish
- Update createTape to return handler
- Add overloads for tapeExists/deleteTape
- Update getTapePath if needed

### Milestone 4: Testing & Validation
- Update all existing tests
- Add streaming-specific tests
- Add performance/memory tests
- Integration testing

## Design Principles Adherence
- **Error early, fail fast**: Throw immediately on corrupted records
- **Keep it simple**: No complex concurrency, just forward iteration
- **Single responsibility**: Separate concerns (handler creation, reading, writing)
- **Modular design**: Each function has clear purpose
- **Clear interfaces**: TaraTape handler is simple descriptor
- **Favor composition**: Functions composed with tape handlers

## Breaking Changes (Acceptable)
- TaraTape interface structure changes
- `readTape()` removed or replaced with `readTapeMetadata()`
- Function signatures changed to accept `TaraTape` handler
- `createTape()` returns handler instead of path string

## Non-Goals
- Backward compatibility (clean break acceptable)
- Concurrent write protection
- Backward/random-access iteration
- Transaction/rollback mechanisms
- Partial batch write recovery
