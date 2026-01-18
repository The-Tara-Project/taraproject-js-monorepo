## auto commit system
check: https://github.com/ghuntley/loom/blob/trunk/specs/auto-commit-system.md

## Extensible metadata
**option 1**
- On creation, for any object with metadata (tapes, records, etc)
- we should allow passing extra metadata fields as a generic object.
- This metadata should be stored alongside the standard metadata.
- once written, it is still immutable.
**option 2**
- Keep the basic metadata as is
- upsteam systems should use regular records to store extra metadata