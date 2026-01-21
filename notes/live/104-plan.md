# Settings System Design Document
**Location**: `packages/taralib-js/src/base/settings.ts`
**Date**: 2026-01-16

---

## Overview

A settings management system that collects configuration from multiple sources (ENV variables, config files) with an alias system to map source names to internal canonical keys. Settings are resolved at query time using a priority cascade system.

---

## Design Decisions

### 1. Priority/Precedence Order ✓

Settings are resolved using a **standard priority hierarchy**:

1. **ENV variables** (highest priority - runtime overrides)
2. **`./taraproject.json`** (project-specific config)
3. **`~/.taraproject/config.json`** (global defaults)

If a canonical key has multiple source aliases and those values are present across sources, the priority resolution system determines which value is returned.

**Example:**
```typescript
// Registry
SETTING_REGISTRY = {
  taraHome: ['taraHome', 'TARA_HOME', 'TARAPROJECT_HOME', 'HOME_DIR']
}

// Sources:
// ENV: HOME_DIR=/tmp/env-home
// project file: taraHome=/tmp/project-home
// global file: taraHome=/tmp/global-home

getSetting('taraHome')
// → '/tmp/env-home' (ENV wins due to priority)
```

---

### 2. Alias System Design ✓

**Multiple aliases map to one internal canonical key.**

- Internal keys are defined in `SETTING_REGISTRY`
- Each internal key has an array of aliases
- Aliases are searched across all sources during resolution

**Example:**
```typescript
const SETTING_REGISTRY = {
  taraHome: ['taraHome', 'TARA_HOME', 'TARAPROJECT_HOME', 'HOME_DIR'],
  tapeFormat: ['tapeFormat', 'TAPE_FORMAT', 'TARA_TAPE_FORMAT'],
  debug: ['debug', 'DEBUG', 'TARA_DEBUG']
}
```

---

### 3. Resolution Cascade ✓

**Full resolution cascade (in order):**

1. **Is it an internal key?** → Get aliases from registry
2. **Search all aliases** across all sources
3. **Return value from highest priority source**
4. **If not found via aliases:** search for the raw key as-is
5. **Search raw key** in ENV → project file → global file (priority order)
6. **If still not found:** return default value (if provided) or `undefined`

**Pseudocode:**
```typescript
SOURCES_PRIORITY = ['env', 'project', 'global'];
function getSetting(key: string, defaultValue?: any): any {
  const aliases = SETTING_REGISTRY[key] || [key];

  // Search aliases across all sources
  for (const source of SOURCES_PRIORITY) {
    for (const alias of aliases) {
      const value = getRawValue(alias, source);
      if (value !== undefined) return value;
    }
  }

  // Fallback: search raw key as-is
  for (const source of SOURCES_PRIORITY) {
    const value = getRawValue(key, source);
    if (value !== undefined) return value;
  }

  return defaultValue;
}
```

---

### 4. Direct Source Querying ✓

The system exposes **direct access to raw sources**:

```typescript
// API
getRawValue(key: string, source: 'env' | 'project' | 'global'): any

// Usage
getRawValue('TARA_HOME', 'env')      // → '/tmp/env-home' or undefined
getRawValue('taraHome', 'project')   // → '/tmp/project' or undefined
getRawValue('debug', 'global')       // → undefined
```

This allows inspection of where values come from without resolution logic.

---

### 5. Config File Format ✓

**Free format with first-level parsing only.**

Files: `taraproject.json` and `~/.taraproject/config.json`

- Any valid JSON structure is accepted
- The system only reads **top-level keys**
- If a value is an object, that entire object is the config value
- No special nested key resolution (no dot notation like `tara.home`)

**Example config files:**

```json
// taraproject.json
{
  "TARA_HOME": "/local/project/home",
  "tapeConfig": {
    "format": "jsonl",
    "compression": true
  },
  "debug": true
}

// ~/.taraproject/config.json
{
  "TARA_HOME": "/global/home",
  "TAPE_FORMAT": "jsonl"
}
```

