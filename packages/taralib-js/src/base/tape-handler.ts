import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { RecordHandler } from './record-handler';
import type { ITapeMetaRecord, ITaraRecord, ReadRecordsCallback, ReadRecordsCallbackArgs, ReadJSONLCallback, ReadJSONLCallbackArgs } from './types';
import { isValidUuid4 } from './utils';

const FORMAT_VERSION = '0.0.1';

/**
 * TapeHandler handles all tape operations including file I/O.
 * Tapes are append-only JSONL files with metadata and record management.
 */
export class TapeHandler {
    private tapeId: string;
    private path: string;
    private writer?: string;
    private metadata?: ITapeMetaRecord;

    constructor(
        tapeId: string,
        tapePath: string,
        options?: { writer?: string }
    ) {
        this.tapeId = tapeId;
        this.path = tapePath;
        this.writer = options?.writer;
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
    getHomePath(): string {
        return this.path;
    }

    /**
     * Get the writer identifier for this tape handler.
     */
    getWriter(): string | undefined {
        return this.writer;
    }

    /**
     * Validate if an object is valid tape metadata.
     */
    private _isValidTapeMetadata(obj: unknown): obj is ITapeMetaRecord {
        if (!RecordHandler.isValid(obj)) {
            return false;
        }

        const record = obj as Record<string, unknown>;

        // Check __taratape object
        if (typeof record.__taratape !== 'object' || record.__taratape === null) {
            return false;
        }

        const tapeMeta = record.__taratape as Record<string, unknown>;

        // Validate tape ID (UUID4)
        if (typeof tapeMeta.id !== 'string' || !isValidUuid4(tapeMeta.id)) {
            return false;
        }

        // Validate name
        if (typeof tapeMeta.name !== 'string' || tapeMeta.name.length === 0) {
            return false;
        }

        // Validate formatVersion
        if (typeof tapeMeta.formatVersion !== 'string' || tapeMeta.formatVersion.length === 0) {
            return false;
        }

        // Validate createdAt
        if (typeof tapeMeta.createdAt !== 'string' || tapeMeta.createdAt.length === 0) {
            return false;
        }

        // Validate writer (required)
        if (typeof tapeMeta.writer !== 'string' || tapeMeta.writer.length === 0) {
            return false;
        }

        return true;
    }

    /**
     * Create tape metadata record.
     * @param customMetadata - Optional user-defined metadata for the tape (placed at top level)
     */
    private _builtTapeMetadata(customMetadata?: Record<string, unknown>): RecordHandler {
        const writer = this.getWriter();
        if (!writer || typeof writer !== 'string' || writer.trim().length === 0) {
            throw new Error('writer is required and must be a non-empty string');
        }

        return new RecordHandler({
            ...customMetadata,  // user metadata at top level
            __taratape: {
                id: crypto.randomUUID(),
                name: this.tapeId,
                formatVersion: FORMAT_VERSION,
                createdAt: new Date().toISOString(),
                writer,
                type: 'taralib/tape-metadata'
            }
        }, { writer });
    }

    /**
     * Bootstrap a new tape file
     * - creates necessary directories
     * - writes initial metadata record
     * @param customMetadata - Optional user-defined metadata for the tape
     */
    private _bootstrapTape(customMetadata?: Record<string, unknown>): void {
        // Ensure parent directory exists
        const dir = path.dirname(this.path);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        const meta = this._builtTapeMetadata(customMetadata);
        fs.writeFileSync(this.path, meta.toString() + '\n', 'utf-8');
    }

    /**
     * Create the tape file if it doesn't exist.
     * This operation is idempotent.
     * Uses writer from the TapeHandler instance for tape metadata.
     * @param options.metadata - Optional user-defined metadata for the tape (placed at top level of first record)
     */
    instantiate(options?: { metadata?: Record<string, unknown> }): this {
        // If file already exists, return early (idempotent)
        if (fs.existsSync(this.path)) {
            return this;
        }

        this._bootstrapTape(options?.metadata);
        return this;
    }

    async countLines(): Promise<number> {
        const fileStream = fs.createReadStream(this.path, { encoding: 'utf-8' });
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity,
        });
        let lineCount = 0;
        
