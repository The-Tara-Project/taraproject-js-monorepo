import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { TaraStack } from '../src';
import { GitStResolver, type DescriptorPair } from '../src/stack/global/managers/git-st-resolver';
import { setupTestEnv, teardownTestEnv } from './utils';

describe('GitStResolver', () => {
    let tara: TaraStack;
    let resolver: GitStResolver;
    let testDir: string;

    beforeEach(() => {
        tara = setupTestEnv();
        resolver = new GitStResolver(tara);
        testDir = tara.global.home.getHomePath();
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }
    });

    afterEach(() => {
        teardownTestEnv(tara);
    });

    describe('resolve - new file creation', () => {
        it('creates new storagePath when no descriptors exist', async () => {
            const result = await resolver.resolve({
                originPath: '/test/path/file.txt'
            });

            expect(result.isNew).toBe(true);
            expect(result.storagePath).toBeTruthy();
            expect(result.repoId).toBeTruthy();
            expect(result.repoPath).toBeTruthy();
            expect(result.descriptors).toEqual([['originPath', '/test/path/file.txt']]);
        });

        it('returns descriptors including user descriptors', async () => {
            const originPath = '/test/path/file.txt';
            const userDescriptors: DescriptorPair[] = [
                ['project', 'my-project'],
                ['version', 1]
            ];

            const result = await resolver.resolve({
                originPath,
                descriptors: userDescriptors
            });

            expect(result.descriptors!.length).toBe(3);
            expect(result.descriptors![0]).toEqual(['originPath', originPath]);
            expect(result.descriptors![1]).toEqual(['project', 'my-project']);
            expect(result.descriptors![2]).toEqual(['version', 1]);
        });
    });

    describe('resolve - with written descriptor records', () => {
        // Helper to write a descriptor and instantiate repo
        async function setupDescriptor(originPath: string, descriptors?: DescriptorPair[]) {
            const result = await resolver.resolve({ originPath, descriptors });
            // Instantiate repo so it shows up in listRepoIds
            tara.global.gitst.instantiate(result.repoId);
            // Write the descriptor record
            await resolver.writeDescriptorRecord({
                descriptors: result.descriptors!,
                storagePath: result.storagePath,
                repoId: result.repoId,
                timestamp: new Date().toISOString(),
            });
            return result;
        }

        it('returns existing storagePath when descriptors match', async () => {
            const originPath = '/test/path/file.txt';

            // First call - creates new and writes descriptor
            const first = await setupDescriptor(originPath);
            expect(first.isNew).toBe(true);

            // Second call - should find existing
            const second = await resolver.resolve({ originPath });
            expect(second.isNew).toBe(false);
            expect(second.storagePath).toBe(first.storagePath);
            expect(second.repoId).toBe(first.repoId);
        });

        it('matches on user descriptors', async () => {
            const originPath1 = '/test/path/file1.txt';
            const originPath2 = '/test/path/file2.txt';
            const descriptors: DescriptorPair[] = [['project', 'shared']];

            // Create with descriptors
            const first = await setupDescriptor(originPath1, descriptors);
            expect(first.isNew).toBe(true);

            // Different originPath but same user descriptors should NOT match
            // (because originPath is part of the descriptor vector)
            const second = await resolver.resolve({
                originPath: originPath2,
                descriptors
            });
            expect(second.isNew).toBe(true);
            expect(second.storagePath).not.toBe(first.storagePath);
        });

        it('subset query matches superset record', async () => {
            const originPath = '/test/path/file.txt';

            // Create with specific descriptors
            await setupDescriptor(originPath, [['version', 1], ['env', 'prod']]);

            // Partial match (originPath + version) is subset of stored
            // [originPath, version, env], so it SHOULD match
            const partial = await resolver.resolve({
                originPath,
                descriptors: [['version', 1]]
            });
            expect(partial.isNew).toBe(false);
        });
    });

    describe('resolve - type sensitivity', () => {
        it('treats string "5" and number 5 as different values', async () => {
            // Create with number
            const first = await resolver.resolve({
                originPath: '/test/path/file1.txt',
                descriptors: [['count', 5]]
            });
            
            // Instantiate and write
            tara.global.gitst.instantiate(first.repoId);
            await resolver.writeDescriptorRecord({
                descriptors: first.descriptors!,
                storagePath: first.storagePath,
                repoId: first.repoId,
                timestamp: new Date().toISOString(),
            });

            // Query with string "5" and different originPath - should NOT match
            const second = await resolver.resolve({
                originPath: '/test/path/file2.txt',
                descriptors: [['count', '5']]
            });
            expect(second.isNew).toBe(true);
            expect(second.storagePath).not.toBe(first.storagePath);
        });
    });

    describe('resolveAll - raw matching', () => {
        it('returns all matching records', async () => {
            const originPath = '/test/path/file.txt';
            
            // Create and write descriptor
            const result = await resolver.resolve({ originPath });
            tara.global.gitst.instantiate(result.repoId);
            await resolver.writeDescriptorRecord({
                descriptors: result.descriptors!,
                storagePath: result.storagePath,
                repoId: result.repoId,
                timestamp: new Date().toISOString(),
            });
            
            // Query for matching records
            const matches = await resolver.resolveAll([['originPath', originPath]]);
            expect(matches.length).toBe(1);
            expect(matches[0].descriptors[0]).toEqual(['originPath', originPath]);
        });

        it('returns empty array when no matches', async () => {
            const matches = await resolver.resolveAll([['nonexistent', 'value']]);
            expect(matches).toEqual([]);
        });
    });
});

