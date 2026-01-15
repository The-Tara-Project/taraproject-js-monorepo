## Tara Records
- A tara record is a single JSON object.
- It is stored as a single line in a Tara Tape file (JSONL format).
- It is immutable once written.

## Record Identifiers
- A Tara Record has a multiple identifiers:
  - `uuid` (UUID4) [required]: a unique identifier for the record within the tape.
  - `content.hash` (SHA256) [optional]: a hash of the actual record content.
  - `cannonical.hash` (SHA256) [optional]: a content hash of the record canonical form:
    - flattened JSON
    - sorted keys
    - no whitespace
- `uuid` is the only required identifier.
- `content.hash` is optional but recommended for content integrity.
  
## 