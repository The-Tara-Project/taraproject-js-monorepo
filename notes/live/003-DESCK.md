## TODO: create a skill or something to build this diagram on request

TaraStack
  ├── settings: SettingsHandler (stack level)
  ├── global: GlobalScope
  │   ├── home: HomeHandler (uses stack.settings)
  │   ├── tapes: TapeManager
  │   ├── apps: AppManager
  │   └── records: RecordManager
  └── local: LocalScope
      ├── home: LocalHomeManager
      ├── tapes: LocalTapeManager
      ├── apps: LocalAppManager
      └── records: RecordManager