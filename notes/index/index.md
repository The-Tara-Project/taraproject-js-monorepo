# Index

## Loading rules
- This file (the index) is always loaded. 
    - It is a router, not a dump.
- Only open more notes if needed for: architecture intent, conventions, roadmap, or prior decisions.
- Token rule: open **one** linked note at a time, then reassess.
- After reading any note: write a **5–10 bullet “Context Learned”** summary in the working thread.

## How to write these notes
- These notes are for **design decisions** only. Do not add implementation details.
- Do not add personal opinions or unstructured thoughts.
- Use the "Open Questions" section to track unresolved issues.

## Stay out
- notes at `notes/inbox/` are for human consumption only.
    - write access: NEVER.
    - read access: NEVER: only when EXPLICITLY instructed.

## Map of notes

### Vision & Principles
- `notes/index/taraproject.vision.md` — The Tara Project vision and general goals
- `notes/index/taralib-design-principles.md` — General design principles for Tara Library
- `notes/index/the.hourglass.principle.md` — Hourglass architecture pattern: Recorders → Tapes → Readers

### Architecture & Design
- `notes/index/Tara.Stack.Ideas.1.md` — TaraStack subsystems and core components (Kernel, StdLib, MCP, CLI)
- `notes/index/Tara.Stack.Ideas.2.md` — Advanced TaraStack concepts (Extensible metadata, Apps, Services, Context Recorders)

### Invariants & Specifications
- `notes/index/more.invariants.md` — Core project invariants (Tapes, Records, Apps, Stack)
- `notes/index/settings.invariants.md` — Settings system invariants (cascade resolution, aliases, source priority)
- `notes/index/tara.record.invariants.md` — Record invariants (identity, immutability, UUID, metadata)
- `notes/index/specs.spec.md` — Guidelines for writing specification notes
