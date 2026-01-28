import { describe, it, expect, beforeEach } from 'vitest';
import { TaraStack } from '../src/stack/tara-stack';
import { setupTestEnv } from './utils';

describe('GTapeHandler - Custom Metadata', () => {
    let tara: TaraStack;
    let testTapeId: string;

    beforeEach(() => {
        tara = setupTestEnv();
        testTapeId = `test-custom-meta-${Date.now()}`;
    });

    it('should allow custom metadata at tape level', async () => {
        const tape = tara.global.tapes.get(testTapeId);

        tape.instantiate({
            metadata: {
                description: 'My custom tape',
                version: '1.0.0',
                tags: ['test', 'demo'],
                nested: { key: 'value' }
            }
        });

        const metadata = await tape.readMetadata();

        // Check internal __taratape metadata
        expect(metadata.__taratape.name).toBe(testTapeId);
        expect(metadata.__taratape.type).toBe('taralib/tape-metadata');
        expect(metadata.__taratape.writer).toBe('test-runner');

        // Check custom metadata at top level
        expect(metadata).toHaveProperty('description', 'My custom tape');
        expect(metadata).toHaveProperty('version', '1.0.0');
        expect(metadata).toHaveProperty('tags');
        expect(metadata.tags).toEqual(['test', 'demo']);
        expect(metadata).toHaveProperty('nested');
        expect((metadata as any).nested.key).toBe('value');
    });

    it('should work without custom metadata', async () => {
        const tape = tara.global.tapes.get(testTapeId);
        tape.instantiate();

        const metadata = await tape.readMetadata();

        // Should have internal fields
        expect(metadata.__taratape.name).toBe(testTapeId);
        expect(metadata.__taratape.type).toBe('taralib/tape-metadata');

        // Should have __tararecord
        expect(metadata.__tararecord).toBeDefined();
        expect(metadata.__tararecord.id).toBeDefined();
    });

    it('should not have top-level type field', async () => {
        const tape = tara.global.tapes.get(testTapeId);
        tape.instantiate({ metadata: { customField: 'value' } });

        const metadata = await tape.readMetadata();

        // Type should be in __taratape, not at top level
        expect(metadata).not.toHaveProperty('type');
        expect(metadata.__taratape.type).toBe('taralib/tape-metadata');
    });
});
