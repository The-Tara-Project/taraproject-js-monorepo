import * as fs from 'fs';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
    RecordHandler,
    GTapeHandler,
    SettingsHandler,
    HomeHandler,
} from '../src';
import { setupTestEnv, teardownTestEnv } from './utils';

// Helper function to build tape path (replaces deprecated buildTapePath)
function buildTapePath(tapeId: string): string {
    const settings = new SettingsHandler();
    settings.refresh();
    const home = new HomeHandler(settings);
    return path.join(home.getTapesPath(), `${tapeId}.tara.jsonl`);
}

describe('tape', () => {

    let testTapeId: string;
    let tape: GTapeHandler;

    beforeEach(() => {
        // setup env
        setupTestEnv();

        // Create tape after setting TARA_HOME
        testTapeId = `test-tape-${Date.now()}`;
        tape = new GTapeHandler(
            testTapeId,
            buildTapePath(testTapeId)
        );
    });

    afterEach(() => {
        // clear env
        teardownTestEnv()
    });

    describe('getPath', () => {
        it('returns path with .jsonl extension', () => {
            const result = tape.getPath();
            const settings = new SettingsHandler();
            settings.refresh();
            const home = new HomeHandler(settings);
            expect(result).toBe(path.join(home.getTapesPath(), `${testTapeId}.tara.jsonl`));
        });
    });

    describe('appendRecord', () => {
        it('appends single record to tape', () => {
            const _testTapeId = `test-append-${Date.now()}`;
            const testTape = new GTapeHandler(
                _testTapeId,
                buildTapePath(_testTapeId)
            );

            testTape.fileHandler.instantiate();
            const record = new RecordHandler({ data: 'test' });
            testTape.fileHandler.appendRecord(record);

            const content = fs.readFileSync(testTape.getPath(), 'utf-8');
            const lines = content.trim().split('\n');
            expect(lines.length).toBe(2);
            testTape.fileHandler.delete();
        });

        it('appends multiple records in sequence', () => {
            const _testTapeId = `test-multi-${Date.now()}`;
            const testTape = new GTapeHandler(
                _testTapeId,
                buildTapePath(_testTapeId)
            );
            testTape.fileHandler.instantiate();
            const record1 = new RecordHandler({ data: 'first' });
            const record2 = new RecordHandler({ data: 'second' });
            testTape.fileHandler.appendRecord(record1);
            testTape.fileHandler.appendRecord(record2);

            const content = fs.readFileSync(testTape.getPath(), 'utf-8');
            const lines = content.trim().split('\n');
            expect(lines.length).toBe(3);
            testTape.fileHandler.delete();
        });
    });

    describe('exists', () => {
        it('returns false for non-existent tape', () => {
            const _testTapeId = `non-existent-${Date.now()}`;
            const nonExistentTape = new GTapeHandler(
                _testTapeId,
                buildTapePath(_testTapeId)
            );
            expect(nonExistentTape.fileHandler.exists()).toBe(false);
        });

        it('returns true for existing tape', () => {
            const _testTapeId = `exists-test-${Date.now()}`;
            const testTape = new GTapeHandler(
                _testTapeId,
                buildTapePath(_testTapeId)
            );
            testTape.fileHandler.instantiate();
            expect(testTape.fileHandler.exists()).toBe(true);
            testTape.fileHandler.delete();
        });
    });

    describe('delete', () => {
        it('deletes existing tape', () => {
            const _testTapeId = `delete-test-${Date.now()}`;
            const testTape = new GTapeHandler(
                _testTapeId,
                buildTapePath(_testTapeId)
            );
            testTape.fileHandler.instantiate();
            expect(testTape.fileHandler.exists()).toBe(true);
            testTape.fileHandler.delete();
            expect(testTape.fileHandler.exists()).toBe(false);
        });

        it('does not throw for non-existent tape', () => {
            const _testTapeId = `non-existent-delete-${Date.now()}`;
            const nonExistentTape = new GTapeHandler(
                _testTapeId,
                buildTapePath(_testTapeId)
            );
            expect(() => nonExistentTape.fileHandler.delete()).not.toThrow();
        });
    });

    describe('new GTapeHandler', () => {
        it('creates a lightweight tape handler', () => {
            expect(tape.getTapeId()).toBe(testTapeId);
            const settings = new SettingsHandler();
            settings.refresh();
            const home = new HomeHandler(settings);
            expect(tape.getPath()).toBe(path.join(home.getTapesPath(), `${testTapeId}.tara.jsonl`));
        });

        it('does not create file or perform I/O', () => {
            const createdTape = new GTapeHandler(
                testTapeId,
                buildTapePath(testTapeId)
            );
            expect(fs.existsSync(createdTape.getPath())).toBe(false);
        });
    });

    describe('instantiate', () => {
        it('creates tape file if it does not exist', () => {
            expect(fs.existsSync(tape.getPath())).toBe(false);
            tape.fileHandler.instantiate();
            expect(fs.existsSync(tape.getPath())).toBe(true);
        });

        it('is idempotent - does not error if called multiple times', () => {
            tape.fileHandler.instantiate();
            expect(() => tape.fileHandler.instantiate()).not.toThrow();
        });

        it('does not overwrite existing tape', () => {
            tape.fileHandler.instantiate();
            const firstContent = fs.readFileSync(tape.getPath(), 'utf-8');
            tape.fileHandler.instantiate();
            const secondContent = fs.readFileSync(tape.getPath(), 'utf-8');
            expect(firstContent).toBe(secondContent);
        });
    });

    describe('readRecords', () => {
        it('streams records from tape', async () => {
            tape.fileHandler.instantiate();
            const record1 = new RecordHandler({ data: 'test1' });
            const record2 = new RecordHandler({ data: 'test2' });
            tape.fileHandler.appendRecord(record1);
            tape.fileHandler.appendRecord(record2);

            const records: any[] = [];
            await tape.fileHandler.readRecords((record) => {
                records.push(record);
            });

            expect(records.length).toBe(3);
            expect(records[1].parsed.data).toBe('test1');
            expect(records[2].parsed.data).toBe('test2');
        });

        it('stops iteration when callback returns "stop"', async () => {
            const createdTape = new GTapeHandler(
                testTapeId,
                buildTapePath(testTapeId)
            );
            createdTape.fileHandler.instantiate();
            for (let i = 0; i < 10; i++) {
                createdTape.fileHandler.appendRecord(new RecordHandler({ index: i }));
            }

            const records: any[] = [];
            await createdTape.fileHandler.readRecords((record) => {
                records.push(record);
                if (records.length >= 5) {
                    return 'stop';
                }
            });

            expect(records.length).toBe(5);
        });

        it('throws error on corrupted record', async () => {
            const createdTape = new GTapeHandler(
                testTapeId,
                buildTapePath(testTapeId)
            );
            createdTape.fileHandler.instantiate();
            createdTape.fileHandler.appendRecord(new RecordHandler({ data: 'valid' }));
            fs.appendFileSync(createdTape.getPath(), 'invalid json\n', 'utf-8');

            await expect(async () => {
                await createdTape.fileHandler.readRecords(() => { });
            }).rejects.toThrow('Corrupted record');
        });
    });

    describe('appendRecordBatch', () => {
        it('appends multiple records in single operation', () => {
            const createdTape = new GTapeHandler(
                testTapeId,
                buildTapePath(testTapeId)
            );
            createdTape.fileHandler.instantiate();
            const records = [
                new RecordHandler({ data: 'batch1' }),
                new RecordHandler({ data: 'batch2' }),
                new RecordHandler({ data: 'batch3' }),
            ];

            createdTape.fileHandler.appendRecordBatch(records);

            const content = fs.readFileSync(createdTape.getPath(), 'utf-8');
            const lines = content.trim().split('\n');
            expect(lines.length).toBe(4);
        });

        it('appends all records without validation', () => {
            const createdTape = new GTapeHandler(
                testTapeId,
                buildTapePath(testTapeId)
            );
            createdTape.fileHandler.instantiate();
            const records = [
                new RecordHandler({ data: 'valid1' }),
                new RecordHandler({ data: 'valid2' }),
                new RecordHandler({ data: 'valid3' }),
            ];

            createdTape.fileHandler.appendRecordBatch(records);

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
            const createdTape = new GTapeHandler(
                testTapeId,
                buildTapePath(testTapeId)
            );
            createdTape.fileHandler.instantiate();

            const metadata = await createdTape.fileHandler.readMetadata();
            expect(metadata.tapeId).toBe(testTapeId);
            expect(metadata.formatVersion).toBe('1.0.0');
            expect(metadata.createdAt).toBeDefined();
        });

        it('throws error if tape does not exist', async () => {
            const _testTapeId = `non-existent-tape`;
            const createdTape = new GTapeHandler(
                _testTapeId,
                buildTapePath(_testTapeId)
            );
            await expect(createdTape.fileHandler.readMetadata()).rejects.toThrow();
        });
    });

});
