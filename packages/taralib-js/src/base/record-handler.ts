import * as crypto from 'crypto';
import type { ITaraRecord, ITaraRecordMeta } from './types';
import { isValidUuid4 } from './utils';

type RecordHandlerContent = Record<string, unknown>;

export interface RecordHandlerOptions {
    // Future options can be added here
    [key: string]: unknown;
}

export interface RecordHandlerRecipe {
    content: RecordHandlerContent;
    __tararecord?: Partial<ITaraRecordMeta>;
}


/**
 * RecordHandler is a class-based state machine for managing record workflows.
 * Records are immutable after creation - no new custom data can be added.
 * Internal state can change for system operations (serialization caching, validation state, hashing).
 */
export class RecordHandler{
    private aux__tararecord: ITaraRecordMeta;       // auxilary metadata
    private readonly content: Readonly<RecordHandlerContent>;  // auxilary content

    private serializedCache?: string;

    /**
     * Get the __tararecord metadata object.
     */
    get __tararecord(): ITaraRecordMeta {
        const meta: ITaraRecordMeta = { id: this.aux__tararecord.id };
        if (this.aux__tararecord.writer) {
            meta.writer = this.aux__tararecord.writer;
        }
        if (this.aux__tararecord.contentHash) {
            meta.contentHash = this.aux__tararecord.contentHash;
        }
        if (this.aux__tararecord.type) {
            meta.type = this.aux__tararecord.type;
        }
        return meta;
    }

    /**
     * Create a new RecordHandler.
     * @param content - The record content (will be frozen for immutability)
     * @param id - Optional UUID (generated if not provided)
     * @param writer - Optional identifier for who/what created this record
     */
    constructor(recipe: RecordHandlerRecipe) {

        // check for reserved keys in content
        if ('__tararecord' in recipe.content) {
            throw new Error('Invalid record: content cannot contain reserved key __tararecord. Use RecordHandler.fromObject() to create from existing record object.');
        }

        // Initialize metadata
        this.aux__tararecord = {
            id: recipe.__tararecord?.id || crypto.randomUUID(),
            writer: recipe.__tararecord?.writer,
            contentHash: recipe.__tararecord?.contentHash,
            canonicalHash: recipe.__tararecord?.canonicalHash,
            type: recipe.__tararecord?.type
        };

        // Validate ID if provided
        if (!isValidUuid4(this.aux__tararecord.id)) {
            throw new Error('Invalid record: invalid UUID v4 format for id');
        }

        // Freeze content for immutability
        this.content = Object.freeze({ ...recipe.content }) as Readonly<RecordHandlerContent>;
    }

    /**
     * Get the record ID.
     */
    getId(): string {
        return this.aux__tararecord.id;
    }

    /**
     * Get the record content (frozen, read-only).
     */
    getContent(): Readonly<RecordHandlerContent> {
        return this.content;
    }

    /**
     * Convert the record to a plain object with __tararecord metadata.
     * This is the format used for serialization and external access.
     */
    toObject(): ITaraRecord {
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
            const obj = this.toObject()
            this.serializedCache = JSON.stringify(obj);
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

    static checkValidRecordObject(obj: unknown): void {
        if (!RecordHandler._isValidRecordObject(obj)) {
            throw new Error('Invalid record: missing or invalid __tararecord.id');
        }
    }

    /**
     * Create a RecordHandler from a plain object.
     * The object must have a valid __tararecord.id field.
     */
    static fromObject(
        obj: unknown
    ): RecordHandler {
        if (!RecordHandler._isValidRecordObject(obj)) {
            throw new Error('Invalid record: missing or invalid __tararecord.id');
        }

        // Extract content (everything except __tararecord)
        const { __tararecord, ...content } = obj as ITaraRecord;

        return new RecordHandler({
            content: content as RecordHandlerContent, 
            __tararecord: __tararecord as Partial<ITaraRecordMeta>
        });
    }

    /**
     * Parse a JSON string into a RecordHandler.
     */
    static fromJSON(json: string): RecordHandler {
        let parsed: unknown;
        try {
            parsed = JSON.parse(json);
        } catch (error) {
            throw new Error(`Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}`);
        }

        if (typeof parsed !== 'object' || parsed === null) {
            throw new Error('Invalid record: parsed JSON is not an object');
        }

        return RecordHandler.fromObject(parsed);
    }

    /**
     * Check if an object is a valid RecordHandler structure.
     */
    static isValid(obj: unknown): boolean {
        return RecordHandler._isValidRecordObject(obj);
    }
}

