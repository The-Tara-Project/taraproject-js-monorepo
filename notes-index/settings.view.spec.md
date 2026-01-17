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
  1. Lookup aliases for key in registry
  2. For each source (env → project → global):
     For each alias:
       If found, return value
  3. Fallback: search raw key as-is across sources
  4. Return default or undefined
```

Priority is by **source first**, then by alias. ENV always wins.

## Alias System

Multiple source names map to one canonical internal key:

```
taraHome → ['taraHome', 'TARA_HOME', 'TARAPROJECT_HOME']
debug → ['debug', 'DEBUG', 'TARA_DEBUG']
```

Registry is hardcoded in `SETTING_REGISTRY` constant.

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
// ENV: TARA_HOME=/env/home
// taraproject.json: { "logLevel": "info" }
// ~/.taraproject/config.json: { "taraHome": "/global/home" }

refreshSettings();
getSetting('taraHome')   // → '/env/home' (ENV wins via alias)
getSetting('logLevel')   // → 'info' (from project)
getSetting('missing', 0) // → 0 (default)
```
