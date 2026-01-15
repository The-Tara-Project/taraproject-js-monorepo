import * as crypto from 'crypto';
import type { TaraRecord } from './types';

const UUID4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createRecord(
    content: Record<string, unknown> = {}
): TaraRecord {
    const record = {
        ...content,
        __tara: {
            id: crypto.randomUUID(),
        },
    };
    return checkValidRecord(record)
}

export function isValidUuid4(id: string): boolean {
    return UUID4_REGEX.test(id);
}

export function isValidRecord(obj: unknown): obj is TaraRecord {
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

export function checkValidRecord(record: unknown): TaraRecord {
    if (isValidRecord(record)) { return record; }
    throw new Error('Invalid record: missing or invalid __tara.id');
}

export function stringifyRecord(
    record: TaraRecord
): string {
    return JSON.stringify(record);
}

export function parseRecord(json: string): TaraRecord {
    let parsed: unknown;
    try {
        parsed = JSON.parse(json);
    } catch (error) {
        throw new Error(`Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (!isValidRecord(parsed)) {
        throw new Error('Invalid record: missing or invalid __tara.id');
    }

    return parsed;
}