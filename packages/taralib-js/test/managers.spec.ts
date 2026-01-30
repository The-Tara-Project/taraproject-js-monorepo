import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RecordHandler, TaraStack } from '../src';
import { setupTestEnv, teardownTestEnv } from './utils';

describe('GTapeManager', () => {
    let tara: TaraStack;

    beforeEach(() => {
        tara = setupTestEnv();
    });

    afterEach(() => {
        teardownTestEnv(tara);
    });

    it('lists and manages tapes', () => {
        expect(tara.global.tapes.list()).toEqual([]);

        const tape1 = tara.global.tapes.get('tape-1');
        tape1.instantiate();
        expect(tape1.getTapeId()).toBe('tape-1');
        expect(tara.global.tapes.exists('tape-1')).toBe(true);

        const tape2 = tara.global.tapes.get('tape-2');
        tape2.instantiate();

        const tapes = tara.global.tapes.list();
        expect(tapes).toContain('tape-1');
        expect(tapes).toContain('tape-2');

        tara.global.tapes.delete('tape-1');
        expect(tara.global.tapes.exists('tape-1')).toBe(false);
    });

    it('creates new handler instances for same tape', () => {
        const tape = tara.global.tapes.get('test-tape');
        tape.instantiate();

        const handler1 = tara.global.tapes.get('test-tape');
        const handler2 = tara.global.tapes.get('test-tape');

        expect(handler1).not.toBe(handler2);
        expect(handler1.getTapeId()).toBe(handler2.getTapeId());
    });
});

describe('RecordHandler', () => {
    it('creates records with immutable content', () => {
        const record = new RecordHandler({ content: { foo: 'bar', value: 42 } });

        expect(record.getId()).toMatch(/^[0-9a-f-]{36}$/);
        expect(record.getContent().foo).toBe('bar');
        expect(record.getContent().value).toBe(42);
    });

    it('serializes and deserializes records', () => {
        const original = new RecordHandler({ content: { test: 123 } });
        const json = original.toString();

        const fromJson = RecordHandler.fromJSON(json);
        expect(fromJson.getId()).toBe(original.getId());
        expect(fromJson.getContent().test).toBe(123);

        const obj = original.toObject();
        const fromObj = RecordHandler.fromObject(obj);
        expect(fromObj.getId()).toBe(original.getId());
    });

    it('validates record structure', () => {
        const record = new RecordHandler({ content: { data: 'test' } });
        const obj = record.toObject();

        expect(RecordHandler.isValid(obj)).toBe(true);
        expect(RecordHandler.isValid({ invalid: 'object' })).toBe(false);
    });
});

describe('SettingsManager', () => {
    let tara: TaraStack;

    beforeEach(() => {
        tara = setupTestEnv();
    });

    afterEach(() => {
        teardownTestEnv(tara);
    });

    it('manages settings with defaults', () => {
        expect(tara.settings.isLoaded()).toBe(true);
        const value = tara.settings.getSetting('nonexistent', 'default-value');
        expect(value).toBe('default-value');
        expect(() => tara.settings.refresh()).not.toThrow();
    });
});

describe('HomeManager', () => {
    let tara: TaraStack;

    beforeEach(() => {
        tara = setupTestEnv();
    });

    afterEach(() => {
        teardownTestEnv(tara);
    });

    it('manages home directory paths', () => {
        const homePath = tara.global.home.getHomePath();
        expect(typeof homePath).toBe('string');
        expect(homePath.length).toBeGreaterThan(0);

        expect(tara.global.home.getTapesPath()).toContain('tapes');
        expect(tara.global.home.getAppsPath()).toContain('apps');
        expect(tara.global.home.getHomePath('custom')).toContain('custom');
        expect(() => tara.global.home.instantiate()).not.toThrow();
    });

    it('respects taraHome option', () => {
        const customPath = '/tmp/custom-tara-test';
        const taraWithCustomHome = new TaraStack({ writer: 'test', taraHome: customPath });
        expect(taraWithCustomHome.global.home.getHomePath()).toBe(customPath);
    });
});
