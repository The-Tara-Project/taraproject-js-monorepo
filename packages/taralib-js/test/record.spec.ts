import { describe, expect, it } from 'vitest';
import { RecordHandler } from '../src';
import { isValidUuid4 } from '../src/base/utils';

describe('record', () => {

    describe('RecordHandler', () => {
        it('creates record with __tararecord.id', () => {
            const record = new RecordHandler({ content: {} });
            const obj = record.toObject();
            expect(obj.__tararecord).toBeDefined();
            expect(obj.__tararecord.id).toBeDefined();
            expect(isValidUuid4(obj.__tararecord.id)).toBe(true);
        });

        it('preserves content in record', () => {
            const record = new RecordHandler({ content: { foo: 'bar', count: 42 } });
            const obj = record.toObject();
            expect(obj.foo).toBe('bar');
            expect(obj.count).toBe(42);
            expect(obj.__tararecord.id).toBeDefined();
        });

        it('generates unique ids', () => {
            const r1 = new RecordHandler({ content: {} });
            const r2 = new RecordHandler({ content: {} });
            expect(r1.getId()).not.toBe(r2.getId());
        });

        it('provides access to content', () => {
            const record = new RecordHandler({ content: { foo: 'bar' } });
            const content = record.getContent();
            expect(content.foo).toBe('bar');
        });

        it('serializes to JSON', () => {
            const record = new RecordHandler({ content: { foo: 'bar' } });
            const json = record.toString();
            const parsed = JSON.parse(json);
            expect(parsed.foo).toBe('bar');
            expect(parsed.__tararecord).toBeDefined();
            expect(parsed.__tararecord.id).toBeDefined();
        });

        it('creates from plain object', () => {
            const obj = {
                foo: 'bar',
                __tararecord: { id: '550e8400-e29b-41d4-a716-446655440000' }
            };
            const record = RecordHandler.fromObject(obj);
            expect(record.getId()).toBe('550e8400-e29b-41d4-a716-446655440000');
            expect(record.getContent().foo).toBe('bar');
        });

        it('parses from JSON', () => {
            const json = '{"foo":"bar","__tararecord":{"id":"550e8400-e29b-41d4-a716-446655440000"}}';
            const record = RecordHandler.fromJSON(json);
            expect(record.getId()).toBe('550e8400-e29b-41d4-a716-446655440000');
            expect(record.getContent().foo).toBe('bar');
        });

        it('validates records', () => {
            const valid = { foo: 'bar', __tararecord: { id: '550e8400-e29b-41d4-a716-446655440000' } };
            expect(RecordHandler.isValid(valid)).toBe(true);
        });

        it('rejects invalid records', () => {
            expect(RecordHandler.isValid({ foo: 'bar' })).toBe(false);
            expect(RecordHandler.isValid(null)).toBe(false);
            expect(RecordHandler.isValid('string')).toBe(false);
            expect(RecordHandler.isValid({ __tararecord: { id: 'invalid' } })).toBe(false);
        });

        it('throws on invalid ID', () => {
            expect(() => {
                new RecordHandler({ content: {}, __tararecord: { id: 'invalid-id' } });
            }).toThrow('Invalid record: invalid UUID v4 format for id');
        });

        it('throws on fromObject with invalid record', () => {
            expect(() => {
                RecordHandler.fromObject({ foo: 'bar' });
            }).toThrow('Invalid record: missing or invalid __tararecord.id');
        });

        it('throws on fromJSON with invalid JSON', () => {
            expect(() => {
                RecordHandler.fromJSON('invalid json');
            }).toThrow('Failed to parse JSON');
        });

        it('caches serialization', () => {
            const record = new RecordHandler({ content: { foo: 'bar' } });
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
