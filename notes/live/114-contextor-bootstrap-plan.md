# Implementation Plan: `packages/tara-contextor-ts`

## Overview

Create a new package `tara-contextor-ts` - a context collection library integrated with the tara stack. Contextor receives TaraStack on construction.

## MVP Design Decisions

| Decision | Choice |
|----------|--------|
| MVP Output | `liteContext` only - no anchors, no tape writing |
| Git Info | Not in MVP - just paths |
| TaraStack | Contextor receives TaraStack on construction |
| Types | Minimal MVP types - expand later |
| Provider Location | Built into tara-contextor, vscode API via `request.options` |
| Collect Mode | Sequential (one request at a time) |
| Provider Registration | Built-in only, registry for discovery/metadata |
| Missing vscode | Fail gracefully with error status |
| LiteContext Shape | Separate keys matching item names |

## MVP Goal

- Provider orchestration with minimal types
- Built-in `vscode-session` provider (receives vscode API from caller)
- Returns only `liteContext` (no anchors, no tape storage)

## Architecture

```
Contextor (orchestration)
  ├── constructor(stack: TaraStack, options?)
  └── collect(requests) → ContextRequestResult[]
        ├── resolveProvider(name) → prov: ContextProvider | undefined
        └── prov.collect(request) → result (sequential)
```

## Package Structure

```
packages/tara-contextor-ts/
├── package.json
├── tsconfig.json
├── esbuild.config.mjs
├── src/
│   ├── index.ts                    # Public exports
│   ├── base/
│   │   └── types.ts                # Core type definitions
│   └── stack/
│       ├── contextor.ts            # Main Contextor class
│       ├── provider-registry.ts    # Provider metadata/resolution
│       ├── context-provider.ts     # Abstract base class
│       └── providers/
│           └── vscode-session-provider.ts
└── test/
    └── contextor.spec.ts
```

## MVP Types

```typescript
// Request
interface ContextRequest {
    provider: string;
    items: string[];
    options?: Record<string, unknown>;
}

// Result (MVP minimal - no anchors, no error object)
interface ContextRequestResult {
    provider: string;
    status: 'success' | 'partial' | 'error';
    collectedItems: string[];
    failedItems: string[];
    liteContext: LiteContext;
}

// Minimal inline context - keys match requested items
type LiteContext = Record<string, unknown>;

// Contextor options
interface ContextorOptions {
    captureTimeoutMs?: number;
}

// Provider metadata (for registry)
interface ProviderMetadata {
    name: string;
    supportedItems: readonly string[];
}
```

## Contextor Class

```typescript
import { TaraStack } from '@jose_pereiro/taralib-js';

class Contextor {
    constructor(stack: TaraStack, options?: ContextorOptions);

    // Main collection - sequential
    async collect(requests: ContextRequest[]): Promise<ContextRequestResult[]>;

    // Introspection
    listProviders(): string[];
    getProviderItems(name: string): readonly string[] | undefined;
}
```

## ContextProvider Base

```typescript
abstract class ContextProvider {
    abstract readonly name: string;
    abstract readonly supportedItems: readonly string[];

    constructor(readonly contextor: Contextor) {}

    abstract collect(request: ContextRequest): Promise<ContextRequestResult>;

    getMetadata(): ProviderMetadata;
}
```

## VSCode Session Provider

```typescript
class VscodeSessionProvider extends ContextProvider {
    readonly name = 'vscode-session';
    readonly supportedItems = [
        'opened-files-paths',
        'focused-file-path',
        'workspace-folders-paths'
    ] as const;

    async collect(request: ContextRequest): Promise<ContextRequestResult> {
        const vscode = request.options?.vscode as typeof import('vscode') | undefined;

        // Fail gracefully if vscode API missing
        if (!vscode) {
            return {
                collectedItems: [],
                failedItems: [...request.items],
                liteContext: {},
            };
        }

        // Collect each requested item
        // liteContext keys match item names:
        // { 'opened-files-paths': [...], 'focused-file-path': '...', ... }
    }

    private getOpenedFilesPaths(vscode): string[] {
        // vscode.window.tabGroups.all → extract fsPath from each tab
    }

    private getFocusedFilePath(vscode): string | null {
        // vscode.window.activeTextEditor?.document.uri.fsPath
    }

    private getWorkspaceFoldersPaths(vscode): string[] {
        // vscode.workspace.workspaceFolders → map to fsPath
    }
}
```

## Usage Example

```typescript
// In VSCode extension
import * as vscode from 'vscode';
import { TaraStack } from '@jose_pereiro/taralib-js';
import { Contextor } from '@jose_pereiro/tara-contextor';

const stack = new TaraStack({ writer: 'my-extension' });
const contextor = new Contextor(stack, { captureTimeoutMs: 3000 });

const results = await contextor.collect([
    {
        provider: 'vscode-session',
        items: ['opened-files-paths', 'focused-file-path', 'workspace-folders-paths'],
        options: { vscode }  // Pass vscode API
    }
]);

console.log(results[0].liteContext);
// { 'opened-files-paths': [...], 'focused-file-path': '...', 'workspace-folders-paths': [...] }
```

## Files to Create

| # | File | Description |
|---|------|-------------|
| 1 | `package.json` | Package config, depends on @jose_pereiro/taralib-js |
| 2 | `tsconfig.json` | Extends ../../tsconfig.base.json |
| 3 | `esbuild.config.mjs` | Copy pattern from taralib-js |
| 4 | `src/index.ts` | Public exports |
| 5 | `src/base/types.ts` | Type definitions |
| 6 | `src/stack/context-provider.ts` | Abstract base class |
| 7 | `src/stack/contextor.ts` | Main Contextor class |
| 8 | `src/stack/provider-registry.ts` | Built-in provider resolution |
| 9 | `src/stack/providers/vscode-session-provider.ts` | VSCode session provider |

## Root package.json Update

Add to workspaces array:
```json
"packages/tara-contextor-ts"
```

## Verification

1. Build: `npm run build -w packages/tara-contextor-ts`
2. Type check: `npm run typecheck -w packages/tara-contextor-ts`
3. Unit test with mock vscode object
4. Integration test in VSCode extension
