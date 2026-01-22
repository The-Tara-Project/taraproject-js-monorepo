import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TaraStack } from '../src/tara-project';
import { setupTestEnv, teardownTestEnv } from './utils';

describe('TaraStack Scopes', () => {
  beforeEach(setupTestEnv);
  afterEach(teardownTestEnv);

  describe('Global Scope', () => {
    it('should provide access to global managers', () => {
      const tara = new TaraStack();

      expect(tara.global).toBeDefined();
      expect(tara.global.tapes).toBeDefined();
      expect(tara.global.apps).toBeDefined();
      expect(tara.global.records).toBeDefined();
      expect(tara.global.settings).toBeDefined();
      expect(tara.global.home).toBeDefined();
    });

    it('should work with existing global operations', () => {
      const tara = new TaraStack();

      const tape = tara.global.tapes.create('test-tape');
      expect(tape.getTapeId()).toBe('test-tape');
      expect(tara.global.tapes.exists('test-tape')).toBe(true);
    });
  });

  describe('Local Scope', () => {
    it('should provide access to local managers', () => {
      const tara = new TaraStack();

      expect(tara.local).toBeDefined();
      expect(tara.local.tapes).toBeDefined();
      expect(tara.local.apps).toBeDefined();
      expect(tara.local.records).toBeDefined();
      expect(tara.local.settings).toBeDefined();
      expect(tara.local.home).toBeDefined();
    });

    it('should use process.cwd() as default working directory', () => {
      const tara = new TaraStack();

      expect(tara.local.getWorkingDir()).toBe(process.cwd());
    });

    it('should accept custom working directory', () => {
      const customDir = '/tmp/my-project';
      const tara = new TaraStack({ workingDir: customDir });

      expect(tara.local.getWorkingDir()).toBe(customDir);
    });

    it('should throw not-implemented errors for unfinished features', () => {
      const tara = new TaraStack();

      expect(() => tara.local.tapes.create('test')).toThrow('not yet implemented');
      expect(() => tara.local.apps.create('test')).toThrow('not yet implemented');
    });

    it('should return empty lists for local resources', () => {
      const tara = new TaraStack();

      expect(tara.local.tapes.list()).toEqual([]);
      expect(tara.local.apps.list()).toEqual([]);
    });
  });

  describe('Scope Requirement', () => {
    it('should require explicit scope access', () => {
      const tara = new TaraStack();

      // Direct access doesn't exist
      expect((tara as any).tapes).toBeUndefined();
      expect((tara as any).apps).toBeUndefined();

      // Must use scopes
      expect(tara.global.tapes).toBeDefined();
      expect(tara.local.tapes).toBeDefined();
    });
  });
});
