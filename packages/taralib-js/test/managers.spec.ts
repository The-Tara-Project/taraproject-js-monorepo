import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TaraStack } from '../src/tara-project';
import { setupTestEnv, teardownTestEnv } from './utils';

describe('TapeManager', () => {
  let tara: TaraStack;

  beforeEach(() => {
    setupTestEnv();
    tara = new TaraStack();
  });

  afterEach(teardownTestEnv);

  it('should list tapes (empty initially)', () => {
    const tapes = tara.global.tapes.list();
    expect(tapes).toEqual([]);
  });

  it('should create new tape with metadata', () => {
    const tape = tara.global.tapes.create('test-tape');

    expect(tape).toBeDefined();
    expect(tape.getTapeId()).toBe('test-tape');
    expect(tara.global.tapes.exists('test-tape')).toBe(true);
  });

  it('should get fresh handler instances', () => {
    tara.global.tapes.create('test-tape');

    const handler1 = tara.global.tapes.get('test-tape');
    const handler2 = tara.global.tapes.get('test-tape');

    expect(handler1).not.toBe(handler2); // Different instances
    expect(handler1.getTapeId()).toBe(handler2.getTapeId());
  });

  it('should delete tapes', () => {
    tara.global.tapes.create('test-tape');
    expect(tara.global.tapes.exists('test-tape')).toBe(true);

    tara.global.tapes.delete('test-tape');
    expect(tara.global.tapes.exists('test-tape')).toBe(false);
  });

  it('should throw error when creating duplicate tape', () => {
    tara.global.tapes.create('test-tape');

    expect(() => tara.global.tapes.create('test-tape')).toThrow('already exists');
  });

  it('should list created tapes', () => {
    tara.global.tapes.create('tape-1');
    tara.global.tapes.create('tape-2');

    const tapes = tara.global.tapes.list();
    expect(tapes).toContain('tape-1');
    expect(tapes).toContain('tape-2');
    expect(tapes.length).toBe(2);
  });
});

describe('AppManager', () => {
  let tara: TaraStack;

  beforeEach(() => {
    setupTestEnv();
    tara = new TaraStack();
  });

  afterEach(teardownTestEnv);

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

describe('QuestionManager', () => {
  let tara: TaraStack;

  beforeEach(() => {
    setupTestEnv();
    tara = new TaraStack();
  });

  afterEach(teardownTestEnv);

  it('should save and load questions', () => {
    const app = tara.global.apps.create('test-app');
    const question = {
      question: 'What is your favorite color?',
      prompt: 'Choose a color',
    };

    app.questions.save('color', question);

    const files = app.questions.list();
    expect(files.length).toBeGreaterThan(0);
  });

  it('should delete questions', () => {
    const app = tara.global.apps.create('test-app');
    const question = {
      question: 'What is your favorite color?',
    };

    app.questions.save('color', question);
    const filesBefore = app.questions.list();
    expect(filesBefore.length).toBe(1);

    app.questions.delete('color.json');
    const filesAfter = app.questions.list();
    expect(filesAfter.length).toBe(0);
  });
});

describe('RecordManager', () => {
  let tara: TaraStack;

  beforeEach(() => {
    setupTestEnv();
    tara = new TaraStack();
  });

  afterEach(teardownTestEnv);

  it('should create records with UUIDs', () => {
    const record = tara.global.records.create({ foo: 'bar' });

    expect(record.getId()).toMatch(/^[0-9a-f-]{36}$/);
    expect(record.getContent().foo).toBe('bar');
  });

  it('should parse records from JSON', () => {
    const original = tara.global.records.create({ test: 123 });
    const json = original.toString();

    const parsed = tara.global.records.fromJSON(json);
    expect(parsed.getId()).toBe(original.getId());
    expect(parsed.getContent().test).toBe(123);
  });

  it('should validate records', () => {
    const record = tara.global.records.create({ data: 'test' });
    const obj = record.toObject();

    expect(tara.global.records.validate(obj)).toBe(true);
    expect(tara.global.records.validate({ invalid: 'object' })).toBe(false);
  });

  it('should parse records from objects', () => {
    const original = tara.global.records.create({ value: 42 });
    const obj = original.toObject();

    const parsed = tara.global.records.fromObject(obj);
    expect(parsed.getId()).toBe(original.getId());
    expect(parsed.getContent().value).toBe(42);
  });
});

describe('SettingsManager', () => {
  let tara: TaraStack;

  beforeEach(() => {
    setupTestEnv();
    tara = new TaraStack();
  });

  afterEach(teardownTestEnv);

  it('should check if settings are loaded', () => {
    expect(tara.global.settings.isLoaded()).toBe(true);
  });

  it('should get settings with default', () => {
    const value = tara.global.settings.get('nonexistent', 'default-value');
    expect(value).toBe('default-value');
  });

  it('should refresh settings', () => {
    expect(() => tara.global.settings.refresh()).not.toThrow();
  });
});

describe('HomeHandler (via TaraStack)', () => {
  let tara: TaraStack;

  beforeEach(() => {
    setupTestEnv();
    tara = new TaraStack();
  });

  afterEach(teardownTestEnv);

  it('should get home path', () => {
    const homePath = tara.global.home.getPath();
    expect(typeof homePath).toBe('string');
    expect(homePath.length).toBeGreaterThan(0);
  });

  it('should get tapes path', () => {
    const tapesPath = tara.global.home.getTapesPath();
    expect(tapesPath).toContain('tapes');
  });

  it('should get apps path', () => {
    const appsPath = tara.global.home.getAppsPath();
    expect(appsPath).toContain('apps');
  });

  it('should get sub path', () => {
    const subPath = tara.global.home.getSubPath('custom');
    expect(subPath).toContain('custom');
  });

  it('should ensure home directory', () => {
    expect(() => tara.global.home.ensure()).not.toThrow();
  });

  it('should use settings from TaraStack context', () => {
    const customPath = '/tmp/custom-tara-test';
    const taraWithCustomHome = new TaraStack({ taraHome: customPath });
    const homePath = taraWithCustomHome.global.home.getPath();
    expect(homePath).toBe(customPath);
  });
});
