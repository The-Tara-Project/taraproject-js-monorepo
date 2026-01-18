import * as fs from 'fs';
import * as readline from 'readline';
import { ensureTaraHome } from './home';
import { TaraRecord } from './record';
import type { ReadRecordsCallback, ReadRecordsCallbackArgs, TaraRecord as ITaraRecord, TaraTapeMetadata } from './types';
import { TaraTapeHandler } from './tape-handler';

const FORMAT_VERSION = '1.0.0';

/**
 * TapeFileHandler handles all file operations for a tape.
 * Tapes are append-only JSONL files with metadata and record management.
 */
export class TapeFileHandler {
    private tapeId: string;
    private path: string;
    private metadata?: TaraTapeMetadata;

    constructor(
        private tape: TaraTapeHandler
    ) {
        this.tapeId = tape.getTapeId();
        this.path = tape.getPath();
    }

    /**
     * Validate if an object is valid tape metadata.
     */
    private _isValidTapeMetadata(obj: unknown): obj is TaraTapeMetadata {
        if (!TaraRecord.isValid(obj)) {
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
    private _builtTapeMetadata(): TaraTapeMetadata {
        const record = new TaraRecord({
            type: 'taralib/tape-metadata',
            tapeId: this.tapeId,
            formatVersion: FORMAT_VERSION,
            createdAt: new Date().toISOString(),
        });

        return record.toObject() as TaraTapeMetadata;
    }

    /**
     * Bootstrap a new tape file
     * - creates necessary directories
     * - writes initial metadata record
     */
    private _bootstrapTape(): void {
        ensureTaraHome();
        const meta = this._builtTapeMetadata();
        fs.writeFileSync(this.path, meta.toString() + '\n', 'utf-8');
    }

    /**
     * Create the tape file if it doesn't exist.
     * This operation is idempotent.
     */
    instantiate(): this {
        if (fs.existsSync(this.path)) {
            return this;
        }
        this._bootstrapTape();
        return this;
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
                const taraRecord = TaraRecord.fromJSON(line);
                const parsed = taraRecord.toObject() as ITaraRecord;

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
     */
    appendRecord(record: TaraRecord): void {
        const line = record.toString() + '\n';
        fs.appendFileSync(this.path, line, 'utf-8');
    }

    /**
     * Append multiple records to the tape in a single operation.
     */
    appendRecordBatch(records: TaraRecord[]): void {
        const content = records.map(
            record => record.toString()
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
