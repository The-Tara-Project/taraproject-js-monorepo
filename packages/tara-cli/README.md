# Tara CLI

Command-line interface for Tara tape management.

## Installation

```bash
# From the monorepo root
npm install

# Build the package
npm run build -w @jose_pereiro/tara-cli

# Link globally (optional)
npm link -w @jose_pereiro/tara-cli
```

## Usage

```bash
# Show help
node packages/tara-cli/dist/cli.js --help

# Or if linked globally:
tara --help
```

## Commands

### List Tapes

```bash
tara tape list              # Table format
tara tape list --json       # JSON format
```

### Tape Information

```bash
tara tape info <tapeId>     # Show detailed tape metadata
tara tape count <tapeId>    # Count records in tape
```

### View Records

```bash
tara tape show <tapeId>           # Show last 10 records
tara tape show <tapeId> -n 5      # Show last 5 records
tara tape head <tapeId> 10        # Show first 10 records
tara tape tail <tapeId> 10        # Show last 10 records
tara tape cat <tapeId>            # Stream all records as JSONL
```

### Statistics

```bash
tara tape summary <tapeId>        # Show statistics and analysis
tara tape summary <tapeId> --json # JSON format
```

## Global Options

- `--json` - Output as JSON
- `--quiet` - Minimal output
- `--verbose` - Verbose output

## Features

- ✅ Colored table output for lists
- ✅ Human-readable text formatting for records
- ✅ JSON output for scripting
- ✅ Summary with statistics, record type distribution, and field frequency
- ✅ Multiple output modes (table, text, JSON)
- ✅ Graceful error handling

## Architecture

- Built with Commander.js for CLI parsing
- Chalk for colored terminal output
- cli-table3 for formatted tables
- Depends on `@jose_pereiro/taralib-js` for tape operations