```typescript
getSetting('tapeConfig')
// → { format: 'jsonl', compression: true }
```

---

### 6. Alias Configuration Storage ✓

**Built-in registry as a constant object.**

```typescript
const SETTING_REGISTRY: Record<string, string[]> = {
  taraHome: ['taraHome', 'TARA_HOME', 'TARAPROJECT_HOME', 'HOME_DIR'],
  tapeFormat: ['tapeFormat', 'TAPE_FORMAT', 'TARA_TAPE_FORMAT'],
  // ... more internal keys
}
```

- Hardcoded in `settings.ts` initially
- Acts as the canonical mapping of internal keys to source aliases

---

### 7. Missing Files Behavior ✓

**Graceful degradation with logging:**

- If `taraproject.json` doesn't exist → log warning, continue
- If `~/.taraproject/config.json` doesn't exist → log warning, continue
- Queries that hit missing sources → return `undefined`
- System continues to work with available sources

**Example:**
```typescript
// If taraproject.json is missing:
console.warn('[taralib-settings] Project config not found: /path/to/taraproject.json')

// Query still works with remaining sources
getSetting('taraHome')
// → checks ENV and global config, skips project config
```

---

### 8. Immutability Scope ✓

**Settings are frozen between loads.**

- Calling `refreshSettings()` wipes previous state and reloads fresh
- Between `refreshSettings()` calls, settings are immutable
- No live reloading or watching

**Usage pattern:**
```typescript
refreshSettings();
const home1 = getSetting('taraHome'); // → '/tmp/home'

// ... time passes, config files change ...

refreshSettings(); // Wipe and reload
const home2 = getSetting('taraHome'); // → '/new/home'
```

---

### 9. Working Directory Resolution ✓

**Configurable with sensible default.**

```typescript
refreshSettings(workingDir?: string): void

// If not provided, use process.cwd()
refreshSettings();          // → looks for taraproject.json in process.cwd()
refreshSettings('/custom'); // → looks for taraproject.json in /custom
```

---

### 10. ENV Variable Parsing ✓

**ENV values remain as strings.**

- No automatic type coercion
- `"true"` stays as string `"true"`
- `"123"` stays as string `"123"`
- Application layer handles type conversion if needed

**Rationale:** Keeps the settings system simple and predictable. Type coercion can be error-prone and opinionated.

---

### 11. Return Types ✓

**Support for default values:**

```typescript
getSetting(key: string, defaultValue?: any): any

// Usage
getSetting('taraHome')              // → value or undefined
getSetting('taraHome', '/default')  // → value or '/default'
getSetting('debug', false)          // → value or false
```

Missing keys return `undefined` unless a default is provided.

---

### 12. Logging ✓

**Simple console warnings.**

```typescript
console.warn('[taralib-settings] Message here')
```

- Used for missing config files
- Used for filesystem errors
- Prefixed with `[taralib-settings]` for clarity
- No custom logger interface needed (KISS principle)

---

### 13. Integration & Location ✓

**Integrated into taralib-js core:**

- **File**: `packages/taralib-js/src/base/settings.ts`
- **Export**: Via `packages/taralib-js/src/index.ts`
- **Future**: `home.ts` logic can eventually use this system
- **Coexistence**: Initially runs alongside existing code

---

## Architecture

### Module Structure

```
packages/taralib-js/src/
├── base/
│   ├── settings.ts    ← NEW: Settings system
│   ├── home.ts        ← EXISTING: Can use settings later
│   ├── types.ts       ← EXISTING: Will add types here
│   ├── record.ts      ← EXISTING
│   └── tape.ts        ← EXISTING
└── index.ts           ← EXISTING: Add settings exports
```

---

### Internal State

```typescript
// Internal state (module-scoped)
let settingsState: {
  loaded: boolean;
  workingDir: string;
  sources: {
    env: Record<string, any>;
    project: Record<string, any>;
    global: Record<string, any>;
  };
} = {
  loaded: false,
  workingDir: '',
  sources: {
    env: {},
    project: {},
    global: {}
  }
};
```

