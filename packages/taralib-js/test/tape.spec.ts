import * as fs from 'fs';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
    TaraRecord,
    createTapeHandler,
    getTapesFolderPath,
} from '../src';

describe('tape', () => {
    const testTapeId = `test-tape-${Date.now()}`;
    const tape = createTapeHandler(testTapeId);

    afterEach(() => {
        // Clean up test tape
        try {
            tape.delete();
        } catch {
            // ignore
        }
    });

    describe('getPath', () => {
        it('returns path with .jsonl extension', () => {
            const result = tape.getPath();
            expect(result).toBe(path.join(getTapesFolderPath(), `${testTapeId}.tara.jsonl`));
        });
    });

    describe('appendRecord', () => {
        it('appends single record to tape', () => {
            const testTape = createTapeHandler(`test-append-${Date.now()}`);
            testTape.instantiate();
            const record = new TaraRecord({ data: 'test' });
            testTape.appendRecord(record);

            const content = fs.readFileSync(testTape.getPath(), 'utf-8');
            const lines = content.trim().split('\n');
            expect(lines.length).toBe(2);
            testTape.delete();
        });

        it('appends multiple records in sequence', () => {
            const testTape = createTapeHandler(`test-multi-${Date.now()}`);
            testTape.instantiate();
            const record1 = new TaraRecord({ data: 'first' });
            const record2 = new TaraRecord({ data: 'second' });
            testTape.appendRecord(record1);
            testTape.appendRecord(record2);

            const content = fs.readFileSync(testTape.getPath(), 'utf-8');
            const lines = content.trim().split('\n');
            expect(lines.length).toBe(3);
            testTape.delete();
        });
    });

    describe('exists', () => {
        it('returns false for non-existent tape', () => {
            const nonExistentTape = createTapeHandler(`non-existent-${Date.now()}`);
            expect(nonExistentTape.exists()).toBe(false);
        });

        it('returns true for existing tape', () => {
            const testTape = createTapeHandler(`exists-test-${Date.now()}`);
            testTape.instantiate();
            expect(testTape.exists()).toBe(true);
            testTape.delete();
        });
    });

    describe('delete', () => {
        it('deletes existing tape', () => {
            const testTape = createTapeHandler(`delete-test-${Date.now()}`);
            testTape.instantiate();
            expect(testTape.exists()).toBe(true);
            testTape.delete();
            expect(testTape.exists()).toBe(false);
        });

        it('does not throw for non-existent tape', () => {
            const nonExistentTape = createTapeHandler(`non-existent-delete-${Date.now()}`);
            expect(() => nonExistentTape.delete()).not.toThrow();
        });
    });

    describe('createTapeHandler', () => {
        it('creates a lightweight tape handler', () => {
            expect(tape.getTapeId()).toBe(testTapeId);
            expect(tape.getPath()).toBe(path.join(getTapesFolderPath(), `${testTapeId}.tara.jsonl`));
        });

        it('does not create file or perform I/O', () => {
            const createdTape = createTapeHandler(testTapeId);
            expect(fs.existsSync(createdTape.getPath())).toBe(false);
        });
    });

    describe('instantiate', () => {
        it('creates tape file if it does not exist', () => {
            expect(fs.existsSync(tape.getPath())).toBe(false);
            tape.instantiate();
            expect(fs.existsSync(tape.getPath())).toBe(true);
        });

        it('is idempotent - does not error if called multiple times', () => {
            tape.instantiate();
            expect(() => tape.instantiate()).not.toThrow();
        });

        it('does not overwrite existing tape', () => {
            tape.instantiate();
            const firstContent = fs.readFileSync(tape.getPath(), 'utf-8');
            tape.instantiate();
            const secondContent = fs.readFileSync(tape.getPath(), 'utf-8');
            expect(firstContent).toBe(secondContent);
        });
    });

    describe('readRecords', () => {
        it('streams records from tape', async () => {
            tape.instantiate();
            const record1 = new TaraRecord({ data: 'test1' });
            const record2 = new TaraRecord({ data: 'test2' });
            tape.appendRecord(record1);
            tape.appendRecord(record2);

            const records: any[] = [];
            await tape.readRecords((record) => {
                records.push(record);
            });

            expect(records.length).toBe(3);
            expect(records[1].parsed.data).toBe('test1');
            expect(records[2].parsed.data).toBe('test2');
        });

        it('stops iteration when callback returns "stop"', async () => {
            const createdTape = createTapeHandler(testTapeId);
            createdTape.instantiate();
            for (let i = 0; i < 10; i++) {
                createdTape.appendRecord(new TaraRecord({ index: i }));
            }

            const records: any[] = [];
            await createdTape.readRecords((record) => {
                records.push(record);
                if (records.length >= 5) {
                    return 'stop';
                }
            });

            expect(records.length).toBe(5);
        });

        it('throws error on corrupted record', async () => {
            const createdTape = createTapeHandler(testTapeId);
            createdTape.instantiate();
            createdTape.appendRecord(new TaraRecord({ data: 'valid' }));
            fs.appendFileSync(createdTape.getPath(), 'invalid json\n', 'utf-8');

            await expect(async () => {
                await createdTape.readRecords(() => {});
            }).rejects.toThrow('Corrupted record');
        });
    });

    describe('appendRecordBatch', () => {
        it('appends multiple records in single operation', () => {
            const createdTape = createTapeHandler(testTapeId);
            createdTape.instantiate();
            const records = [
                new TaraRecord({ data: 'batch1' }),
                new TaraRecord({ data: 'batch2' }),
                new TaraRecord({ data: 'batch3' }),
            ];

            createdTape.appendRecordBatch(records);

            const content = fs.readFileSync(createdTape.getPath(), 'utf-8');
            const lines = content.trim().split('\n');
            expect(lines.length).toBe(4);
        });

        it('appends all records without validation', () => {
            const createdTape = createTapeHandler(testTapeId);
            createdTape.instantiate();
            const records = [
                new TaraRecord({ data: 'valid1' }),
                new TaraRecord({ data: 'valid2' }),
                new TaraRecord({ data: 'valid3' }),
            ];

            createdTape.appendRecordBatch(records);

            const content = fs.readFileSync(createdTape.getPath(), 'utf-8');
            const lines = content.trim().split('\n');
            expect(lines.length).toBe(4);
            expect(lines[0]).toBeDefined();
            expect(lines[1]).toBeDefined();
            expect(lines[2]).toBeDefined();
            expect(lines[3]).toBeDefined();
        });
    });

    describe('readMetadata', () => {
        it('reads metadata from tape', async () => {
            const createdTape = createTapeHandler(testTapeId);
            createdTape.instantiate();

            const metadata = await createdTape.readMetadata();
            expect(metadata.tapeId).toBe(testTapeId);
            expect(metadata.formatVersion).toBe('1.0.0');
            expect(metadata.createdAt).toBeDefined();
        });

        it('throws error if tape does not exist', async () => {
            const createdTape = createTapeHandler('non-existent-tape');
            await expect(createdTape.readMetadata()).rejects.toThrow();
        });
    });

});
