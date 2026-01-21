## Purpose
- high-level architecture structure of the tarason fullstack system
- It describes the main components/subsystems
- It is intended for bird-eye understanding of the system architecture

## SubSystem: Tara Home Folder
- `~/.taraproject` folder
- A hidden folder in the user's home directory to store global `Tara` configuration and data.
- It store the global `TaraTape`s
    - Any application can read and write records to a global `Tape` 
- storage space for `Tara` applications auxiliary data.

## SubSystem: Git-Storage
- It is a TaraStdLib subsystem
- Goalds: provide stable links to git-stored files
- It creates repos at a `~/.taraproject/git-storage/` folder to store snapshots of user tracked folders
- a goal is not to touch user folders
- Any `Tara` application can demand a snapshot of a folder to be stored
- and a link to the snapshot can be built and returned
- The link is stable across machines and environments
- The link can be used to retrieve the snapshot at any time
- It is an independent service that can be used by any `Tara` application
- It has its own `.gitignore` file to avoid tracking unnecessary files
- It can handle remote pushing
- As `Tara` it is inmmutable
- It is only a storage service for text files
- It does not provide any processing or analysis of the stored files

## SubSystem: Tara Global Tapes
- A central folder to store global `Tara` tapes
- Located at `~/.taraproject/tapes/`
- Any `Tara` application can read and write tapes to this folder
- It is a shared resource for all `Tara` applications
- It allows for easy sharing of data between different `Tara` applications
- It is git tracked to allow for versioning and history of the tapes
- format as Tara Tape Files

## SubSystem: Tara Plugins
- A folder to store `Tara` plugins
- Located at `~/.taraproject/plugins/`
- Any `Tara` application can load plugins from this folder
- It allows for easy extension of `Tara` functionality
- Plugins should be discoverable and loadable by any `Tara` application

## SubSystem: Tara Kernel
- A core library with `Tara` fundamentals
- Definitions basic data structures `Tapes`, `Records`, and basic operations
- Basic I/O operations for reading and writing `Tapes`
- Provides minimal security and integrity checks for `Tapes`
- Enforce invariants on `Tara` data structures

## SubSystem: Tara Tapes Files
- A file format specification for `Tara` Tapes
- Defines how `Tapes` are serialized and deserialized to/from disk
- Provides utilities for working with `Tara` Tape files

## SubSystem: Tara StdLib
- A standard library with common utilities and functions for `Tara` applications
- Common data processors and analyzers

## SubSystem: Tara MCP Server API
- Expose a server to handle `Tara` MCP requests
- Allow remote applications to interact with `Tara` tapes and data

## SubSystem: Tara Service Registry
- A registry to manage `Tara` services
- A plugins can register a service

## Service: Context Bundler
- A service to aggregate and serialize context data
- for instance, VS Code context, Git context, etc.
- It can be used by other `Tara` components to get a comprehensive context snapshot on demand

## SubSystem: Tara CLI
- A command-line interface for interacting with `Tara` tapes and data
- Basic commands for reading, writing, and managing `Tara` tapes