---

### API Surface

```typescript
// Public API (functional style)

/**
 * Load settings from all sources.
 * Wipes previous state and reloads fresh.
 */
export function refreshSettings(workingDir?: string): void;

/**
 * Get a setting value with resolution cascade.
 * Returns defaultValue if not found.
 */
export function getSetting(key: string, defaultValue?: any): any;

/**
 * Get a raw value from a specific source without resolution.
 * Useful for inspecting where values come from.
 */
export function getRawValue(
  key: string,
  source: 'env' | 'project' | 'global'
): any;

/**
 * Check if settings have been loaded.
 */
export function isLoaded(): boolean;
```

---

### Resolution Algorithm (Detailed)

```typescript
function getSetting(key: string, defaultValue?: any): any {
  // 1. Get aliases for this key (or use key itself)
  const aliases = SETTING_REGISTRY[key] || [key];

  // 2. Priority sources in order
  const sources: Array<'env' | 'project' | 'global'> = [
    'env',
    'project',
    'global'
  ];

  // 3. Search all aliases across all sources (priority order)
  for (const source of sources) {
    for (const alias of aliases) {
      const value = getRawValue(alias, source);
      if (value !== undefined) {
        return value;
      }
    }
  }

  // 4. Fallback: search raw key as-is (no alias)
  for (const source of sources) {
    const value = getRawValue(key, source);
    if (value !== undefined) {
      return value;
    }
  }

  // 5. Return default or undefined
  return defaultValue;
}
```

**Key insight:** The inner loop (aliases) runs completely for each source before moving to the next source. This ensures priority by source, not by alias order.

---

### File Loading Logic

```typescript
function refreshSettings(workingDir?: string): void {
  // 1. Wipe previous state
  settingsState = {
    loaded: false,
    workingDir: workingDir || process.cwd(),
    sources: { env: {}, project: {}, global: {} }
  };

  // 2. Load ENV variables (all of them)
  settingsState.sources.env = { ...process.env };

  // 3. Load project config
  const projectPath = path.join(
    settingsState.workingDir,
    'taraproject.json'
  );
  try {
    const content = fs.readFileSync(projectPath, 'utf-8');
    settingsState.sources.project = JSON.parse(content);
  } catch (error) {
    console.warn(`[taralib-settings] Project config not found: ${projectPath}`);
  }

  // 4. Load global config
  const globalPath = path.join(
    os.homedir(),
    '.taraproject',
    'config.json'
  );
  try {
    const content = fs.readFileSync(globalPath, 'utf-8');
    settingsState.sources.global = JSON.parse(content);
  } catch (error) {
    console.warn(`[taralib-settings] Global config not found: ${globalPath}`);
  }

  // 5. Mark as loaded
  settingsState.loaded = true;
}
```

---

## Example Usage Scenarios

### Basic Usage

```typescript
import { refreshSettings, getSetting } from 'taralib-js';

// Initialize
refreshSettings();

// Get settings with defaults
const taraHome = getSetting('taraHome', '~/.tara');
const debug = getSetting('debug', false);
const format = getSetting('tapeFormat', 'jsonl');

console.log(taraHome); // → resolved from ENV or config files
```

---

### Inspecting Sources

```typescript
import { refreshSettings, getRawValue, getSetting } from 'taralib-js';

refreshSettings();

// Check all sources for a key
const envValue = getRawValue('TARA_HOME', 'env');
const projectValue = getRawValue('TARA_HOME', 'project');
const globalValue = getRawValue('TARA_HOME', 'global');

console.log('ENV:', envValue);
console.log('Project:', projectValue);
console.log('Global:', globalValue);
console.log('Resolved:', getSetting('taraHome'));
```

---

### Custom Working Directory

```typescript
import { refreshSettings, getSetting } from 'taralib-js';

// Load settings from a specific project directory
refreshSettings('/path/to/project');

const projectConfig = getSetting('customKey');
```

