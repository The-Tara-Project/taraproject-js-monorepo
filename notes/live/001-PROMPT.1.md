## Refactor 

- check in `notes/live/110-tara-stack-vs-base.md`
- see this block
```
#### Settings Primitives
- **`settings.ts`** - Settings functions
  - `refreshSettings(workingDir?)` - load settings
  - `getSetting(key, defaultValue?)` - retrieve value
  - `getRawValue(key, source)` - get from specific source
  - `isSettingsLoaded()` - check state
  - Pure functions, no TaraStack
```
- I think we should tranform settings.ts to use a class 
- named `SettingsHandler`
- similar to the other primitives
- this calss will keep all state of the setting system

- lets make a plan