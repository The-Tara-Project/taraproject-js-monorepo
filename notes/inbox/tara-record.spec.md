# Tara Records Specification

## Core Concept

A Tara Record is a JSON object that combines user content with system metadata. Records are the fundamental unit of data in a Tara Tape, designed to be immutable, uniquely identifiable, and line-oriented for append-only storage.

## Why Records Exist

Records solve several key problems:
- **Identity**: Every piece of data needs a stable, unique identifier that persists across copies and transformations
- **Immutability**: Once created, records cannot be modified, enabling reliable audit trails and version control
- **Line-Oriented Storage**: Each record is a single JSON object that can be stored as one line in JSONL tape files
- **Separation of Concerns**: User content is kept separate from system metadata, preventing naming conflicts

## Record Structure

Records consist of two parts:

```typescript
{
  // User content (arbitrary fields - anything the user wants to store)
  "name": "Alice",
  "age": 30,

  // System metadata (reserved namespace for Tara)
  "__tara": {
    "id": "550e8400-e29b-41d4-a716-446655440000" // UUID v4
  }
}
```

The `__tara` namespace is reserved for system metadata and must not be used in user content.

## Record Identity

Every record has exactly one identifier: a UUID v4 stored in `__tara.id`. UUIDs are chosen because:
- They can be generated independently without coordination
- They are globally unique with negligible collision probability
- They remain stable even when records are copied across systems
- They follow RFC 4122 standard format

IDs are automatically generated during record creation if not provided.

## Immutability

Records are immutable by design:
- User content cannot be modified after creation
- IDs cannot change after assignment
- Updates require creating a new record with a new ID

This immutability enables:
- Reliable version history in tape files
- Safe concurrent access without locks
- Predictable state management in multi-step workflows