describe('GitStorageManager with GitStResolver', () => {
    let tara: TaraStack;
    let testFilePath: string;

    beforeEach(() => {
        tara = setupTestEnv();
        const testDir = tara.global.home.getHomePath();
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }
        testFilePath = path.join(testDir, 'test-file.txt');
        fs.writeFileSync(testFilePath, 'test content', 'utf-8');
    });

    afterEach(() => {
        teardownTestEnv(tara);
    });

    describe('commit integration', () => {
        it('commits file using resolver-based assignment', async () => {
            const link = await tara.global.gitst.commitFile(testFilePath);

            expect(link.repoId).toBeTruthy();
            expect(link.storagePath).toBeTruthy();
            expect(link.commitHash).toMatch(/^[0-9a-f]{40}$/);
            expect(link.originalPath).toBe(testFilePath);
        });

        it('commits same file twice to same storagePath', async () => {
            const link1 = await tara.global.gitst.commitFile(testFilePath);
            
            // Modify file
            fs.writeFileSync(testFilePath, 'updated content', 'utf-8');
            
            const link2 = await tara.global.gitst.commitFile(testFilePath);

            expect(link2.storagePath).toBe(link1.storagePath);
            expect(link2.repoId).toBe(link1.repoId);
            expect(link2.commitHash).not.toBe(link1.commitHash); // New commit
        });

        it('commits with custom descriptors', async () => {
            const link = await tara.global.gitst.commitFile(testFilePath, {
                descriptors: [['project', 'test-project']]
            });

            expect(link.repoId).toBeTruthy();
            expect(link.storagePath).toBeTruthy();
        });

        it('descriptor tape is staged and committed', async () => {
            const link = await tara.global.gitst.commitFile(testFilePath);

            // Check that descriptor tape exists in repo
            const descriptorsDir = path.join(link.repoPath, 'descriptors');
            expect(fs.existsSync(descriptorsDir)).toBe(true);

            const files = fs.readdirSync(descriptorsDir);
            expect(files.length).toBeGreaterThan(0);
            expect(files[0]).toMatch(/\.tara\.jsonl$/);
        });
    });

    describe('commitBatch integration', () => {
        it('batches files to same repo based on descriptors', async () => {
            const testDir = tara.global.home.getHomePath();
            const file1 = path.join(testDir, 'file1.txt');
            const file2 = path.join(testDir, 'file2.txt');
            fs.writeFileSync(file1, 'content1', 'utf-8');
            fs.writeFileSync(file2, 'content2', 'utf-8');

            const links = await tara.global.gitst.commitBatch([file1, file2]);

            expect(links.length).toBe(2);
            // Each file gets its own storagePath (different originPaths)
            expect(links[0].storagePath).not.toBe(links[1].storagePath);
        });
    });
});
