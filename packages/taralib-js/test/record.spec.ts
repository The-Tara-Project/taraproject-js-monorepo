import { describe, it, expect } from 'vitest';
import { createRecord, isValidRecord, isValidUuid4 } from '../src';

describe('record', () => {
    describe('createRecord', () => {
        it('creates record with __tara.id', () => {
            const record = createRecord();
            expect(record.__tara).toBeDefined();
            expect(record.__tara.id).toBeDefined();
            expect(isValidUuid4(record.__tara.id)).toBe(true);
        });

        it('preserves content in record', () => {
            const record = createRecord({ foo: 'bar', count: 42 });
            expect(record.foo).toBe('bar');
            expect(record.count).toBe(42);
            expect(record.__tara.id).toBeDefined();
        });

        it('generates unique ids', () => {
            const r1 = createRecord();
            const r2 = createRecord();
            expect(r1.__tara.id).not.toBe(r2.__tara.id);
        });
    });

    describe('isValidUuid4', () => {
        it('validates correct uuid4', () => {
            expect(isValidUuid4('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
            expect(isValidUuid4('6ba7b810-9dad-41d1-80b4-00c04fd430c8')).toBe(true);
        });

        it('rejects invalid uuids', () => {
            expect(isValidUuid4('')).toBe(false);
            expect(isValidUuid4('not-a-uuid')).toBe(false);
            expect(isValidUuid4('550e8400-e29b-11d4-a716-446655440000')).toBe(false); // version 1
            expect(isValidUuid4('550e8400-e29b-41d4-c716-446655440000')).toBe(false); // wrong variant
        });
    });

    describe('isValidRecord', () => {
        it('validates correct record', () => {
            const record = createRecord({ data: 'test' });
            expect(isValidRecord(record)).toBe(true);
        });

        it('rejects null', () => {
            expect(isValidRecord(null)).toBe(false);
        });

        it('rejects non-object', () => {
            expect(isValidRecord('string')).toBe(false);
            expect(isValidRecord(123)).toBe(false);
        });

        it('rejects object without __tara', () => {
            expect(isValidRecord({ foo: 'bar' })).toBe(false);
        });

        it('rejects object with invalid __tara.id', () => {
            expect(isValidRecord({ __tara: { id: 'invalid' } })).toBe(false);
            expect(isValidRecord({ __tara: { id: 123 } })).toBe(false);
            expect(isValidRecord({ __tara: {} })).toBe(false);
        });
    });
});
