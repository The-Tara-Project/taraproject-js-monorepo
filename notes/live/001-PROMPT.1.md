## Record Handler types

### Current state
- we have a single `RecordHandler<T>` class with generic type parameter for content
- `ITaraRecord` and `ITaraRecordMeta` interfaces exist in `types.ts`

### Single handler, multiple record interfaces
- keep a **single** `RecordHandler` class (no inheritance hierarchy)
- use **generic type parameter** to specify which record interface to return
- define multiple record interfaces for different use cases:
    - `ITaraRecord` (vanilla record) - already exists
    - `IInvalidRecord` - for invalid/error records
    - `IHashedRecord` - for records with content-based hashed IDs
    - `ICanonicalRecord` - for records with canonical IDs (DOIs, ISBNs, etc.)

### Record creation workflow
- caller specifies return type via generic: `new RecordHandler<IInvalidRecord>(content)`
- the handler build methods return the appropriately typed record

### Record reading/parsing workflow
- At reading, uses `UnknownRecord` as intermediate type
- Users can specify desired output type via generic: `RecordHandler.fromObject<IHashedRecord>(rawData)`
