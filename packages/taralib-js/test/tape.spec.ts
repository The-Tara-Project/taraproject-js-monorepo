import * as fs from 'fs';
import * as path from 'path';
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

            const content = fs.readFileSync(testTape.getHomePath(), 'utf-8');
            const lines = content.trim().split('\n');
            expect(lines.length).toBe(3);
            tara.global.tapes.delete(_testTapeId);
        });
    });

    describe('exists', () => {
        it('reflects repo existence', () => {
            const _testTapeId = `exists-test-${Date.now()}`;
            expect(tara.global.tapes.exists(_testTapeId)).toBe(false);

            // get() triggers instantiateRepo, so the repo now exists
            const testTape = tara.global.tapes.get(_testTapeId);
            expect(tara.global.tapes.exists(_testTapeId)).toBe(true);

            // Instantiate the tape file
            testTape.instantiate();
            expect(tara.global.tapes.exists(_testTapeId)).toBe(true);

            // Delete removes the whole repo
            tara.global.tapes.delete(_testTapeId);
            expect(tara.global.tapes.exists(_testTapeId)).toBe(false);
        });
    });

    describe('delete', () => {
        it('deletes tape repo safely', () => {
            const _testTapeId = `delete-test-${Date.now()}`;
            const testTape = tara.global.tapes.get(_testTapeId);
            testTape.instantiate();
            expect(tara.global.tapes.exists(_testTapeId)).toBe(true);
            expect(() => tara.global.tapes.delete(_testTapeId)).not.toThrow();
            expect(tara.global.tapes.exists(_testTapeId)).toBe(false);

            // Deleting again doesn't throw
            expect(() => tara.global.tapes.delete(_testTapeId)).not.toThrow();
        });
    });

    describe('instantiate', () => {
        it('creates tape file inside git repo and is idempotent', () => {
            const tape = tara.global.tapes.get(testTapeId);
            expect(fs.existsSync(tape.getHomePath())).toBe(false);

            tape.instantiate();
            expect(fs.existsSync(tape.getHomePath())).toBe(true);

            // Verify git repo exists
            const repoPath = path.dirname(tape.getHomePath());
            expect(fs.existsSync(path.join(repoPath, '.git'))).toBe(true);

            const firstContent = fs.readFileSync(tape.getHomePath(), 'utf-8');
            tape.instantiate();
            const secondContent = fs.readFileSync(tape.getHomePath(), 'utf-8');
            expect(firstContent).toBe(secondContent);
        });
    });

    describe('list', () => {
        it('returns tape IDs that have git repos', () => {
            const id1 = `list-test-a-${Date.now()}`;
            const id2 = `list-test-b-${Date.now()}`;

            tara.global.tapes.get(id1).instantiate();
            tara.global.tapes.get(id2).instantiate();

            const listed = tara.global.tapes.list();
            expect(listed).toContain(id1);
            expect(listed).toContain(id2);
        });
    });

    describe('listTapeFiles', () => {
        it('returns tape files in a repo', () => {
            const _testTapeId = `files-test-${Date.now()}`;
            tara.global.tapes.get(_testTapeId).instantiate();

            const files = tara.global.tapes.listTapeFiles(_testTapeId);
            expect(files.length).toBe(1);
            expect(files[0]).toMatch(/\.tara\.jsonl$/);
        });
    });

    describe('commitChanges', () => {
        it('commits tape files to git', () => {
            const _testTapeId = `commit-test-${Date.now()}`;
            const tape = tara.global.tapes.get(_testTapeId);
            tape.instantiate();
            tape.appendRecord(new RecordHandler({ data: 'test' }));

            // Should not throw
            expect(() => tara.global.tapes.commitChanges(_testTapeId)).not.toThrow();

            // Calling again with no changes should also not throw
            expect(() => tara.global.tapes.commitChanges(_testTapeId)).not.toThrow();
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
            fs.appendFileSync(createdTape.getHomePath(), 'invalid json\n', 'utf-8');

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

            const content = fs.readFileSync(createdTape.getHomePath(), 'utf-8');
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
