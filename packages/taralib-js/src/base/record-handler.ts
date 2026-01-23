import * as crypto from 'crypto';
import type { ITaraRecord } from './types';
import { isValidUuid4 } from './utils';

/**
 * RecordHandler is a class-based state machine for managing record workflows.
 * Records are immutable after creation - no new custom data can be added.
 * Internal state can change for system operations (serialization caching, validation state, hashing).
 */
export class RecordHandler<T extends Record<string, unknown> = Record<string, unknown>> {
    private readonly id: string;
    private readonly content: Readonly<T>;
    private serializedCache?: string;

    /**
     * Get the __tara metadata object.
     */
    get __tara(): { id: string } {
        return { id: this.id };
    }

    /**
     * Create a new RecordHandler.
     * @param content - The record content (will be frozen for immutability)
     * @param id - Optional UUID (generated if not provided)
     */
    constructor(content: T = {} as T, id?: string) {
        this.id = id || crypto.randomUUID();

        // Validate ID if provided
        if (!isValidUuid4(this.id)) {
            throw new Error('Invalid record: invalid UUID v4 format for id');
        }

        // Freeze content for immutability
        this.content = Object.freeze({ ...content }) as Readonly<T>;
    }

    /**
     * Get the record ID.
     */
    getId(): string {
        return this.id;
    }

    /**
     * Get the record content (frozen, read-only).
     */
    getContent(): Readonly<T> {
        return this.content;
    }

    /**
     * Convert the record to a plain object with __tara metadata.
     * This is the format used for serialization and external access.
     */
    toObject(): T & { __tara: { id: string } } {
        return {
            ...this.content,
            __tara: { id: this.id }
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

    /**
     * Validate a plain object as a valid RecordHandler structure.
     */
    private static _isValidRecordObject(obj: unknown): boolean {
        if (typeof obj !== 'object' || obj === null) {
            return false;
        }
        const record = obj as Record<string, unknown>;
        if (typeof record.__tara !== 'object' || record.__tara === null) {
            return false;
        }
        const meta = record.__tara as Record<string, unknown>;
        if (typeof meta.id !== 'string') {
            return false;
        }
        return isValidUuid4(meta.id);
    }

    /**
     * Create a RecordHandler from a plain object.
     * The object must have a valid __tara.id field.
     */
    static fromObject<T extends Record<string, unknown>>(obj: T & Record<string, unknown>): RecordHandler<T> {
        if (!RecordHandler._isValidRecordObject(obj)) {
            throw new Error('Invalid record: missing or invalid __tara.id');
        }

        const meta = obj.__tara as Record<string, unknown>;
        const id = meta.id as string;

        // Extract content (everything except __tara)
        const { __tara, ...content } = obj;

        return new RecordHandler<T>(content as T, id);
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

