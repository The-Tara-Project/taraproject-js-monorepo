import { describe, it, expect, afterEach } from 'vitest';
import {
    createRecord,
    appendRecord,
    deleteTape,
    createTapeHandler,
    getTapePath,
    instantiateTape,
    readTapeMetadata,
    readTapeRecords,
    type TaraRecord,
} from '../src';

describe('integration: create -> store -> read -> check', () => {
    const testTapeId = `integration-test-${Date.now()}`;

    afterEach(() => {
        try {
            const tape = createTapeHandler(testTapeId);
            deleteTape(tape);
        } catch {
            // ignore cleanup errors
        }
    });

    it('full workflow: create tape, add record, read back, verify content', async () => {
        // 1. Create a new tape
        const tape = createTapeHandler(testTapeId);
        instantiateTape(tape);
        const tapePath = getTapePath(tape);
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
        const record = createRecord(testContent);

        // 3. Append record to tape
        appendRecord(tape, record);

        // 4. Read and verify metadata
        const metadata = await readTapeMetadata(tape);
        expect(metadata.tapeId).toBe(testTapeId);
        expect(metadata.formatVersion).toBe('1.0.0');
        expect(metadata.createdAt).toBeDefined();

        // 5. Read and verify records
        const records: TaraRecord[] = [];
        await readTapeRecords(tape, ({ parsed }) => {
            records.push(parsed);
        });

        // First record is metadata, skip it and get the data record
        expect(records.length).toBe(2);
        const retrievedRecord = records[1];

        expect(retrievedRecord.message).toBe(testContent.message);
        expect(retrievedRecord.timestamp).toBe(testContent.timestamp);
        expect(retrievedRecord.nested).toEqual(testContent.nested);

        // Verify __tara.id is preserved
        expect(retrievedRecord.__tara.id).toBe(record.__tara.id);
    });

    it('supports multiple records in sequence', async () => {
        const tape = createTapeHandler(testTapeId);
        instantiateTape(tape);

        // Add multiple records
        const records = [
            createRecord({ index: 0, data: 'first' }),
            createRecord({ index: 1, data: 'second' }),
            createRecord({ index: 2, data: 'third' }),
        ];

        for (const record of records) {
            appendRecord(tape, record);
        }

        // Read and verify
        const readRecords: TaraRecord[] = [];
        await readTapeRecords(tape, ({ parsed }) => {
            readRecords.push(parsed);
        });

        // First record is metadata, skip it
        expect(readRecords.length).toBe(4);
        const dataRecords = readRecords.slice(1);

        for (let i = 0; i < records.length; i++) {
            expect(dataRecords[i].index).toBe(i);
            expect(dataRecords[i].__tara.id).toBe(records[i].__tara.id);
        }
    });
});
