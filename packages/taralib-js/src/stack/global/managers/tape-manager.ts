import * as fs from 'fs';
import * as path from 'path';
import type { TaraStack } from '../../tara-stack';
import { GTapeHandler } from '../../../base/tape-handler';

/**
 * GTapeManager provides high-level operations for managing Tara tapes in the global scope (~/.taraproject/tapes/).
 *
 */
export class GTapeManager {
    constructor(private context: TaraStack) { 
        // Bootstrap: No logic needed
    }

    /**
     * Build the file path for a tape given its ID.
     * @private
     */
    private buildTapePath(tapeId: string): string {
        const tapesPath = this.context.global.home.getTapesPath();
        const tapeName = `${tapeId}.tara.jsonl`;
        return path.join(tapesPath, tapeName);
    }

    /**
     * List all tape IDs in ~/.taraproject/tapes/
     * @returns Array of tape IDs (without .tara.jsonl extension)
     */
    list(): string[] {
        const tapesPath = this.context.global.home.getTapesPath();
        if (!fs.existsSync(tapesPath)) return [];

        return fs.readdirSync(tapesPath)
            .filter(f => f.endsWith('.tara.jsonl'))
            .map(f => f.replace('.tara.jsonl', ''));
    }

    /**
     * Get handler for a tape (creates new instance each time).
     * Note: Tape file may not exist yet - use exists() to check.
     *
     * @param tapeId - The ID of the tape
     * @returns A new GTapeHandler instance
     */
    get(tapeId: string): GTapeHandler {
        const writer = this.context.settings.getSetting('writer');
        return new GTapeHandler(tapeId, this.buildTapePath(tapeId), { writer });
    }

    /**
     * Check if a tape file exists.
     *
     * @param tapeId - The ID of the tape to check
     * @returns true if the tape file exists, false otherwise
     */
    exists(tapeId: string): boolean {
        const tapePath = this.buildTapePath(tapeId);
        return fs.existsSync(tapePath);
    }

    /**
     * Delete a tape file.
     *
     * @param tapeId - The ID of the tape to delete
     */
    delete(tapeId: string): void {
        const tapePath = this.buildTapePath(tapeId);
        if (fs.existsSync(tapePath)) {
            fs.unlinkSync(tapePath);
        }
    }
}
