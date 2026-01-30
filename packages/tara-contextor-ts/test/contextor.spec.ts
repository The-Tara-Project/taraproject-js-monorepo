import { describe, it, expect } from 'vitest';
import { TaraStack } from '@jose_pereiro/taralib-js';
import { Contextor } from '../src/stack/contextor';
import type { ContextRequest } from '../src/base/types';

// Mock VSCode API
function createMockVscode(options: {
    openedFiles?: string[];
    focusedFile?: string | null;
    workspaceFolders?: string[];
} = {}) {
    const { openedFiles = [], focusedFile = null, workspaceFolders = [] } = options;

    return {
        window: {
            tabGroups: {
                all: [
                    {
                        tabs: openedFiles.map((path) => ({
                            input: { uri: { fsPath: path } },
                        })),
                    },
                ],
            },
            activeTextEditor: focusedFile
                ? { document: { uri: { fsPath: focusedFile } } }
                : undefined,
        },
        workspace: {
            workspaceFolders: workspaceFolders.map((path) => ({
                uri: { fsPath: path },
            })),
        },
    };
}

describe('Contextor', () => {
    it('lists available providers', () => {
        const stack = new TaraStack({ writer: 'test' });
        const contextor = new Contextor(stack);

        const providers = contextor.listProviders();
        expect(providers).toContain('vscode-session');
    });

    it('gets provider items', () => {
        const stack = new TaraStack({ writer: 'test' });
        const contextor = new Contextor(stack);

        const items = contextor.getProviderItems('vscode-session');
        expect(items).toContain('opened-files-paths');
        expect(items).toContain('focused-file-path');
        expect(items).toContain('workspace-folders-paths');
    });

    it('returns undefined for unknown provider items', () => {
        const stack = new TaraStack({ writer: 'test' });
        const contextor = new Contextor(stack);

        const items = contextor.getProviderItems('unknown-provider');
        expect(items).toBeUndefined();
    });
});

describe('Contextor::collect', () => {
    it('collects vscode session context with mock API', async () => {
        const stack = new TaraStack({ writer: 'test' });
        const contextor = new Contextor(stack);

        const mockVscode = createMockVscode({
            openedFiles: ['/path/to/file1.ts', '/path/to/file2.ts'],
            focusedFile: '/path/to/file1.ts',
            workspaceFolders: ['/workspace/folder'],
        });

        const requests: ContextRequest[] = [
            {
                provider: 'vscode-session',
                items: ['opened-files-paths', 'focused-file-path', 'workspace-folders-paths'],
                options: { vscode: mockVscode },
            },
        ];

        const results = await contextor.collect(requests);

        expect(results).toHaveLength(1);
        expect(results[0].status).toBe('success');
        expect(results[0].collectedItems).toEqual([
            'opened-files-paths',
            'focused-file-path',
            'workspace-folders-paths',
        ]);
        expect(results[0].failedItems).toEqual([]);
        expect(results[0].liteContext['opened-files-paths']).toEqual([
            '/path/to/file1.ts',
            '/path/to/file2.ts',
        ]);
        expect(results[0].liteContext['focused-file-path']).toBe('/path/to/file1.ts');
        expect(results[0].liteContext['workspace-folders-paths']).toEqual(['/workspace/folder']);
    });

    it('returns error status when vscode API is missing', async () => {
        const stack = new TaraStack({ writer: 'test' });
        const contextor = new Contextor(stack);

        const requests: ContextRequest[] = [
            {
                provider: 'vscode-session',
                items: ['opened-files-paths'],
                options: {}, // No vscode API
            },
        ];

        const results = await contextor.collect(requests);

        expect(results).toHaveLength(1);
        expect(results[0].status).toBe('error');
        expect(results[0].collectedItems).toEqual([]);
        expect(results[0].failedItems).toEqual(['opened-files-paths']);
    });

    it('returns error status for unknown provider', async () => {
        const stack = new TaraStack({ writer: 'test' });
        const contextor = new Contextor(stack);

        const requests: ContextRequest[] = [
            {
                provider: 'unknown-provider',
                items: ['some-item'],
            },
        ];

        const results = await contextor.collect(requests);

        expect(results).toHaveLength(1);
        expect(results[0].status).toBe('error');
        expect(results[0].provider).toBe('unknown-provider');
        expect(results[0].failedItems).toEqual(['some-item']);
    });

    it('returns partial status when some items fail', async () => {
        const stack = new TaraStack({ writer: 'test' });
        const contextor = new Contextor(stack);

        const mockVscode = createMockVscode({
            openedFiles: ['/path/to/file.ts'],
        });

        const requests: ContextRequest[] = [
            {
                provider: 'vscode-session',
                items: ['opened-files-paths', 'invalid-item'],
                options: { vscode: mockVscode },
            },
        ];

        const results = await contextor.collect(requests);

        expect(results).toHaveLength(1);
        expect(results[0].status).toBe('partial');
        expect(results[0].collectedItems).toEqual(['opened-files-paths']);
        expect(results[0].failedItems).toEqual(['invalid-item']);
    });

    it('handles null focused file', async () => {
        const stack = new TaraStack({ writer: 'test' });
        const contextor = new Contextor(stack);

        const mockVscode = createMockVscode({
            focusedFile: null,
        });

        const requests: ContextRequest[] = [
            {
                provider: 'vscode-session',
                items: ['focused-file-path'],
                options: { vscode: mockVscode },
            },
        ];

        const results = await contextor.collect(requests);

        expect(results[0].status).toBe('success');
        expect(results[0].liteContext['focused-file-path']).toBeNull();
    });

    it('handles empty workspace folders', async () => {
        const stack = new TaraStack({ writer: 'test' });
        const contextor = new Contextor(stack);

        const mockVscode = {
            window: {
                tabGroups: { all: [] },
                activeTextEditor: undefined,
            },
            workspace: {
                workspaceFolders: undefined,
            },
        };

        const requests: ContextRequest[] = [
            {
                provider: 'vscode-session',
                items: ['workspace-folders-paths'],
                options: { vscode: mockVscode },
            },
        ];

        const results = await contextor.collect(requests);

        expect(results[0].status).toBe('success');
        expect(results[0].liteContext['workspace-folders-paths']).toEqual([]);
    });
});
