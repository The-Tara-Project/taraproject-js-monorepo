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
  1. Lookup registry entry for key
  2. Get aliases array from entry (or use [key] if not in registry)
  3. Get sources array from entry (or use global SOURCES_PRIORITY if not defined)
  4. For each alias:
       For each source (in priority order):
         If found, return value
  5. Return default or undefined
```

Priority is by **alias first**, then by **source** (in configured order). First alias match wins.

**Note**: There is no fallback raw key search. If users need a key not in the registry, they can add it as a self-mapping: `myKey: { aliases: ['myKey'] }`.

## Registry System

Settings are defined in `SETTING_REGISTRY`, a hardcoded mapping of setting keys to configuration objects.

### Alias System

Each registry entry has an `aliases` array mapping multiple source names to one canonical key:

```typescript
debug: {
  aliases: ['debug', 'DEBUG', 'TARA_DEBUG'],
  sources: ['project', 'env', 'global'],  // optional
}
```

### Per-Key Source Priority (Optional)

Each registry entry can optionally define `sources`, allowing custom source precedence per setting:

- **Without `sources` override**: Uses global `SOURCES_PRIORITY` order (env > project > global)
- **With `sources` override**: Uses custom order defined in registry entry

Example: `debug` setting can be configured to check project first, then env, then global—allowing projects to set defaults that ENV can still override but won't always win.

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

// Not in registry, uses [key] as single alias with default source order
getSetting('missing', 0) // → 0 (default)
```

**Key Insight**: Per-key source overrides allow fine-grained control over precedence. For example, `debug` can prefer project configuration while most other settings follow the default env > project > global order.
