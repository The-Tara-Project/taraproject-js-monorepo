import * as path from 'path';
import * as os from 'os';
import { TapeFileHandler } from './tape-file-handler';
import { TapeGitHandler } from './tape-git-handler';

/**
 * TapeHandler coordinates tape operations through specialized handlers.
 * Use `tape.fileHandler.*` for file operations and `tape.gitHandler.*` for git operations.
 */
export class TapeHandler {
    private tapeId: string;
    private path: string;

    public readonly fileHandler: TapeFileHandler;
    public readonly gitHandler: TapeGitHandler;

    constructor(
        tapeId: string,
        tapePath: string = buildGlobalTapePath(tapeId)
    ) {
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
 * @deprecated Use HomeHandler.getTapesPath() or TaraStack.global.home.getTapesPath() instead
 */
export function buildGlobalTapePath(tapeId: string): string {
    const taraHome = process.env.TARA_HOME || path.join(os.homedir(), '.taraproject');
    const tapesFolderPath = path.join(taraHome, 'tapes');
    const tapeName = `${tapeId}.tara.jsonl`;
    return path.join(tapesFolderPath, tapeName);
}
