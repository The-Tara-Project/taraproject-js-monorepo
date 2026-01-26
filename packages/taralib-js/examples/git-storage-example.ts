/**
 * GitStorageManager Usage Example
 *
 * This example demonstrates how to use the GitStorageManager to capture
 * and commit files to git-based storage.
 */

import { TaraStack } from '../src';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

async function main() {
    // Create a TaraStack instance
    const tara = new TaraStack({
        writer: 'example-user',
        taraHome: path.join(os.tmpdir(), 'tara-home-example'),
    });

    // Example 1: Basic file commit
    console.log('Example 1: Basic file commit');
    console.log('='.repeat(50));

    // Create a test file outside of TaraStack
    const testFile = path.join(os.tmpdir(), 'example-file.txt');
    fs.writeFileSync(testFile, 'Hello, GitStorage!', 'utf-8');

    // Commit the file
    const link = tara.global.gitst.commit(testFile);

    console.log('Committed file successfully!');
    console.log('Commit hash:', link.commitHash);
    console.log('Short hash:', link.commitHashShort);
    console.log('Original path:', link.originalPath);
    console.log('Storage path:', link.storagePath);
    console.log('Content hash:', link.contentHash);
    console.log('Record ID:', link.recordId);
    console.log('Timestamp:', link.timestamp);
    console.log();

    // Example 2: Commit with custom message and metadata
    console.log('Example 2: Commit with custom message and metadata');
    console.log('='.repeat(50));

    const dataFile = path.join(os.tmpdir(), 'data.json');
    fs.writeFileSync(dataFile, JSON.stringify({ name: 'test', value: 42 }), 'utf-8');

    const link2 = tara.global.gitst.commit(dataFile, {
        message: 'Added important data file',
        metadata: {
            project: 'example',
            version: '1.0.0',
            tags: ['data', 'json']
        }
    });

    console.log('Committed with metadata!');
    console.log('Message:', link2.message);
    console.log('Record ID:', link2.recordId);
    console.log();

    // Example 3: Check git storage status
    console.log('Example 3: Git storage information');
    console.log('='.repeat(50));

    console.log('Storage path:', tara.global.gitst.getHomePath());
    console.log('Tape ID:', tara.global.gitst.getTapeId());
    console.log('Is initialized:', tara.global.gitst.exists());
    console.log();

    // Example 4: Query tape records
    console.log('Example 4: Query tape records');
    console.log('='.repeat(50));

    const tape = tara.global.tapes.get(tara.global.gitst.getTapeId());

    let recordCount = 0;
    await tape.readRecords(({ parsed }) => {
        if (parsed.type === 'taralib/git-storage-commit') {
            recordCount++;
            console.log(`Record ${recordCount}:`);
            console.log('  Commit hash:', parsed.link.commitHashShort);
            console.log('  Original file:', path.basename(parsed.link.originalPath));
            console.log('  Message:', parsed.link.message);
            if (parsed.metadata) {
                console.log('  Metadata:', JSON.stringify(parsed.metadata, null, 2));
            }
            console.log();
        }
    });

    console.log(`Total records: ${recordCount}`);
    console.log();

    // Example 5: Batch commit multiple files
    console.log('Example 5: Batch commit multiple files');
    console.log('='.repeat(50));

    // Create multiple test files
    const batchFiles = [
        path.join(os.tmpdir(), 'batch-file-1.txt'),
        path.join(os.tmpdir(), 'batch-file-2.txt'),
        path.join(os.tmpdir(), 'batch-file-3.txt'),
    ];

    batchFiles.forEach((file, index) => {
        fs.writeFileSync(file, `Batch file content ${index + 1}`, 'utf-8');
    });

    // Commit all files in a single batch
    const batchLinks = tara.global.gitst.commitBatch(batchFiles, {
        message: 'Batch commit of 3 files',
        metadata: {
            batch: true,
            count: 3
        }
    });

    console.log(`Committed ${batchLinks.length} files in a single git commit!`);
    console.log('Shared commit hash:', batchLinks[0].commitHash);
    console.log();

    batchLinks.forEach((link, index) => {
        console.log(`File ${index + 1}:`);
        console.log('  Original:', path.basename(link.originalPath));
        console.log('  Content hash:', link.contentHash);
        console.log('  Record ID:', link.recordId);
    });

    // Cleanup
    fs.unlinkSync(testFile);
    fs.unlinkSync(dataFile);
    batchFiles.forEach(file => fs.unlinkSync(file));
}

// Run the example
main().catch(console.error);
