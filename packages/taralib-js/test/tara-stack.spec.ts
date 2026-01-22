import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TaraStack } from '../src/stack/tara-stack';
import { setupTestEnv, teardownTestEnv } from './utils';

describe('TaraStack', () => {
  beforeEach(setupTestEnv);
  afterEach(teardownTestEnv);

  it('should instantiate without options', () => {
    const tara = new TaraStack();
    expect(tara).toBeDefined();
    expect(tara.global).toBeDefined();
    expect(tara.local).toBeDefined();
  });

  it('should provide global and local scopes', () => {
    const tara = new TaraStack();

    expect(tara.global).toBeDefined();
    expect(tara.local).toBeDefined();
  });

  it('should NOT provide direct manager access', () => {
    const tara = new TaraStack();

    // These should not exist
    expect((tara as any).tapes).toBeUndefined();
    expect((tara as any).apps).toBeUndefined();
  });

  it('should respect taraHome option', () => {
    const customPath = '/tmp/custom-tara-test';
    const tara = new TaraStack({ taraHome: customPath });

    expect(tara.global.home.getPath()).toBe(customPath);
  });

  it('should accept custom working directory', () => {
    const customDir = '/tmp/test-project';
    const tara = new TaraStack({ workingDir: customDir });

    expect(tara.local.getWorkingDir()).toBe(customDir);
  });

  it('should access global tapes without errors', () => {
    const tara = new TaraStack();
    const tapes = tara.global.tapes.list();

    expect(Array.isArray(tapes)).toBe(true);
  });

  it('should return version number', () => {
    const tara = new TaraStack();
    const version = tara.getVersion();

    expect(typeof version).toBe('string');
    expect(version.length).toBeGreaterThan(0);
  });

  it('should work with debug option', () => {
    const tara = new TaraStack({ debug: true });

    expect(tara).toBeDefined();
    expect(process.env.TARA_DEBUG).toBe('true');
  });
});
