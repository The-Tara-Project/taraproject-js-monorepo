import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ITaraRecord } from '../src';
import {
    TaraRecord,
    TapeHandler,
    buildGlobalTapePath
} from '../src';
import { setupTestEnv, teardownTestEnv } from './utils';

describe('integration: create -> store -> read -> check', () => {

    beforeEach(() => {
        // setup env
        setupTestEnv();
    });

    afterEach(() => {
        // clear env
        teardownTestEnv();
    });

    const testTapeId = `integration-test-${Date.now()}`;

    it('full workflow: create tape, add record, read back, verify content', async () => {
        // 1. Create a new tape
        const tape = new TapeHandler(
            testTapeId,
            buildGlobalTapePath(testTapeId)
        );
        tape.fileHandler.instantiate();
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
        const record = new TaraRecord(testContent);

        // 3. Append record to tape
        tape.fileHandler.appendRecord(record);

        // 4. Read and verify metadata
        const metadata = await tape.fileHandler.readMetadata();
        expect(metadata.tapeId).toBe(testTapeId);
        expect(metadata.formatVersion).toBe('1.0.0');
        expect(metadata.createdAt).toBeDefined();

        // 5. Read and verify records
        const records: ITaraRecord[] = [];
        await tape.fileHandler.readRecords(({ parsed }) => {
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

    it.skip('supports multiple records in sequence', async () => {
        const tape = new TapeHandler(
            testTapeId,
            buildGlobalTapePath(testTapeId)
        );
        tape.fileHandler.instantiate();

        // Add multiple records
        const records = [
            new TaraRecord({ index: 0, data: 'first' }),
            new TaraRecord({ index: 1, data: 'second' }),
            new TaraRecord({ index: 2, data: 'third' }),
        ];

        for (const record of records) {
            tape.fileHandler.appendRecord(record);
        }

        // Read and verify
        const readRecords: ITaraRecord[] = [];
        await tape.fileHandler.readRecords(({ parsed }) => {
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
