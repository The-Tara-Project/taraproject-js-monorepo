# Tara Reader - VSCode Extension

## Overview

**Tara Reader** is a VS Code extension that provides a unified interface for browsing and viewing Tara tapes within the editor. It allows developers to explore recorded activity data (tapes) that have been collected by the Tara system, with an intuitive tree view interface and integrated document viewer.

Tapes are append-only JSONL files that store chronological records of activities, contexts, and metadata. This extension enables you to discover and read these tapes without leaving VS Code.

## Key Features

- **Tree View Interface**: Browse all available tapes organized by tape repository
- **Read-Only Viewer**: View tape contents as formatted JSONL documents
- **Metadata Display**: See tape statistics including record count, file size, creation date, and modification date
- **One-Click Access**: Open any tape directly from the tree view
- **Quick Actions**: Copy tape paths to clipboard for easy reference
- **Auto-Refresh**: 30-second cache for tape listings to balance freshness with performance
- **Error Handling**: Graceful fallbacks when tapes can't be read

## Architecture

### Package Structure

```
src/
├── extension.ts              # Main extension activation and command registration
├── models/
│   ├── TapeTreeItem.ts      # VSCode TreeItem wrapper for tapes
│   └── types.ts             # TypeScript interfaces (TapeInfo, etc)
├── providers/
│   ├── TapeTreeDataProvider.ts   # Implements TreeDataProvider for the tapes tree view
│   └── TapeDocumentProvider.ts   # Implements TextDocumentContentProvider for tape viewing
└── utils/
    └── tape-utils.ts        # Utility functions for tape discovery and formatting
```

### Main Components

#### 1. **TapeTreeDataProvider** (`providers/TapeTreeDataProvider.ts`)

Implements VS Code's `TreeDataProvider<TapeTreeItem>` interface to populate the tree view with tape data.

**Key Features:**
- Loads all tapes from the Tara stack using `getAllTapes()` utility
- Implements 30-second TTL caching to avoid frequent filesystem scans
- Sorts tapes by modification date (newest first)
- Automatically fires change events to refresh the UI

**Key Methods:**
- `getChildren(element?)`: Returns TapeTreeItem array for tree rendering
- `getTreeItem(element)`: Converts TapeTreeItem to VSCode TreeItem
- `refresh()`: Clears cache and fires change event

#### 2. **TapeDocumentProvider** (`providers/TapeDocumentProvider.ts`)

Implements VS Code's `TextDocumentContentProvider` to enable viewing tape contents.

**How It Works:**
- Registers a custom URI scheme: `tara-tape://`
- Parses URIs in format: `tara-tape://<tapeRepoId>/<tapeFile>`
- Reads and returns raw JSONL content for rendering
- Provides error messages if file can't be read

#### 3. **TapeTreeItem** (`models/TapeTreeItem.ts`)

Extends VS Code's `TreeItem` to represent a single tape in the tree view.

**Displays:**
- Tape name (with `.tara.jsonl` extension removed)
- Description: Record count and file size
- Tooltip: Complete metadata including creation date, modification date
- Icon: Code file icon from VSCode's theme

**Actions:**
- Click to open tape in editor
- Right-click context menu for additional actions

#### 4. **Tape Utilities** (`utils/tape-utils.ts`)

Core business logic for discovering and processing tapes.

**Key Functions:**

- **`getAllTapes(tara: TaraStack): Promise<TapeInfo[]>`**
  - Discovers all tapes across all tape repositories
  - Reads metadata from first record of each tape
  - Counts total records (lines - 1 for metadata line)
  - Extracts file statistics

- **`formatFileSize(bytes: number): string`**
  - Converts bytes to human-readable format (B, KB, MB, GB, TB)
  - Example: `1234567` → `1.18 MB`

- **`formatDate(date: Date): string`**
  - Formats dates in readable format (handled in UI layer)

#### 5. **Extension Entry Point** (`extension.ts`)

Orchestrates initialization and command registration.

**On Activation:**
1. Initializes TaraStack to access tape data
2. Creates TapeTreeDataProvider and registers tree view
3. Registers custom document content provider for viewing
4. Registers all commands (refresh, open, copy path)
5. Adds all disposables to extension context for cleanup

