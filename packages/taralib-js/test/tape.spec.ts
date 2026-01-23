import * as fs from 'fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
    RecordHandler,
    TaraStack,
} from '../src';
import { isValidUuid4 } from '../src/base/utils';
import { setupTestEnv, teardownTestEnv } from './utils';

describe('tape', () => {

    let testTapeId: string;
    let tara: TaraStack;

    beforeEach(() => {
        // setup env
        tara = setupTestEnv();

        // Create tape after setting TARA_HOME
        testTapeId = `test-tape-${Date.now()}`;
    });

    afterEach(() => {
        // clear env
        teardownTestEnv(tara)
    });

    describe('appendRecord', () => {
        it('appends records to tape', () => {
            const _testTapeId = `test-append-${Date.now()}`;
            const testTape = tara.global.tapes.get(_testTapeId);

            testTape.instantiate();
            const record1 = new RecordHandler({ data: 'first' });
            const record2 = new RecordHandler({ data: 'second' });
            testTape.appendRecord(record1);
            testTape.appendRecord(record2);

            const content = fs.readFileSync(testTape.getPath(), 'utf-8');
            const lines = content.trim().split('\n');
            expect(lines.length).toBe(3);
            testTape.delete();
        });
    });

    describe('exists', () => {
        it('reflects file existence', () => {
            const _testTapeId = `exists-test-${Date.now()}`;
            const testTape = tara.global.tapes.get(_testTapeId);
            expect(testTape.exists()).toBe(false);
            testTape.instantiate();
            expect(testTape.exists()).toBe(true);
            testTape.delete();
            expect(testTape.exists()).toBe(false);
        });
    });

    describe('delete', () => {
        it('deletes tape file safely', () => {
            const _testTapeId = `delete-test-${Date.now()}`;
            const testTape = tara.global.tapes.get(_testTapeId);
            testTape.instantiate();
            expect(testTape.exists()).toBe(true);
            expect(() => testTape.delete()).not.toThrow();
            expect(testTape.exists()).toBe(false);

            // Deleting again doesn't throw
            expect(() => testTape.delete()).not.toThrow();
        });
    });

    describe('instantiate', () => {
        it('creates tape file and is idempotent', () => {
            const tape = tara.global.tapes.get(testTapeId);
            expect(fs.existsSync(tape.getPath())).toBe(false);

            tape.instantiate();
            expect(fs.existsSync(tape.getPath())).toBe(true);

            const firstContent = fs.readFileSync(tape.getPath(), 'utf-8');
            tape.instantiate();
            const secondContent = fs.readFileSync(tape.getPath(), 'utf-8');
            expect(firstContent).toBe(secondContent);
        });
    });

    describe('readRecords', () => {
        it('streams records from tape', async () => {
            const tape = tara.global.tapes.get(testTapeId);
            tape.instantiate();
            const record1 = new RecordHandler({ data: 'test1' });
            const record2 = new RecordHandler({ data: 'test2' });
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
            const createdTape = tara.global.tapes.get(testTapeId);
            createdTape.instantiate();
            for (let i = 0; i < 10; i++) {
                createdTape.appendRecord(new RecordHandler({ index: i }));
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
            const createdTape = tara.global.tapes.get(testTapeId);
            createdTape.instantiate();
            createdTape.appendRecord(new RecordHandler({ data: 'valid' }));
            fs.appendFileSync(createdTape.getPath(), 'invalid json\n', 'utf-8');

            await expect(async () => {
                await createdTape.readRecords(() => { });
            }).rejects.toThrow('Corrupted record');
        });
    });

    describe('appendRecordBatch', () => {
        it('appends multiple records in single operation', () => {
            const createdTape = tara.global.tapes.get(testTapeId);
            createdTape.instantiate();
            const records = [
                new RecordHandler({ data: 'batch1' }),
                new RecordHandler({ data: 'batch2' }),
                new RecordHandler({ data: 'batch3' }),
            ];

            createdTape.appendRecordBatch(records);

            const content = fs.readFileSync(createdTape.getPath(), 'utf-8');
            const lines = content.trim().split('\n');
            expect(lines.length).toBe(4);
        });
    });

    describe('readMetadata', () => {
        it('reads metadata from tape (V2 format)', async () => {
            const createdTape = tara.global.tapes.get(testTapeId);
            createdTape.instantiate();

            const metadata = await createdTape.readMetadata();
            expect(metadata.__taratape.name).toBe(testTapeId);
            expect(metadata.__taratape.id).toBeDefined();
            expect(isValidUuid4(metadata.__taratape.id)).toBe(true);
            expect(metadata.__taratape.formatVersion).toBe('0.0.1');
            expect(metadata.__taratape.createdAt).toBeDefined();
            expect(metadata.__taratape.writer).toBe('test-runner');
        });

        it('throws error if tape does not exist', async () => {
            const _testTapeId = `non-existent-tape`;
            const createdTape = tara.global.tapes.get(_testTapeId);
            await expect(createdTape.readMetadata()).rejects.toThrow();
        });
    });

});

