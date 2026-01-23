import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TaraStack, RecordHandler } from '../src';
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

describe('AppManager', () => {
    let tara: TaraStack;

    beforeEach(() => {
        tara = setupTestEnv();
    });

    afterEach(() => {
        // clear env
        teardownTestEnv(tara);
    });

    it('should create app with questions folder', () => {
        const app = tara.global.apps.create('test-app');

        expect(app.name).toBe('test-app');
        expect(app.exists()).toBe(true);
        expect(tara.global.apps.exists('test-app')).toBe(true);
    });

    it('should access questions manager', () => {
        const app = tara.global.apps.create('test-app');

        const questions = app.questions.list();
        expect(Array.isArray(questions)).toBe(true);
    });

    it('should list apps', () => {
        tara.global.apps.create('app-1');
        tara.global.apps.create('app-2');

        const apps = tara.global.apps.list();
        expect(apps).toContain('app-1');
        expect(apps).toContain('app-2');
        expect(apps.length).toBe(2);
    });

    it('should get app without creating', () => {
        const app = tara.global.apps.get('non-existent-app');

        expect(app.name).toBe('non-existent-app');
        expect(app.exists()).toBe(false);
    });

    it('should delete app', () => {
        const app = tara.global.apps.create('delete-test-app');
        expect(app.exists()).toBe(true);

        app.delete();
        expect(app.exists()).toBe(false);
    });
});

describe('RecordHandler', () => {
    it('creates records with immutable content', () => {
        const record = new RecordHandler({ foo: 'bar', value: 42 });

        expect(record.getId()).toMatch(/^[0-9a-f-]{36}$/);
        expect(record.getContent().foo).toBe('bar');
        expect(record.getContent().value).toBe(42);
    });

    it('serializes and deserializes records', () => {
        const original = new RecordHandler({ test: 123 });
        const json = original.toString();

        const fromJson = RecordHandler.fromJSON(json);
        expect(fromJson.getId()).toBe(original.getId());
        expect(fromJson.getContent().test).toBe(123);

        const obj = original.toObject();
        const fromObj = RecordHandler.fromObject(obj);
        expect(fromObj.getId()).toBe(original.getId());
    });

    it('validates record structure', () => {
        const record = new RecordHandler({ data: 'test' });
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
        const homePath = tara.global.home.getPath();
        expect(typeof homePath).toBe('string');
        expect(homePath.length).toBeGreaterThan(0);

        expect(tara.global.home.getTapesPath()).toContain('tapes');
        expect(tara.global.home.getAppsPath()).toContain('apps');
        expect(tara.global.home.getSubPath('custom')).toContain('custom');
        expect(() => tara.global.home.ensure()).not.toThrow();
    });

    it('respects taraHome option', () => {
        const customPath = '/tmp/custom-tara-test';
        const taraWithCustomHome = new TaraStack({ writer: 'test', taraHome: customPath });
        expect(taraWithCustomHome.global.home.getPath()).toBe(customPath);
    });
});
