1. **Append-only history:** once bytes are stored, that version is immutable and never rewritten.
2. **Progressive disclosure:** the tape is the first-level narrative, and by reading it you can understand “what happened” at a high level.
3. **Actionable tape:** every tape record must include enough references/metadata/links to locate the exact next step for deeper inspection
4. **Byte-store semantics:** git-storage treats content as raw bytes and does not impose a document model or interpretation.
5. **Caller-defined naming:** keys/paths are provided by apps, stored as-is, and git-storage does not attempt rename detection or semantic identity tracking.
6. **Stable version references:** every write returns an immutable version pointer that can be used later to retrieve the exact same bytes.
7. **Basic retrieval:** the system can fetch bytes for a given (key, version) or directly from a version reference, plus minimal metadata.
8. **History traversal:** the system can list versions for a key and iterate commits/changes to support auditing and reconstruction.
9. **Batch commits supported:** multiple files can be committed together as a convenience, without promising strong atomicity guarantees at this stage.
10. **Derivation-friendly:** because history and references are stable, downstream apps can build their own indexes/DBs and stay consistent by consuming the tape and fetching versions as needed.
