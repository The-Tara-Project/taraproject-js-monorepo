import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { ensureTaraHome, getTapesFolderPath } from './home';
import { createRecord, isValidRecord, stringifyRecord, parseRecord } from './record';
import type { ReadRecordsCallback, ReadRecordsCallbackArgs, TaraRecord, TaraTapeMetadata } from './types';

const FORMAT_VERSION = '1.0.0';

/**
 * TaraTape provides operations for managing tape-based record storage.
 * Tapes are append-only JSONL files with metadata and record management.
 */
export class TaraTape {
    private tapeId: string;
    private path: string;
    private metadata?: TaraTapeMetadata;

    constructor(tapeId: string, tapePath: string) {
        this.tapeId = tapeId;
        this.path = tapePath;
    }

    /**
     * Validate if an object is valid tape metadata.
     */
    private _isValidTapeMetadata(obj: unknown): obj is TaraTapeMetadata {
        if (!isValidRecord(obj)) {
            return false;
        }

        const record = obj as Record<string, unknown>;

        if (record.type !== 'taralib/tape-metadata') {
            return false;
        }

        if (typeof record.tapeId !== 'string' || record.tapeId.length === 0) {
            return false;
        }

        if (typeof record.formatVersion !== 'string' || record.formatVersion.length === 0) {
            return false;
        }

        if (typeof record.createdAt !== 'string' || record.createdAt.length === 0) {
            return false;
        }

        return true;
    }

    /**
     * Create tape metadata record.
     */
    private _createTapeMetadata(): TaraTapeMetadata {
        const base = createRecord({
            type: 'taralib/tape-metadata',
            tapeId: this.tapeId,
            formatVersion: FORMAT_VERSION,
            createdAt: new Date().toISOString(),
        });

        return base as TaraTapeMetadata;
    }

    /**
     * Bootstrap a new tape file with metadata.
     */
    private _bootstrapTape(): void {
        ensureTaraHome();
        const metadata = this._createTapeMetadata();
        fs.writeFileSync(this.path, stringifyRecord(metadata) + '\n', 'utf-8');
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

    /**
     * Create the tape file if it doesn't exist.
     * This operation is idempotent.
     */
    instantiate(): void {
        if (fs.existsSync(this.path)) {
            return;
        }
        this._bootstrapTape();
    }

    /**
     * Read all records from the tape with a callback.
     * @param callback - Function called for each record. Return 'stop' to halt iteration.
     */
    async readRecords(callback: ReadRecordsCallback): Promise<void> {
        const fileStream = fs.createReadStream(this.path, { encoding: 'utf-8' });
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity,
        });

        let lineNumber = 0;

        for await (const line of rl) {
            lineNumber++;

            if (line.trim().length === 0) {
                continue;
            }

            try {
                const parsed = parseRecord(line);

                const elm: ReadRecordsCallbackArgs = {
                    parsed,
                    lineNumber,
                    line,
                };
                const result = callback(elm);
                if (result === 'stop') {
                    break;
                }
            } catch (error) {
                throw new Error(`Corrupted record at line ${lineNumber}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }

        fileStream.close();
    }

    /**
     * Append a single record to the tape.
     * Assumes the record is valid (created using createRecord).
     */
    appendRecord(record: TaraRecord): void {
        const line = stringifyRecord(record) + '\n';
        fs.appendFileSync(this.path, line, 'utf-8');
    }

    /**
     * Append multiple records to the tape in a single operation.
     * Assumes all records are valid (created using createRecord).
     */
    appendRecordBatch(records: TaraRecord[]): void {
        const content = records.map(
            record => stringifyRecord(record)
        ).join('\n') + '\n';
        fs.appendFileSync(this.path, content, 'utf-8');
    }

    /**
     * Check if the tape file exists.
     * @throws Error if the tape file does not exist
     */
    checkFile(): void {
        if (!fs.existsSync(this.path)) {
            throw new Error(`Tape file does not exist: ${this.path}`);
        }
    }

    /**
     * Read and return the tape metadata.
     * Metadata is cached after the first read.
     */
    async readMetadata(): Promise<TaraTapeMetadata> {
        this.checkFile();

        if (this.metadata) {
            return this.metadata;
        }

        let metadata: TaraTapeMetadata | null = null;

        await this.readRecords(({ parsed }) => {
            if (!this._isValidTapeMetadata(parsed)) {
                throw new Error('Invalid metadata record');
            }
            metadata = parsed;
            return 'stop';
        });

        if (!metadata) {
            throw new Error('No metadata record found in tape');
        }

        this.metadata = metadata;
        return metadata;
    }

    /**
     * Check if the tape file exists.
     */
    exists(): boolean {
        return fs.existsSync(this.path);
    }

    /**
     * Delete the tape file.
     * Silent no-op if the file doesn't exist.
     */
    delete(): void {
        if (fs.existsSync(this.path)) {
            fs.unlinkSync(this.path);
        }
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
 * Create a new TaraTape handler.
 * If `tapePath` is not provided, it is constructed a global tape handler.
 * @param tapeId - The tape identifier
 * @param tapePath - path for the tape file
 * @returns A new TaraTape instance
 */
export function createTapeHandler(
    tapeId: string,
    tapePath = buildTapePath(tapeId)
): TaraTape {
    return new TaraTape(tapeId, tapePath);
}

// Legacy function exports for backward compatibility
export function getTapePath(tape: TaraTape): string {
    return tape.getPath();
}

export function instantiateTape(tape: TaraTape): void {
    tape.instantiate();
}

export async function readTapeRecords(
    tape: TaraTape,
    callback: ReadRecordsCallback
): Promise<void> {
    return tape.readRecords(callback);
}

export function appendRecord(tape: TaraTape, record: TaraRecord): void {
    tape.appendRecord(record);
}

export function appendRecordBatch(tape: TaraTape, records: TaraRecord[]): void {
    tape.appendRecordBatch(records);
}

export function checkTapeFile(tape: TaraTape): void {
    tape.checkFile();
}

export async function readTapeMetadata(tape: TaraTape): Promise<TaraTapeMetadata> {
    return tape.readMetadata();
}

export function tapeExists(tape: TaraTape): boolean {
    return tape.exists();
}

export function deleteTape(tape: TaraTape): void {
    tape.delete();
}
