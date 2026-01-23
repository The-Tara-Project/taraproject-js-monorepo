import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TaraStack } from '../src';
import { setupTestEnv, teardownTestEnv } from './utils';

describe('TaraStack Scopes', () => {
    let tara: TaraStack;

    beforeEach(() => {
        // setup env
        tara = setupTestEnv();
    });

    afterEach(() => {
        // clear env
        teardownTestEnv(tara);
    });

    describe('Global Scope', () => {
        it('should provide access to global managers', () => {

            expect(tara.global).toBeDefined();
            expect(tara.global.tapes).toBeDefined();
            expect(tara.global.apps).toBeDefined();
            expect(tara.global.home).toBeDefined();
        });

        it('should work with existing global operations', () => {

            const tape = tara.global.tapes.get('test-tape');
            tape.instantiate();
            expect(tape.getTapeId()).toBe('test-tape');
            expect(tara.global.tapes.exists('test-tape')).toBe(true);
        });
    });

    describe('Local Scope', () => {
        // #AGENTS/NOTE
        // DO NOT IMPLEMENT YET
        // LEFT BLANK FOR FUTURE EXPANSION        
    });

    describe('Scope Requirement', () => {
        it('should require explicit scope access', () => {

            // Direct access doesn't exist
            expect((tara as any).tapes).toBeUndefined();
            expect((tara as any).apps).toBeUndefined();

            // Must use scopes
            expect(tara.global.tapes).toBeDefined();
        });
    });

    describe('Settings at Stack Level', () => {
        it('should provide settings at stack level, not in scopes', () => {

            // Settings are at stack level
            expect(tara.settings).toBeDefined();
        });
    });
});
