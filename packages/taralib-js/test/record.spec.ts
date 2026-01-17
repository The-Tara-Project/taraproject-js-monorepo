import { describe, it, expect } from 'vitest';
import { TaraRecord, isValidUuid4 } from '../src';

describe('record', () => {
    describe('TaraRecord', () => {
        it('creates record with __tara.id', () => {
            const record = new TaraRecord();
            const obj = record.toObject();
            expect(obj.__tara).toBeDefined();
            expect(obj.__tara.id).toBeDefined();
            expect(isValidUuid4(obj.__tara.id)).toBe(true);
        });

        it('preserves content in record', () => {
            const record = new TaraRecord({ foo: 'bar', count: 42 });
            const obj = record.toObject();
            expect(obj.foo).toBe('bar');
            expect(obj.count).toBe(42);
            expect(obj.__tara.id).toBeDefined();
        });

        it('generates unique ids', () => {
            const r1 = new TaraRecord();
            const r2 = new TaraRecord();
            expect(r1.getId()).not.toBe(r2.getId());
        });

        it('provides access to content', () => {
            const record = new TaraRecord({ foo: 'bar' });
            const content = record.getContent();
            expect(content.foo).toBe('bar');
        });

        it('serializes to JSON', () => {
            const record = new TaraRecord({ foo: 'bar' });
            const json = record.toString();
            const parsed = JSON.parse(json);
            expect(parsed.foo).toBe('bar');
            expect(parsed.__tara).toBeDefined();
            expect(parsed.__tara.id).toBeDefined();
        });

        it('creates from plain object', () => {
            const obj = {
                foo: 'bar',
                __tara: { id: '550e8400-e29b-41d4-a716-446655440000' }
            };
            const record = TaraRecord.fromObject(obj);
            expect(record.getId()).toBe('550e8400-e29b-41d4-a716-446655440000');
            expect(record.getContent().foo).toBe('bar');
        });

        it('parses from JSON', () => {
            const json = '{"foo":"bar","__tara":{"id":"550e8400-e29b-41d4-a716-446655440000"}}';
            const record = TaraRecord.fromJSON(json);
            expect(record.getId()).toBe('550e8400-e29b-41d4-a716-446655440000');
            expect(record.getContent().foo).toBe('bar');
        });

        it('validates records', () => {
            const valid = { foo: 'bar', __tara: { id: '550e8400-e29b-41d4-a716-446655440000' } };
            expect(TaraRecord.isValid(valid)).toBe(true);
        });

        it('rejects invalid records', () => {
            expect(TaraRecord.isValid({ foo: 'bar' })).toBe(false);
            expect(TaraRecord.isValid(null)).toBe(false);
            expect(TaraRecord.isValid('string')).toBe(false);
            expect(TaraRecord.isValid({ __tara: { id: 'invalid' } })).toBe(false);
        });

        it('throws on invalid ID', () => {
            expect(() => {
                new TaraRecord({}, 'invalid-id');
            }).toThrow('Invalid record: invalid UUID v4 format for id');
        });

        it('throws on fromObject with invalid record', () => {
            expect(() => {
                TaraRecord.fromObject({ foo: 'bar' });
            }).toThrow('Invalid record: missing or invalid __tara.id');
        });

        it('throws on fromJSON with invalid JSON', () => {
            expect(() => {
                TaraRecord.fromJSON('invalid json');
            }).toThrow('Failed to parse JSON');
        });

        it('caches serialization', () => {
            const record = new TaraRecord({ foo: 'bar' });
            const str1 = record.toString();
            const str2 = record.toString();
            expect(str1).toBe(str2);
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
});
