import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import type { TaraStack } from '../../tara-stack';
import { TapeHandler } from '../../../base/tape-handler';
import { YYYYMM_prefix } from '../../../base/utils';

/**
 * GTapeManager provides high-level operations for managing Tara tapes in the global scope (~/.taraproject/tapes/).
 * Each tapeId gets its own git repo with monthly-rotated tape files.
 *
 * Directory layout:
 *   tapes/<tapeId>/.git
 *   tapes/<tapeId>/<YYYYMM>-<tapeId>.tara.jsonl
 */
export class GTapeManager {
    constructor(private context: TaraStack) {
        // Bootstrap: No logic needed
    }

    /**
     * Get the repo directory path for a tape.
     * @private
     */
    private builtRepoPath(tapeId: string): string {
        return this.context.global.home.getTapesPath(tapeId);
    }

    /**
     * Build the current month's tape filename.
     * @private
     */
    private buildCurrentTapeName(tapeId: string): string {
        return `${YYYYMM_prefix(tapeId)}.tara.jsonl`;
    }

    /**
     * Build the file path for the current month's tape.
     * @private
     */
    private buildTapePath(tapeId: string): string {
        const repoPath = this.builtRepoPath(tapeId);
        return path.join(repoPath, this.buildCurrentTapeName(tapeId));
    }

    /**
     * Ensure the git repo for a tape exists (mkdir + git init). Idempotent.
     * @private
     */
    private instantiateRepo(tapeId: string): void {
        const repoPath = this.builtRepoPath(tapeId);

        if (!fs.existsSync(repoPath)) {
            fs.mkdirSync(repoPath, { recursive: true });
        }

        const gitDir = path.join(repoPath, '.git');
        if (!fs.existsSync(gitDir)) {
            execSync('git init', {
                cwd: repoPath,
                encoding: 'utf-8',
                stdio: ['pipe', 'pipe', 'pipe']
            });
        }
    }

    /**
     * List all .tara.jsonl files in a tape's repo.
     */
    listTapeFiles(tapeId: string): string[] {
        const repoPath = this.builtRepoPath(tapeId);
        if (!fs.existsSync(repoPath)) return [];

        return fs.readdirSync(repoPath)
            .filter(f => f.endsWith('.tara.jsonl'))
            .sort();
    }

    /**
     * List all tape IDs. Returns folder names in tapes/ that contain .git.
     */
    list(): string[] {
        const tapesPath = this.context.global.home.getTapesPath();
        if (!fs.existsSync(tapesPath)) return [];

        return fs.readdirSync(tapesPath).filter(name => {
            const gitDir = path.join(tapesPath, name, '.git');
            return fs.existsSync(gitDir);
        });
    }

    /**
     * Get handler for a tape (creates new instance each time).
     * Ensures the git repo exists before returning the handler.
     *
     * @param tapeId - The ID of the tape
     * @returns A new TapeHandler instance pointing to the current month's tape file
     */
    get(tapeId: string): TapeHandler {
        this.instantiateRepo(tapeId);
        const writer = this.context.settings.getSetting('writer');
        return new TapeHandler({
            tapeId,
            tapePath: this.buildTapePath(tapeId),
            options: { writer }
        });
    }

    /**
     * Check if a tape repo exists (has .git directory).
     */
    exists(tapeId: string): boolean {
        const gitDir = path.join(this.builtRepoPath(tapeId), '.git');
        return fs.existsSync(gitDir);
    }

    /**
     * Delete an entire tape repo (rm -rf tapes/<tapeId>/).
     */
    delete(tapeId: string): void {
        const repoPath = this.builtRepoPath(tapeId);
        if (fs.existsSync(repoPath)) {
            fs.rmSync(repoPath, { recursive: true, force: true });
        }
    }

    /**
     * Stage and commit all dirty tape files in a tape's git repo.
     * No-op if there are no changes to commit.
     */
    commitChanges(tapeId: string): void {
        const repoPath = this.builtRepoPath(tapeId);
        const gitDir = path.join(repoPath, '.git');
        if (!fs.existsSync(gitDir)) return;

        const execGit = (cmd: string) =>
            execSync(`git ${cmd}`, {
                cwd: repoPath,
                encoding: 'utf-8',
                stdio: ['pipe', 'pipe', 'pipe']
            });

        // Stage all .tara.jsonl files
        execGit('add *.tara.jsonl');

        // Check if there's anything to commit
        try {
            execGit('diff --cached --quiet');
            // No changes staged — nothing to commit
            return;
        } catch {
            // Changes exist — proceed with commit
        }

        execGit(`commit -m "tape: ${tapeId}"`);
    }
}
