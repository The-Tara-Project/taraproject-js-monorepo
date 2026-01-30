import { describe, it, expect } from 'vitest';
import { TaraStack } from '@jose_pereiro/taralib-js';
import { Contextor } from '../src/stack/contextor';
import type { ContextRequest } from '../src/base/types';
import * as path from 'path';

// Get monorepo root (this test file is inside a git repo)
const MONOREPO_ROOT = path.resolve(__dirname, '../../..');

describe('GitContainerProvider', () => {
    it('lists git-container provider', () => {
        const stack = new TaraStack({ writer: 'test' });
        const contextor = new Contextor(stack);

        const providers = contextor.listProviders();
        expect(providers).toContain('git-container');
    });

    it('gets git-container provider items', () => {
        const stack = new TaraStack({ writer: 'test' });
        const contextor = new Contextor(stack);

        const items = contextor.getProviderItems('git-container');
        expect(items).toContain('repo-user-name');
        expect(items).toContain('repo-user-email');
        expect(items).toContain('repo-remotes');
        expect(items).toContain('repo-first-commits');
        expect(items).toContain('repo-last-commits');
    });

    it('returns error when path is not provided', async () => {
        const stack = new TaraStack({ writer: 'test' });
        const contextor = new Contextor(stack);

        const requests: ContextRequest[] = [
            {
                provider: 'git-container',
                items: ['repo-user-name'],
                options: {},
            },
        ];

        const results = await contextor.collect(requests);

        expect(results).toHaveLength(1);
        expect(results[0].status).toBe('error');
        expect(results[0].failedItems).toEqual(['repo-user-name']);
    });

    it('returns error when path is not inside a git repo', async () => {
        const stack = new TaraStack({ writer: 'test' });
        const contextor = new Contextor(stack);

        const requests: ContextRequest[] = [
            {
                provider: 'git-container',
                items: ['repo-user-name'],
                options: { path: '/tmp' },
            },
        ];

        const results = await contextor.collect(requests);

        expect(results).toHaveLength(1);
        expect(results[0].status).toBe('error');
    });

    it('collects git context from a real git repo', async () => {
        const stack = new TaraStack({ writer: 'test' });
        const contextor = new Contextor(stack);

        const requests: ContextRequest[] = [
            {
                provider: 'git-container',
                items: [
                    'repo-user-name',
                    'repo-user-email',
                    'repo-remotes',
                    'repo-first-commits',
                    'repo-last-commits',
                ],
                options: { path: MONOREPO_ROOT },
            },
        ];

        const results = await contextor.collect(requests);

        expect(results).toHaveLength(1);
        expect(results[0].status).toBe('success');
        expect(results[0].collectedItems).toHaveLength(5);
        expect(results[0].failedItems).toHaveLength(0);

        // Verify liteContext has expected structure
        const ctx = results[0].liteContext;
        
        // User info should be string or null
        expect(typeof ctx['repo-user-name'] === 'string' || ctx['repo-user-name'] === null).toBe(true);
        expect(typeof ctx['repo-user-email'] === 'string' || ctx['repo-user-email'] === null).toBe(true);
        
        // Remotes should be an object
        expect(typeof ctx['repo-remotes']).toBe('object');
        
        // Commits should be arrays of strings (up to 5 each)
        expect(Array.isArray(ctx['repo-first-commits'])).toBe(true);
        expect(Array.isArray(ctx['repo-last-commits'])).toBe(true);
        expect((ctx['repo-first-commits'] as string[]).length).toBeLessThanOrEqual(5);
        expect((ctx['repo-last-commits'] as string[]).length).toBeLessThanOrEqual(5);
    });

    it('returns partial status when some items are invalid', async () => {
        const stack = new TaraStack({ writer: 'test' });
        const contextor = new Contextor(stack);

        const requests: ContextRequest[] = [
            {
                provider: 'git-container',
                items: ['repo-user-name', 'invalid-item'],
                options: { path: MONOREPO_ROOT },
            },
        ];

        const results = await contextor.collect(requests);

        expect(results).toHaveLength(1);
        expect(results[0].status).toBe('partial');
        expect(results[0].collectedItems).toContain('repo-user-name');
        expect(results[0].failedItems).toContain('invalid-item');
    });
});
