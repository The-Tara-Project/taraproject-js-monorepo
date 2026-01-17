# Tara Records Specification

**Location**: `packages/taralib-js/src/base/record.ts`

## Core Concept

A Tara Record is a single JSON object with system metadata. Records are immutable after creation and stored as single lines in JSONL tape files.

## Record Structure

```typescript
{
  // User content (arbitrary fields)
  "field1": "value1",
  "field2": 123,

  // System metadata (required)
  "__tara": {
    "id": "550e8400-e29b-41d4-a716-446655440000" // UUID v4
  }
}
```

## Record Identifiers

- A Tara Record has a single required identifier:
  - `__tara.id` (UUID v4): Unique identifier for the record
- The UUID is validated using RFC 4122 format
- IDs are automatically generated if not provided
- Future versions may support optional content hashing for integrity verification

## Implementation

### Class-Based API (Current)

```typescript
// Create a new record
const record = new TaraRecord({ name: "Alice", age: 30 });

// Access methods
record.getId()           // Get UUID
record.getContent()      // Get frozen content object
record.toObject()        // Convert to plain object with __tara metadata
record.toString()        // Serialize to JSON (cached)

// Factory methods
TaraRecord.fromObject(obj)  // Create from plain object
TaraRecord.fromJSON(json)   // Parse from JSON string
TaraRecord.isValid(obj)     // Validate structure
```

### Legacy Functional API (Backward Compatibility)

```typescript
createRecord(content)      // Create new record (returns plain object)
isValidRecord(obj)         // Type guard for validation
checkValidRecord(obj)      // Validation with error throwing
stringifyRecord(record)    // Serialize to JSON
parseRecord(json)          // Parse from JSON string
```

## Immutability

- Record content is frozen using `Object.freeze()` after creation
- No new fields can be added after construction
- Internal state (serialization cache) may change for performance
- Records are immutable once written to tape files

## Validation

- UUID format validated using regex: `/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`
- Structure validation checks for `__tara.id` presence and type
- Parsing validates JSON format and record structure
- Invalid records throw descriptive errors

## Performance Optimizations

- Serialization results are cached in `serializedCache` field
- Repeated `toString()` calls return cached value
- Content is shallow-frozen (deep freezing delegated to user if needed)