---

### Reloading Settings

```typescript
import { refreshSettings, getSetting } from 'taralib-js';

refreshSettings();
const home1 = getSetting('taraHome');
console.log('First load:', home1);

// ... config files change ...

refreshSettings(); // Wipe and reload
const home2 = getSetting('taraHome');
console.log('After reload:', home2);
```

---

## Type Definitions

```typescript
// Add to packages/taralib-js/src/base/types.ts

export type SettingSource = 'env' | 'project' | 'global';

export interface SettingsState {
  loaded: boolean;
  workingDir: string;
  sources: {
    env: Record<string, any>;
    project: Record<string, any>;
    global: Record<string, any>;
  };
}
```

---

## Built-in Registry (Initial)

```typescript
const SETTING_REGISTRY: Record<string, string[]> = {
  taraHome: ['taraHome', 'TARA_HOME', 'TARAPROJECT_HOME'],
  debug: ['debug', 'DEBUG', 'TARA_DEBUG'],
  logLevel: ['logLevel', 'LOG_LEVEL', 'TARA_LOG_LEVEL'],
};
```

---

## Testing Considerations

### Test Cases

1. **Priority resolution**: ENV > project > global
2. **Alias resolution**: Multiple aliases for same key
3. **Missing files**: Graceful degradation
4. **Missing keys**: Return undefined or default
5. **Raw value queries**: Direct source access
6. **Reload behavior**: State wipes correctly
7. **Working directory**: Custom vs process.cwd()
8. **Complex values**: Objects in config files

### Test Structure

```typescript
// test/settings.spec.ts
describe('Settings System', () => {
  describe('refreshSettings', () => {
    it('should load ENV variables');
    it('should load project config');
    it('should load global config');
    it('should warn on missing files');
  });

  describe('getSetting', () => {
    it('should resolve with priority: ENV > project > global');
    it('should resolve aliases correctly');
    it('should return default value when not found');
    it('should handle complex object values');
  });

  describe('getRawValue', () => {
    it('should return value from specific source');
    it('should return undefined for missing keys');
  });
});
```

---

## Future Enhancements (Out of Scope)

- User-configurable alias registry
- Type schema validation
- Environment-specific configs (dev/prod)
- Config file watching and hot reload
- Nested key dot notation support (`get('tara.home')`)
- Custom logger interface
- Config encryption for sensitive values

---

## Implementation Checklist

- [ ] Create `settings.ts` with internal state
- [ ] Implement `refreshSettings()` function
- [ ] Implement `getSetting()` with cascade logic
- [ ] Implement `getRawValue()` for direct queries
- [ ] Implement `isLoaded()` helper
- [ ] Define `SETTING_REGISTRY` constant
- [ ] Add type definitions to `types.ts`
- [ ] Export from `index.ts`
- [ ] Write comprehensive tests
- [ ] Update package documentation

---

## Design Rationale

### Why Functional API?
- Simple, predictable interface
- Easy to test and mock
- No class instantiation overhead
- Matches existing taralib-js patterns

### Why Module-Scoped State?
- Singleton behavior without classes
- Shared state across imports
- Immutable between loads (controlled mutation via `refreshSettings()`)

### Why No Type Coercion for ENV?
- ENV variables are fundamentally strings
- Type coercion is opinionated and error-prone
- Application layer can handle conversion with context

### Why Priority by Source, Not Alias?
- More predictable: ENV always wins
- Alias order doesn't matter for same source
- Simpler mental model

### Why Separate `getRawValue()`?
- Debugging: see exactly what's in each source
- Transparency: understand where values come from
- Testing: verify specific source loading

---

## Summary

This settings system provides a **simple, predictable, and flexible** configuration management solution for taralib-js. It follows the **KISS principle** with clear priority rules, graceful error handling, and transparent source inspection. The functional API integrates cleanly with the existing codebase while remaining extensible for future needs.
