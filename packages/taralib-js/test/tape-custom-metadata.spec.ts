import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestEnv } from './utils';
import { TaraStack, RecordHandler } from '../src';

describe('TapeHandler - Custom Metadata', () => {
    let tara: TaraStack;
    let testTapeId: string;

    beforeEach(() => {
        tara = setupTestEnv();
        testTapeId = `test-custom-meta-${Date.now()}`;
    });

    it('should allow custom metadata at tape level', async () => {
        const tape = tara.global.tapes.get(testTapeId);
        const customMetadata = {
            description: 'A test tape',
            version: '1.0.0',
            tags: ['test', 'demo'],
            nested: { key: 'value' }
        };

        tape.instantiate({ metadata: customMetadata });
        const metadata = await tape.readMetadata();

        // Assert that the custom metadata is present
        expect(metadata).toHaveProperty('description', customMetadata.description);
        expect(metadata).toHaveProperty('version', customMetadata.version);
        expect(metadata).toHaveProperty('tags');
        expect(metadata.tags).toEqual(customMetadata.tags);
        expect(metadata).toHaveProperty('nested');
        expect(metadata).toMatchObject({ nested: { key: 'value' } });
    });

    it('should work without custom metadata', async () => {
        const tape = tara.global.tapes.get(testTapeId);
        tape.instantiate();

        // Assert that a valid metadata object is returned
        const metadata = await tape.readMetadata();
        expect(metadata).toBeDefined();
        expect(typeof metadata).toBe('object');

        // Optional: Verify the tape is functional by appending a record
        expect(() => tape.appendRecord(new RecordHandler({ data: 'test' }))).not.toThrow();
    });


});
