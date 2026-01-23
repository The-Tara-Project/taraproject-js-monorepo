# Settings System Specification

**Location**: `packages/taralib-js/src/base/settings.ts`

## Core Concept

Configuration management system that collects settings from multiple sources
with alias mapping and priority-based resolution at query time.

## Data Sources (Priority Order)

1. **ENV variables** - Runtime overrides (highest priority)
2. **`./taraproject.json`** - Project-specific configuration
3. **`~/.taraproject/config.json`** - Global user defaults

## Resolution Algorithm

```
getSetting(key) →
  1. Lookup registry entry for key (returns undefined if not found)
  2. Get aliases from entry: entry?.aliases || [key]
  3. Get sources from entry: entry?.sources || SOURCES_PRIORITY
  4. For each alias:
       For each source (in priority order):
         If found, return value
  5. Return default or undefined
```

Priority is by **alias first**, then by **source** (in configured order). First alias match wins.

**Behavior is uniform** for registered and unregistered keys:
- Registered key with `aliases` defined: Uses defined aliases
- Registered key without `aliases`: Uses key itself as single alias
- Unregistered key: Treated same as registered without aliases (uses key itself)

## Registry System

Settings can optionally be defined in `SETTING_REGISTRY` for customization. Non-registered keys are fully valid and work transparently.

### Registry Entry Structure

Registry entries have optional fields for aliases and custom source priority:

```typescript
debug: {
  aliases?: ['debug', 'DEBUG', 'TARA_DEBUG'],  // optional
  sources?: ['project', 'env', 'global'],      // optional
}
```

Both `aliases` and `sources` are optional. Fields can be omitted independently.

### Alias System (Optional)

When `aliases` is defined, it maps multiple source names to one canonical key:
- First alias in array checked first across all sources
- All aliases exhausted before moving to next alias
- If omitted, defaults to treating the key itself as the single alias

Examples:
```typescript
debug: {
  aliases: ['DEBUG', 'TARA_DEBUG'],  // Searches for debug → DEBUG → TARA_DEBUG
}
logLevel: {
  // No aliases, searches for 'logLevel' directly
}
getSetting('customKey')  // Not in registry: searches for 'customKey' directly
```

### Per-Key Source Priority (Optional)

Each registry entry can optionally define `sources` for custom precedence:

- **Without override**: Uses global `SOURCES_PRIORITY` order (env > project > global)
- **With override**: Uses custom order defined in registry entry

Example: `debug` can check project first (project defaults take precedence) while most other settings follow env > project > global order.

### Non-Registered Keys

Keys not in registry are **automatically valid**. They behave exactly like registered keys with no customization:
- Single alias: the key itself `[key]`
- Source order: global default (env > project > global)

Example:
```typescript
getSetting('myCustomSetting')  // Valid! Searches [myCustomSetting] in env → project → global
```

No registration needed for simple keys.

## API Operations

- `refreshSettings(workingDir?)` - Load/reload all sources, wipe previous state
- `getSetting(key, default?)` - Resolve value through cascade
- `getRawValue(key, source)` - Direct source access without resolution
- `isLoaded()` - Check if settings loaded
- `resetSettings()` - Reset to initial state (internal, for testing)

## Config File Format

- Free-form JSON, top-level keys only
- Objects stored as values (no nested key expansion)
- Missing files → warning logged, continue with remaining sources

## Key Design Decisions

**Immutability**: Settings frozen between `refreshSettings()` calls. No live reloading.

**No type coercion**: ENV values remain strings. App handles conversion.

**Graceful degradation**: Missing files/keys return `undefined`, system continues.

**Functional API**: Module-scoped state, no class instantiation.

**Direct inspection**: `getRawValue()` allows debugging which source provides value.

## Example

```javascript
// ENV: TARA_DEBUG=verbose
// taraproject.json: { "logLevel": "info", "debug": "project-value" }
// ~/.taraproject/config.json: { "taraHome": "/global/home", "debug": "quiet" }

refreshSettings();

// Registry: taraHome (no sources override) uses default: env > project > global
// First alias 'taraHome' → env ✗, project ✗, global ✓
getSetting('taraHome')   // → '/global/home'

// Registry: debug has custom sources: ['project', 'env', 'global']
// First alias 'debug' → project ✓ (stops here, found!)
getSetting('debug')      // → 'project-value' (project checked first!)
// Even though TARA_DEBUG='verbose' is in ENV, project source checked first

// 'logLevel' (no sources override) uses default: env > project > global
// First alias 'logLevel' → env ✗, project ✓
getSetting('logLevel')   // → 'info'

// Not in registry, searches with default source order
getSetting('myCustomKey') // → checks env.myCustomKey → project.myCustomKey → global.myCustomKey

// Unregistered keys work like registered keys without customization
getSetting('myCustomKey', 'default') // → 'default' if not found
```

**Key Insights**:
- Per-key source overrides enable fine-grained control (e.g., `debug` prefers project over env)
- Non-registered keys are first-class citizens—no need to add simple keys to registry
- Optional aliases let registered keys support multiple naming conventions
- The system is flexible: register only what needs customization
