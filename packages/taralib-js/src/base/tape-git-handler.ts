import * as path from 'path';
import { GitHandler } from './git-handler';
import { GTapeHandler } from './tape-handler';

/**
 * GTapeGitHandler provides tape-specific git operations.
 * It wraps GitHandler and scopes operations to a specific tape file.
 */
export class GTapeGitHandler {
    private tapePath: string;
    private repoPath: string;
    private gitHandler: GitHandler;

    constructor(
        private tape: GTapeHandler
    ) {
        this.tapePath = tape.getPath();
        this.repoPath = path.dirname(this.tapePath);
        this.gitHandler = new GitHandler(this.repoPath);
    }

    /**
     * Initialize the git repository if it doesn't exist.
     */
    init(): this {
        this.gitHandler.init();
        return this
    }

    /**
     * Check if the tapes folder is a git repository.
     */
    isGitRepo(): boolean {
        return this.gitHandler.isGitRepo();
    }

    /**
     * Commit changes to this tape file.
     * Only stages and commits this specific tape file.
     * @param message - The commit message
     */
    commit(message: string): this {
        // Get the relative path of the tape file within the repo
        const relativePath = path.relative(this.repoPath, this.tapePath);
        this.gitHandler.addFile(relativePath);
        this.gitHandler.commitStaged(message);
        return this;
    }

    /**
     * Get the repository path.
     */
    getRepoPath(): string {
        return this.repoPath;
    }

    /**
     * Get the tape file path.
     */
    getTapePath(): string {
        return this.tapePath;
    }

    getTape(): GTapeHandler {
        return this.tape
    }

}
