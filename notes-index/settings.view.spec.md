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
  1. Lookup aliases for key in registry (if not found, use [key] as single alias)
  2. For each alias:
       For each source (env → project → global):
         If found, return value
  3. Return default or undefined
```

Priority is by **alias first**, then by source. First alias match wins.

**Note**: There is no fallback raw key search. If users need a key not in the registry, they can add it as a self-mapping: `myKey: ['myKey']`.

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
// ENV: TARA_DEBUG=verbose
// taraproject.json: { "logLevel": "info" }
// ~/.taraproject/config.json: { "taraHome": "/global/home", "debug": "quiet" }

refreshSettings();

// Registry has: taraHome: ['taraHome', 'TARA_HOME', 'TARAPROJECT_HOME']
// Checks first alias 'taraHome' across all sources (env, project, global)
// env.taraHome → not found, project.taraHome → not found, global.taraHome → found!
getSetting('taraHome')   // → '/global/home'

// Registry has: debug: ['debug', 'DEBUG', 'TARA_DEBUG']
// Checks first alias 'debug' across all sources
// env.debug → not found, project.debug → not found, global.debug → found!
// Returns 'quiet' even though TARA_DEBUG is set in ENV!
// This is because first alias 'debug' is found in global before checking 'TARA_DEBUG' alias
getSetting('debug')      // → 'quiet' (first alias wins, not first source!)

// 'logLevel' registry: ['logLevel', 'LOG_LEVEL', 'TARA_LOG_LEVEL']
// First alias 'logLevel': env.logLevel → not found, project.logLevel → found!
getSetting('logLevel')   // → 'info'

// Not in registry, uses ['missing'] as single alias
getSetting('missing', 0) // → 0 (default)
```

**Important**: With "alias first" resolution, a higher-priority alias in a lower-priority source will win over a lower-priority alias in a higher-priority source. This is different from typical environment variable precedence where ENV always wins.
