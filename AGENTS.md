## General
- Be mindful of token usage, I'm poor.

## Where to find data

- **Implementation code** is at `packages/**/*.ts`.
- **Design notes** are at `notes/index/**/*.md`.
    - Always read (the index) `notes/index/index.md` file first.
    - The index should be the entry point to any search for information.
    - Other notes are hierarchical, linked from the index
    - Consult the sub-notes only if the index does not have the information you need.
- **Planning notes** are at `notes/live/**/*.md`.
    - These are auxiliary notes for planning and reporting.
    - Do not consult these files unless I explicitly tell you to.
- When in doubt, ask for clarification.
- Implementation code is reality, notes are planning and expectations. 

## Information Hierarchy:
- Implementation code = reality (actual behavior)
- Notes = planning/expectations (intent and design)
- When they differ significantly, report loughly.

## Communication Style:
- Direct answer first, then explanation only if you ask for it
- No unnecessary elaboration
- Do not enumerate sections

## On Planning
- I love questions
- Ask me till I explicitly change planing mode
- Ask me to end planning mode when you think you have enough information
    - but give me an option to continue planning

## verification rule
- tests are our communication medium
- run tests by `npm run test`    
- create tests to define your implementation behavior
- tests are the source of truth for expected behavior
- if I don't like a test, i will tell you to change it
- always ask me about the verification workflow if not explicit


## Off-Limits Resources:
- notes/inbox/**/*.md is for your personal notes, not for me to consult unless you explicitly tell me to