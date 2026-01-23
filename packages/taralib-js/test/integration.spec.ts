import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ITaraRecord } from '../src';
import {
    RecordHandler,
    TaraStack,
} from '../src';
import { setupTestEnv, teardownTestEnv } from './utils';

describe('integration: create -> store -> read -> check', () => {

    let tara: TaraStack;
    let testTapeId: string;

    beforeEach(() => {
        // setup env with specific writer
        tara = setupTestEnv({ writer: 'integration-test' });
        testTapeId = `integration-test-${Date.now()}`;
    });

    afterEach(() => {
        // clear env
        teardownTestEnv(tara);
    });

    it('full workflow: create tape, add record, read back, verify content', async () => {
        // 1. Create a new tape
        const tape = tara.global.tapes.get(testTapeId);
        tape.instantiate();
        const tapePath = tape.getPath();
        expect(tapePath).toContain(testTapeId);

        // 2. Create a record with test content
        const testContent = {
            message: 'Hello, Tara!',
            timestamp: new Date().toISOString(),
            nested: {
                value: 42,
                tags: ['test', 'integration'],
            },
        };
        const record = new RecordHandler(testContent);

        // 3. Append record to tape
        tape.appendRecord(record);

        // 4. Read and verify metadata
        const metadata = await tape.readMetadata();
        expect(metadata.__taratape.name).toBe(testTapeId);
        expect(metadata.__taratape.formatVersion).toBe('0.0.1');
        expect(metadata.__taratape.createdAt).toBeDefined();
        expect(metadata.__taratape.writer).toBe('integration-test');

        // 5. Read and verify records
        const records: ITaraRecord[] = [];
        await tape.readRecords(({ parsed }) => {
            records.push(parsed);
        });

        // First record is metadata, skip it and get the data record
        expect(records.length).toBe(2);
        const retrievedRecord = records[1];

        expect(retrievedRecord.message).toBe(testContent.message);
        expect(retrievedRecord.timestamp).toBe(testContent.timestamp);
        expect(retrievedRecord.nested).toEqual(testContent.nested);

        // Verify __tararecord.id is preserved
        expect(retrievedRecord.__tararecord.id).toBe(record.__tararecord.id);
    });

    it.skip('supports multiple records in sequence', async () => {
        const tape = tara.global.tapes.get(testTapeId);
        tape.instantiate();

        // Add multiple records
        const records = [
            new RecordHandler({ index: 0, data: 'first' }),
            new RecordHandler({ index: 1, data: 'second' }),
            new RecordHandler({ index: 2, data: 'third' }),
        ];

        for (const record of records) {
            tape.appendRecord(record);
        }

        // Read and verify
        const readRecords: ITaraRecord[] = [];
        await tape.readRecords(({ parsed }) => {
            readRecords.push(parsed);
        });

        // First record is metadata, skip it
        expect(readRecords.length).toBe(4);
        const dataRecords = readRecords.slice(1);

        for (let i = 0; i < records.length; i++) {
            expect(dataRecords[i].index).toBe(i);
            expect(dataRecords[i].__tararecord.id).toBe(records[i].__tararecord.id);
        }
    });
});
