# Tape infrastructure specification

## Tape File 
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

## Tape Reader role 
* The Tape Reader provides a **streaming interface** to read records from the Tape file.
* It reads records **lazily**, loading only what is necessary into memory.
* It supports **iterating over records** one at a time, with the ability to stop iteration based on user-defined conditions.

## Tape Writer role
* The Tape Writer provides an interface to **append new records** to the Tape file.
* It ensures that records are written in a **consistent and atomic manner**.

## Git Integration
* depot tapes are tracked in git repositories.
* All tapes are under the same git repository.
* 