import { TapeFileHandler } from './tape-file-handler';
import { GTapeGitHandler } from './tape-git-handler';

/**
 * GTapeHandler coordinates tape operations through specialized handlers.
 * Use `tape.fileHandler.*` for file operations and `tape.gitHandler.*` for git operations.
 */
export class GTapeHandler {
    private tapeId: string;
    private path: string;

    public readonly fileHandler: TapeFileHandler;
    public readonly gitHandler: GTapeGitHandler;

    constructor(
        tapeId: string,
        tapePath: string
    ) {
        this.tapeId = tapeId;
        this.path = tapePath;
        this.fileHandler = new TapeFileHandler(this);
        this.gitHandler = new GTapeGitHandler(this);
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
