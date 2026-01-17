import * as fs from 'fs';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
    appendRecord,
    appendRecordBatch,
    createRecord,
    createTapeHandler,
    deleteTape,
    getTapePath,
    getTapesFolderPath,
    instantiateTape,
    readTapeMetadata,
    readTapeRecords,
    tapeExists
} from '../src';

describe('tape', () => {
    const testTapeId = `test-tape-${Date.now()}`;
    const tape = createTapeHandler(testTapeId);

    afterEach(() => {
        // Clean up test tape
        try {
            deleteTape(tape);
        } catch {
            // ignore
        }
    });

    describe('getTapePath', () => {
        it('returns path with .jsonl extension', () => {
            const result = getTapePath(tape);
            expect(result).toBe(path.join(getTapesFolderPath(), `${testTapeId}.tara.jsonl`));
        });
    });

    describe('appendRecord', () => {
        it('appends single record to tape', () => {
            const testTape = createTapeHandler(`test-append-${Date.now()}`);
            instantiateTape(testTape);
            const record = createRecord({ data: 'test' });
            appendRecord(testTape, record);

            const content = fs.readFileSync(testTape.path, 'utf-8');
            const lines = content.trim().split('\n');
            expect(lines.length).toBe(2);
            deleteTape(testTape);
        });

        it('appends multiple records in sequence', () => {
            const testTape = createTapeHandler(`test-multi-${Date.now()}`);
            instantiateTape(testTape);
            const record1 = createRecord({ data: 'first' });
            const record2 = createRecord({ data: 'second' });
            appendRecord(testTape, record1);
            appendRecord(testTape, record2);

            const content = fs.readFileSync(testTape.path, 'utf-8');
            const lines = content.trim().split('\n');
            expect(lines.length).toBe(3);
            deleteTape(testTape);
        });
    });

    describe('tapeExists', () => {
        it('returns false for non-existent tape', () => {
            const nonExistentTape = createTapeHandler(`non-existent-${Date.now()}`);
            expect(tapeExists(nonExistentTape)).toBe(false);
        });

        it('returns true for existing tape', () => {
            const testTape = createTapeHandler(`exists-test-${Date.now()}`);
            instantiateTape(testTape);
            expect(tapeExists(testTape)).toBe(true);
            deleteTape(testTape);
        });
    });

    describe('deleteTape', () => {
        it('deletes existing tape', () => {
            const testTape = createTapeHandler(`delete-test-${Date.now()}`);
            instantiateTape(testTape);
            expect(tapeExists(testTape)).toBe(true);
            deleteTape(testTape);
            expect(tapeExists(testTape)).toBe(false);
        });

        it('does not throw for non-existent tape', () => {
            const nonExistentTape = createTapeHandler(`non-existent-delete-${Date.now()}`);
            expect(() => deleteTape(nonExistentTape)).not.toThrow();
        });
    });

    describe('createTapeHandler', () => {
        it('creates a lightweight tape handler', () => {
            expect(tape.tapeId).toBe(testTapeId);
            expect(tape.path).toBe(path.join(getTapesFolderPath(), `${testTapeId}.tara.jsonl`));
        });

        it('does not create file or perform I/O', () => {
            const tape = createTapeHandler(testTapeId);
            expect(fs.existsSync(tape.path)).toBe(false);
        });
    });

    describe('instantiateTape', () => {
        it('creates tape file if it does not exist', () => {
            expect(fs.existsSync(tape.path)).toBe(false);
            instantiateTape(tape);
            expect(fs.existsSync(tape.path)).toBe(true);
        });

        it('is idempotent - does not error if called multiple times', () => {
            instantiateTape(tape);
            expect(() => instantiateTape(tape)).not.toThrow();
        });

        it('does not overwrite existing tape', () => {
            instantiateTape(tape);
            const firstContent = fs.readFileSync(tape.path, 'utf-8');
            instantiateTape(tape);
            const secondContent = fs.readFileSync(tape.path, 'utf-8');
            expect(firstContent).toBe(secondContent);
        });
    });

    describe('readTapeRecords', () => {
        it('streams records from tape', async () => {
            instantiateTape(tape);
            const record1 = createRecord({ data: 'test1' });
            const record2 = createRecord({ data: 'test2' });
            appendRecord(tape, record1);
            appendRecord(tape, record2);

            const records: any[] = [];
            await readTapeRecords(tape, (record) => {
                records.push(record);
            });

            expect(records.length).toBe(3);
            expect(records[1].parsed.data).toBe('test1');
            expect(records[2].parsed.data).toBe('test2');
        });

        it('stops iteration when callback returns "stop"', async () => {
            const tape = createTapeHandler(testTapeId);
            instantiateTape(tape);
            for (let i = 0; i < 10; i++) {
                appendRecord(tape, createRecord({ index: i }));
            }

            const records: any[] = [];
            await readTapeRecords(tape, (record) => {
                records.push(record);
                if (records.length >= 5) {
                    return 'stop';
                }
            });

            expect(records.length).toBe(5);
        });

        it('throws error on corrupted record', async () => {
            const tape = createTapeHandler(testTapeId);
            instantiateTape(tape);
            appendRecord(tape, createRecord({ data: 'valid' }));
            fs.appendFileSync(tape.path, 'invalid json\n', 'utf-8');

            await expect(async () => {
                await readTapeRecords(tape, () => {});
            }).rejects.toThrow('Corrupted record');
        });
    });

    describe('appendRecordBatch', () => {
        it('appends multiple records in single operation', () => {
            const tape = createTapeHandler(testTapeId);
            instantiateTape(tape);
            const records = [
                createRecord({ data: 'batch1' }),
                createRecord({ data: 'batch2' }),
                createRecord({ data: 'batch3' }),
            ];

            appendRecordBatch(tape, records);

            const content = fs.readFileSync(tape.path, 'utf-8');
            const lines = content.trim().split('\n');
            expect(lines.length).toBe(4);
        });

        it('appends all records without validation', () => {
            const tape = createTapeHandler(testTapeId);
            instantiateTape(tape);
            const records = [
                createRecord({ data: 'valid1' }),
                createRecord({ data: 'valid2' }),
                createRecord({ data: 'valid3' }),
            ];

            appendRecordBatch(tape, records);

            const content = fs.readFileSync(tape.path, 'utf-8');
            const lines = content.trim().split('\n');
            expect(lines.length).toBe(4);
            expect(lines[0]).toBeDefined();
            expect(lines[1]).toBeDefined();
            expect(lines[2]).toBeDefined();
            expect(lines[3]).toBeDefined();
        });
    });

    describe('readTapeMetadata', () => {
        it('reads metadata from tape', async () => {
            const tape = createTapeHandler(testTapeId);
            instantiateTape(tape);

            const metadata = await readTapeMetadata(tape);
            expect(metadata.tapeId).toBe(testTapeId);
            expect(metadata.formatVersion).toBe('1.0.0');
            expect(metadata.createdAt).toBeDefined();
        });

        it('throws error if tape does not exist', async () => {
            const tape = createTapeHandler('non-existent-tape');
            await expect(readTapeMetadata(tape)).rejects.toThrow();
        });
    });

    describe('getTapePath with TaraTapeHandler', () => {
        it('returns path from TaraTapeHandler handler', () => {
            const tape = createTapeHandler(testTapeId);
            expect(getTapePath(tape)).toBe(tape.path);
        });
    });

    describe('tapeExists with TaraTapeHandler', () => {
        it('works with TaraTapeHandler handler', () => {
            const tape = createTapeHandler(testTapeId);
            expect(tapeExists(tape)).toBe(false);
            instantiateTape(tape);
            expect(tapeExists(tape)).toBe(true);
        });
    });

    describe('deleteTape with TaraTapeHandler', () => {
        it('works with TaraTapeHandler handler', () => {
            const tape = createTapeHandler(testTapeId);
            instantiateTape(tape);
            expect(tapeExists(tape)).toBe(true);
            deleteTape(tape);
            expect(tapeExists(tape)).toBe(false);
        });
    });
});
