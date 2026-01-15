## Tape (current working design)

* A **Tape is a single file**, append-only.
* Format: **JSONL** (one record per line).
* The Tape is the **authoritative, self-describing source of truth** for:
  * its data
  * its basic mechanics (identity, references, validation rules)
* Derived indexes or auxiliary files may exist, but are **non-authoritative** and rebuildable.
* It is designed with record stability and long-term integrity in mind.
* It is not design to be an efficient database or high-performance store.
* It is optimized for **simplicity, transparency, and durability**.
* It is intended to be **human-readable and editable** with basic tools (text editor, command-line).

## Tape metadata record
* The Tape file begins with a **metadata record**.
* Metadata record contains:
  * Tape ID
  * format version
  * creation date (ISO 8601)
  * some configuration parameters (e.g. hashing algorithm)
* Metadata record has a **well-known structure** for easy parsing.
* Metadata record is the **first record** in the Tape file.
* This record, as all others, is immutable once written.