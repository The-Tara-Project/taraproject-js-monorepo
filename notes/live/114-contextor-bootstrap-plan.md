# Implementation Plan: `packages/tara-contextor-ts`

## Overview

Create a new package `tara-contextor-ts` - a pure orchestration library for context collection following the request-orchestrate-reference pattern. Depends only on `taralib-js`.

## MVP Goal

Provide the Contextor framework with:
- Provider orchestration
- Timeout handling and error normalization
- A `vscode-session` provider interface (implementation provided externally)
    - `#FEEDBACK`
        - the providers are built in into `tara-contextor-ts`

## Architecture

```
Contextor (orchestration only)
  └── collect(requests) → ContextRequestResult[]
        ├── resolveProvider(name) → prov: ContextProvider | undefined
        └── prov.collect(request) → result
```

## Package Structure

- this is temptative and can be adjusted as needed

```
packages/tara-contextor-ts/
├── package.json
├── tsconfig.json
├── esbuild.config.mjs
├── src/
│   ├── index.ts                    # Public exports
│   ├── base/
│   │   ├── types.ts                # Core type definitions
│   │   ├── virtual-provider.ts    # A virtual base class for providers
│   │   ...
│   ├── stack/
│       ├── contextor.ts                # Main Contextor class
│       ├── providers/
│           ├── vscode-session-provider.ts  # VSCode session provider (interface only)
│           ├── ...                     # Other built-in providers (if any)
│       ├── provider-registry.ts        # Provider metadata
└── test/
    └── contextor.spec.ts
```

## Some Core Types examples

```typescript
// Request/Response
interface ContextRequest {
    provider: string;
    items: string[];
    options?: Record<string, unknown>;
}

interface ContextRequestResult {
    provider: string;
    status: 'success' | 'partial' | 'error' | 'timeout';
    collectedItems: string[];
    failedItems: string[];
    liteContext: LiteContext;       // cheap/minimal context to inline
    anchors: ContextAnchor[];       // References to stored context
    error?: ContextErrorReport;
}

// Provider interface
abstract class ContextProvider {
    abstract readonly name: string;
    abstract readonly supportedItems: readonly string[];
    abstract collect(request: ContextRequest, ...): Promise<ProviderCollectResult>;
}

interface ProviderCollectResult {
    collectedItems: string[];
    failedItems: string[];
    liteContext: LiteContext;
    anchors: ContextAnchor[];
    error?: ContextErrorReport;
}

// Anchors - references to stored context
interface ContextAnchor {
    type: string;           // e.g., 'tape-record', 'file', 'inline'
    id: string;
    label?: string;
    provider: string;
    sessionId: string;
    ref: ContextAnchorRef;
    capturedAt: string;
}
```

## Implementation Steps

### 2. Core Types (`src/types.ts`)
- All interfaces defined above
- Export type definitions for external provider implementations

### 5. Contextor Class (`src/contextor.ts`)
```typescript
class Contextor {
    constructor(options?: ContextorOptions);

    // Register a custom provider
    resolveProvider(name: string): ContextProvider | undefined;

    // Main collection method
    async collect(requests: ContextRequest[]): Promise<ContextRequestResult[]>;

    // Introspection
    listProviders(): string[];
    getProviderItems(name: string): string[] | undefined;
}
```

### 6. Public Exports (`src/index.ts`)
```typescript
export { Contextor } from './contextor';
export { ProviderRegistry } from './registry/provider-registry';
export type {
    ContextRequest, ContextRequestResult, ContextAnchor, 
    ContextProvider, ContextErrorReport,
    TapeRecordRef, InlineRef,
} from './types';
```

## Root package.json Update

Add to workspaces:
```json
"workspaces": [
    "packages/taralib-js",
    "packages/vscode-tara-puller-extenssion",
    "packages/vscode-taraproject-extenssion",
    "packages/tara-contextor-ts"
]
```

## Provider Implementation Example

```typescript
// Custom provider implementation
class VscodeSessionProvider implements ContextProvider {
    readonly name = 'vscode-session';
    readonly supportedItems = ['opened-files-paths', 'focused-file-path', 'workspace-folders-paths'] as const;

    constructor(
        readonly context: Contextor 
    ) {}

    async collect(reqs: ContextRequest[], options: Record<string, unknown>): Promise<ProviderCollectResult> {
        // ... implementation to gather data from VSCode session
    }
}

// Usage
const contextor = new Contextor({ captureTimeoutMs: 3000 });

const results = await contextor.collect([
    { provider: 'vscode-session', items: ['opened-files-paths', 'focused-file-path', 'workspace-folders-paths'] }
]);
```

## Verification

1. Build: `npm run build -w packages/tara-contextor-ts`
2. Create test with mock provider 
