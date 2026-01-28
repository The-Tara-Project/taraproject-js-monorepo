import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TaraStack } from '../src/stack/tara-stack';
import { setupTestEnv, teardownTestEnv } from './utils';

describe('TaraStack', () => {
    let tara: TaraStack;

    beforeEach(() => {
        // setup env
        tara = setupTestEnv();
    });

    afterEach(() => {
        // clear env
        teardownTestEnv(tara);
    });

    it('should instantiate without options', () => {
        expect(tara).toBeDefined();
        expect(tara.global).toBeDefined();
        expect(tara.local).toBeDefined();
    });

    it('should provide global and local scopes', () => {

        expect(tara.global).toBeDefined();
        expect(tara.local).toBeDefined();
    });

    it('should NOT provide direct manager access', () => {
        // These should not exist
        expect('tapes' in tara).toBe(false);
        expect('apps' in tara).toBe(false);
    });

    it('should respect taraHome option', () => {
        const customPath = '/tmp/custom-tara-test';
        const tara = new TaraStack({ taraHome: customPath });
        expect(tara.global.home.getHomePath()).toBe(customPath);
    });

    it('should accept custom working directory', () => {
        const customDir = '/tmp/test-project';
        const tara = new TaraStack({ workingDir: customDir });

        expect(tara.local.getWorkingDir()).toBe(customDir);
    });

    it('should access global tapes without errors', () => {
        const tapes = tara.global.tapes.list();
        expect(Array.isArray(tapes)).toBe(true);
    });

    it('should return version number', () => {
        const version = tara.getVersion();
        expect(typeof version).toBe('string');
        expect(version.length).toBeGreaterThan(0);
    });
});