**Commands:**
- `taraReader.refreshTapes`: Manually refresh the tape list
- `taraReader.openTape`: Open selected tape in editor
- `taraReader.copyTapePath`: Copy tape file path to clipboard

## Data Flow

```
VSCode Extension Activation
    ↓
Initialize TaraStack
    ↓
Create TapeTreeDataProvider
    ↓
User views "Tara Tapes" panel
    ↓
getChildren() calls getAllTapes()
    ↓
Scan ~/.taraproject/tapes/ directories
    ↓
Create TapeInfo for each tape file
    ↓
Display as TapeTreeItems in tree view
    ↓
User clicks tape
    ↓
Trigger taraReader.openTape command
    ↓
Create tara-tape:// URI
    ↓
TapeDocumentProvider reads file
    ↓
Display JSONL content in editor
```

## Data Structures

### TapeInfo Interface

```typescript
interface TapeInfo {
  tapeRepoId: string;        // Repository identifier
  tapeFile: string;          // Filename (e.g., "2026-02-app-name.tara.jsonl")
  filePath: string;          // Full filesystem path
  createdAt: Date;           // Creation timestamp from metadata or birthtime
  recordCount: number;       // Total records (lines - 1)
  fileSize: number;          // Bytes
  lastModified: Date;        // Last modification timestamp
  metadata: ITapeMetaRecord | null;  // Parsed metadata from first record
}
```

### ITapeMetaRecord (from taralib-js)

First record in tape file containing tape metadata:
```json
{
  "__taratape": {
    "id": "<UUID>",
    "name": "<tape-id>",
    "formatVersion": "0.0.1",
    "createdAt": "<ISO-8601>",
    "writer": "<app-name>"
  },
  "__tararecord": {
    "type": "taralib/tape-metadata",
    "writer": "<app-name>"
  }
}
```

## Configuration

The extension requires VS Code 1.85.0 or later and activates automatically on startup.

**Activation Event:** `onStartupFinished`

**VSCode Contributions:**
- Activity bar icon with "Tara Tapes" view container
- Tree view for browsing tapes
- Commands for refresh, open, and copy actions
- Context menu items for tree items

## Dependencies

- **@jose_pereiro/taralib-js**: Core tape handling and stack management
- **@types/vscode**: VS Code extension API types
- **@types/node**: Node.js standard library types
- **esbuild**: Production bundling
- **typescript**: Language and type checking

## Error Handling

- **TaraStack initialization failure**: Shows error message and returns early
- **Tape read failures**: Individual tapes skipped with warning logged; others continue
- **Metadata parsing failures**: Metadata marked as optional; tape displayed without it
- **File not found**: Document provider returns error message

## Performance Considerations

- **Caching**: Tree view caches tape list for 30 seconds
- **Async Operations**: Tape discovery runs asynchronously to avoid blocking UI
- **Selective Metadata**: Only parses metadata from first record (tape header)
- **Lazy Loading**: Tape contents only read when explicitly opened

## Development

### Build

```bash
npm run build           # Development build with sourcemaps
npm run build:prod     # Production build (minified)
npm run typecheck      # TypeScript type checking
```

### Dev Install

```bash
npm run dev-install    # Builds, packages, and installs extension in VSCode
```

### Project Structure

- `tsconfig.json`: TypeScript configuration
- `esbuild.config.mjs`: ESBuild configuration for bundling
- `dev-install.js`: Automation script for building and installing

## Integration with Tara Ecosystem

This extension integrates with:

- **TaraStack**: Foundation for accessing tape repositories
- **TapeHandler**: Reading and parsing tape files
- **RecordHandler**: Understanding record structure
- **Tape Format**: JSONL-based append-only records

## Future Enhancements

Potential areas for improvement:

- Search/filter capabilities within tape list
- Record filtering and highlighting within tape content
- Export tape contents to various formats
- Integration with other Tara components (Contextor, GitStorage)
- Real-time tape updates using file watchers
- Record visualization/formatting
- Performance optimization for very large tapes
