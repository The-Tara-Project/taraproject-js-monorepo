import * as path from 'path';
import { getTapesFolderPath } from './home';
import { TapeFileHandler } from './tape-file-handler';
import { TapeGitHandler } from './tape-git-handler';

/**
 * TaraTapeHandler coordinates tape operations through specialized handlers.
 * Use `tape.fileHandler.*` for file operations and `tape.gitHandler.*` for git operations.
 */
export class TaraTapeHandler {
    private tapeId: string;
    private path: string;

    public readonly fileHandler: TapeFileHandler;
    public readonly gitHandler: TapeGitHandler;

    constructor(tapeId: string, tapePath: string) {
        this.tapeId = tapeId;
        this.path = tapePath;
        this.fileHandler = new TapeFileHandler(this);
        this.gitHandler = new TapeGitHandler(this);
    }

    /**
     * Get the tape ID.
     */
    getTapeId(): string {
        return this.tapeId;
    }

    /**
     * Get the file path for this tape.
     */
    getPath(): string {
        return this.path;
    }
}

/**
 * Build the file path for a tape given its ID.
 */
export function buildTapePath(tapeId: string): string {
    const tapesFolderPath = getTapesFolderPath();
    const tapeName = `${tapeId}.tara.jsonl`;
    return path.join(tapesFolderPath, tapeName);
}

/**
 * Create a new TaraTapeHandler handler.
 * If `tapePath` is not provided, it is constructed a global tape handler.
 * @param tapeId - The tape identifier
 * @param tapePath - path for the tape file
 * @returns A new TaraTapeHandler instance
 */
export function createTapeHandler(
    tapeId: string,
    tapePath = buildTapePath(tapeId)
): TaraTapeHandler {
    return new TaraTapeHandler(tapeId, tapePath);
}
