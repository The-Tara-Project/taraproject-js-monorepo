ENTRY POINT
━━━━━━━━━━━
    TaraStack
    │
    ├─ settings: SettingsHandler
    ├─ global: GlobalScope
    └─ local: LocalScope (stubs)


STACK LAYER (Orchestration)
━━━━━━━━━━━━━━━━━━━━━━━━━
GlobalScope
├─ home: HomeHandler
├─ tapes: TapeManager
└─ apps: AppManager

LocalScope
├─ home: LocalHomeManager
├─ tapes: LocalTapeManager (not implemented)
└─ apps: LocalAppManager (not implemented)


MANAGER LAYER (CRUD Operations)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TapeManager
└─ get(id): TapeHandler
    ├─ fileHandler: TapeFileHandler
    └─ gitHandler: TapeGitHandler

AppManager
└─ get(name): App
    └─ questions: QuestionManager

QuestionManager
└─ list/get/save/delete questions


HANDLER LAYER (Technical Operations)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TapeHandler (Coordinator)
├─ TapeFileHandler (JSONL I/O)
│  └─ appendRecord(record)
│  └─ readRecords(callback)
└─ TapeGitHandler (Version Control)
    └─ GitHandler (git commands)

HomeHandler (Path Resolution)
└─ SettingsHandler cascade: env > project > global

GitHandler (Command Execution)
└─ execSync git operations


BASE LAYER (Primitives)
━━━━━━━━━━━━━━━━━━━━━
TaraRecord<T>
├─ Immutable content
├─ UUID v4 identity
└─ Static: fromJSON, fromObject, isValid

SettingsHandler
├─ Multi-source cascade
├─ Registry with aliases
└─ Per-key source priority

Types & Utilities
├─ ITaraRecord
├─ ITapeMetadata
├─ TaraQuestion
└─ app-handler utilities


DATA FLOW
━━━━━━━
┌──────────────────────────────────┐
│ Input (External World)           │
│ ├─ User actions                  │
│ ├─ VS Code events               │
│ └─ Other app contexts           │
└──────────────────────────────────┘
        ↓
┌──────────────────────────────────┐
│ Recorders (Apps)                 │
│ └─ Create TaraRecord instances   │
└──────────────────────────────────┘
        ↓
┌──────────────────────────────────┐
│ Tape (Narrow Waist)              │
│ ├─ JSONL append-only format      │
│ ├─ One record per line           │
│ └─ Git-tracked versioning        │
└──────────────────────────────────┘
        ↓
┌──────────────────────────────────┐
│ Readers (Analytics/Reports)      │
│ └─ Query & process tapes         │
└──────────────────────────────────┘


STORAGE HIERARCHY
━━━━━━━━━━━━━━━━
~/.taraproject/
├── config.json              (Global settings)
├── tapes/
│   ├── my-journal.tara.jsonl
│   ├── my-metrics.tara.jsonl
│   └── .git/               (Version control)
├── apps/
│   ├── my-app/
│   │   └── questions/
│   │       ├── q1.json
│   │       └── q2.json
│   └── another-app/
│       └── questions/
└── plugins/               (Future)

./taraproject.json         (Project-level settings)
.env                       (Environment settings)

Key Design Principles:

1. Layered Architecture: Base primitives → Handlers → Managers → Scopes → TaraStack
2. Hourglass Pattern: Diverse recorders → Standardized tape format → Flexible readers
3. Dependency Injection: TaraStack passes context down to scopes/managers
4. Separation of Concerns: Each layer has a single responsibility
5. Immutability: Records/tapes are append-only, never modified
6. Settings Cascade: Environment > Project > Global with registry aliases