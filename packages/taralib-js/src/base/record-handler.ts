import * as crypto from 'crypto';
import type { ITaraRecord, ITaraRecordMeta } from './types';
import { isValidUuid4 } from './utils';


/**
 * RecordHandler is a class-based state machine for managing record workflows.
 * Records are immutable after creation - no new custom data can be added.
 * Internal state can change for system operations (serialization caching, validation state, hashing).
 */
export class RecordHandler<T extends Record<string, unknown> = Record<string, unknown>> {
    private auxmeta: ITaraRecordMeta;       // auxilary metadata
    private readonly content: Readonly<T>;  // auxilary content

    private serializedCache?: string;

    /**
     * Get the __tararecord metadata object.
     */
    get __tararecord(): ITaraRecordMeta {
        const meta: ITaraRecordMeta = { id: this.auxmeta.id };
        if (this.auxmeta.writer) {
            meta.writer = this.auxmeta.writer;
        }
        if (this.auxmeta.contentHash) {
            meta.contentHash = this.auxmeta.contentHash;
        }
        return meta;
    }

    /**
     * Create a new RecordHandler.
     * @param content - The record content (will be frozen for immutability)
     * @param id - Optional UUID (generated if not provided)
     * @param writer - Optional identifier for who/what created this record
     */
    constructor(content: T = {} as T,
        options?: {} & ITaraRecordMeta
    ) {
        this.auxmeta = {
            id: options?.id || crypto.randomUUID(),
            writer: options?.writer, 
            contentHash: options?.contentHash,
            canonicalHash: options?.canonicalHash
        };

        // Validate ID if provided
        if (!isValidUuid4(this.auxmeta.id)) {
            throw new Error('Invalid record: invalid UUID v4 format for id');
        }

        // Freeze content for immutability
        this.content = Object.freeze({ ...content }) as Readonly<T>;
    }

    /**
     * Get the record ID.
     */
    getId(): string {
        return this.auxmeta.id;
    }

    /**
     * Get the record content (frozen, read-only).
     */
    getContent(): Readonly<T> {
        return this.content;
    }

    /**
     * Convert the record to a plain object with __tararecord metadata.
     * This is the format used for serialization and external access.
     */
    toObject(): T & { __tararecord: ITaraRecordMeta } {
        return {
            ...this.content,
            __tararecord: this.__tararecord
        };
    }

    /**
     * Serialize the record to a JSON string.
     * Result is cached internally to avoid repeated stringification.
     */
    toString(): string {
        if (!this.serializedCache) {
            this.serializedCache = JSON.stringify(this.toObject());
        }
        return this.serializedCache;
    }

    // MARK: Static methods
    /**
     * Validate a plain object as a valid RecordHandler structure.
     */
    private static _isValidRecordObject(obj: unknown): boolean {
        if (typeof obj !== 'object' || obj === null) {
            return false;
        }
        const record = obj as Record<string, unknown>;
        if (typeof record.__tararecord !== 'object' || record.__tararecord === null) {
            return false;
        }
        const meta = record.__tararecord as Record<string, unknown>;
        if (typeof meta.id !== 'string') {
            return false;
        }
        return isValidUuid4(meta.id);
    }

    /**
     * Create a RecordHandler from a plain object.
     * The object must have a valid __tararecord.id field.
     */
    static fromObject<T extends Record<string, unknown>>(obj: T & Record<string, unknown>): RecordHandler<T> {
        if (!RecordHandler._isValidRecordObject(obj)) {
            throw new Error('Invalid record: missing or invalid __tararecord.id');
        }

        const meta = obj.__tararecord as Record<string, unknown>;
        const id = meta.id as string;
        const writer = meta?.writer as string | undefined;

        // Extract content (everything except __tararecord)
        const { __tararecord, ...content } = obj;

        return new RecordHandler<T>(content as T, { id, writer });
    }

    /**
     * Parse a JSON string into a RecordHandler.
     */
    static fromJSON<T extends Record<string, unknown>>(json: string): RecordHandler<T> {
        let parsed: unknown;
        try {
            parsed = JSON.parse(json);
        } catch (error) {
            throw new Error(`Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}`);
        }

        if (typeof parsed !== 'object' || parsed === null) {
            throw new Error('Invalid record: parsed JSON is not an object');
        }

        return RecordHandler.fromObject<T>(parsed as T & Record<string, unknown>);
    }

    /**
     * Check if an object is a valid RecordHandler structure.
     */
    static isValid(obj: unknown): boolean {
        return RecordHandler._isValidRecordObject(obj);
    }
}