        try {
            for await (const _ of rl) {
                lineCount++;
            }
            return lineCount;
        } finally {
            rl.close();
            fileStream.close();
        }
    }

    /**
     * Read all lines from the tape file as JSON with a callback.
     * No validation is performed - parsing failures result in parsed=null.
     * @param callback - Function called for each line. Return 'stop' to halt iteration.
     */
    async readJSONL(callback: ReadJSONLCallback): Promise<void> {
        const fileStream = fs.createReadStream(this.path, { encoding: 'utf-8' });
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity,
        });

        let lineNumber = 0;

        try {
            for await (const line of rl) {
                lineNumber++;

                let parsed: any | null = null;
                try {
                    parsed = JSON.parse(line);
                } catch {
                    // If parse fails, parsed remains null
                }

                const elm: ReadJSONLCallbackArgs = {
                    parsed,
                    lineNumber,
                    line,
                };

                const result = callback(elm);
                if (result === 'stop') {
                    break;
                }
            }
        } finally {
            rl.close();
            fileStream.close();
        }
    }

    /**
     * Read all records from the tape with a callback.
     * Validates each record and throws on corrupted data.
     * @param callback - Function called for each valid record. Return 'stop' to halt iteration.
     */
    async readRecords(callback: ReadRecordsCallback): Promise<void> {
        await this.readJSONL(({ parsed, lineNumber, line }) => {
            // Skip empty lines
            if (line.trim().length === 0) {
                return;
            }

            // If parsing failed, throw error
            if (parsed === null) {
                throw new Error(`Corrupted record at line ${lineNumber}: Invalid JSON`);
            }

            // Validate as a TaraRecord
            if (!RecordHandler.isValid(parsed)) {
                throw new Error(`Corrupted record at line ${lineNumber}: Invalid record structure`);
            }

            const elm: ReadRecordsCallbackArgs = {
                parsed: parsed as ITaraRecord,
                lineNumber,
                line,
            };

            return callback(elm);
        });
    }

    /**
     * Enrich a record with writer metadata from the tape's writer.
     * Merges the writer into the record's __tararecord metadata.
     * @private
     */
    private _enrichRecordMetadata(record: RecordHandler): string {
        const writer = this.getWriter();
        const recordObj = record.toObject();

        // Add writer to metadata if writer is available
        if (writer && recordObj.__tararecord) {
            recordObj.__tararecord.writer = writer;
        }

        return JSON.stringify(recordObj);
    }

    /**
     * Append a single record to the tape.
     * Automatically enriches record with tape's writer as writer.
     */
    appendRecord(record: RecordHandler): void {
        const line = this._enrichRecordMetadata(record) + '\n';
        fs.appendFileSync(this.path, line, 'utf-8');
    }

    /**
     * Append multiple records to the tape in a single operation.
     * Automatically enriches records with tape's writer as writer.
     */
    appendRecordBatch(records: RecordHandler[]): void {
        const content = records.map(
            record => this._enrichRecordMetadata(record)
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
    async readMetadata(): Promise<ITapeMetaRecord> {
        this.checkFile();

        if (this.metadata) {
            return this.metadata;
        }

        let metadata: ITapeMetaRecord | null = null;

        await this.readRecords(({ parsed }) => {
            if (!this._isValidTapeMetadata(parsed)) {
                throw new Error('Invalid metadata record');
            }
            metadata = parsed as ITapeMetaRecord;
            return 'stop';
        });

        if (!metadata) {
            throw new Error('No metadata record found in tape');
        }

        this.metadata = metadata;
        return metadata;
    }

    // MARK: ...getRecordById
    /**
     * Retrieve a specific record from the tape by its ID.
     *
     * @param recordId - The ID of the record to retrieve.
     * @returns The full ITaraRecord object, or undefined if not found.
     */
    async getRecordById(recordId: string): Promise<ITaraRecord | undefined> {
        this.checkFile(); // Ensure tape file exists
        let foundRecord: ITaraRecord | undefined;

        await this.readRecords(({ parsed }) => {
            if (parsed.__tararecord?.id === recordId) {
                foundRecord = parsed;
                return 'stop'; // Stop iterating once found
            }
        });

        return foundRecord;
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
