/**
 * Global Tapes Manager Usage Example
 *
 * This example demonstrates how to use the global.tapes interface to manage
 * Tara tapes in the global scope (~/.taraproject/tapes/).
 */

import { TaraStack, RecordHandler } from '../src';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

async function main() {
    // Create a TaraStack instance with a temporary home directory for this example
    const tempHome = path.join(os.tmpdir(), `tara-home-example-${Date.now()}`);

    const tara = new TaraStack({
        writer: 'example-user',
        taraHome: tempHome,
    });

    console.log(`TaraStack home: ${tempHome}`);
    console.log();

    // Example 1: Access global tapes and create/append records
    console.log('Example 1: Create and append records to a global tape');
    console.log('='.repeat(60));

    // Get a handler for a global tape (creates a new tape if it doesn't exist)
    const tape1 = tara.global.tapes.get('my-first-tape');
    console.log(`Tape path: ${tape1.getPath()}`);

    // Instantiate the tape (creates the file structure if needed)
    tape1.instantiate();

    // Create and append some records
    const record1 = new RecordHandler({
        type: 'example/greeting',
        message: 'Hello from global tapes!',
        timestamp: new Date().toISOString(),
    });

    tape1.appendRecord(record1);
    console.log('Appended first record');

    const record2 = new RecordHandler({
        type: 'example/data',
        value: 42,
        array: [1, 2, 3],
    });

    tape1.appendRecord(record2);
    console.log('Appended second record');
    console.log();

    // Example 2: List all existing global tapes
    console.log('Example 2: List all global tapes');
    console.log('='.repeat(60));

    const tapeIds = tara.global.tapes.list();
    console.log(`Total tapes: ${tapeIds.length}`);
    tapeIds.forEach((id, index) => {
        console.log(`  ${index + 1}. ${id}`);
    });
    console.log();

    // Example 3: Create multiple tapes and add records to each
    console.log('Example 3: Create multiple tapes with different record types');
    console.log('='.repeat(60));

    const tapeNames = ['logs', 'metrics', 'events'];

    for (const tapeName of tapeNames) {
        const tape = tara.global.tapes.get(tapeName);
        tape.instantiate();

        const record = new RecordHandler({
            type: `example/${tapeName}`,
            content: `This is a ${tapeName} record`,
            createdAt: new Date().toISOString(),
        });

        tape.appendRecord(record);
        console.log(`Created tape "${tapeName}" and added a record`);
    }
    console.log();

    // Example 4: Check if tapes exist and read metadata
    console.log('Example 4: Check tape existence and read metadata');
    console.log('='.repeat(60));

    const existingTapeId = 'my-first-tape';
    if (tara.global.tapes.exists(existingTapeId)) {
        const tape = tara.global.tapes.get(existingTapeId);
        const metadata = await tape.readMetadata();
        console.log(`Tape "${existingTapeId}" exists`);
        console.log(`  Record count: ${metadata.recordCount}`);
        console.log(`  First record ID: ${metadata.firstRecordId}`);
        console.log(`  Last record ID: ${metadata.lastRecordId}`);
    } else {
        console.log(`Tape "${existingTapeId}" does not exist`);
    }

    const nonExistentTapeId = 'non-existent-tape';
    if (tara.global.tapes.exists(nonExistentTapeId)) {
        console.log(`Tape "${nonExistentTapeId}" exists`);
    } else {
        console.log(`Tape "${nonExistentTapeId}" does not exist`);
    }
    console.log();

    // Example 5: Read records from a tape
    console.log('Example 5: Read records from a tape');
    console.log('='.repeat(60));

    const tape = tara.global.tapes.get('my-first-tape');
    let recordCount = 0;

    await tape.readRecords(({ parsed }) => {
        recordCount++;
        console.log(`Record ${recordCount}:`);
        console.log(`  ID: ${parsed.__tararecord.id}`);
        console.log(`  Type: ${parsed.type}`);
        console.log(`  Data: ${JSON.stringify(parsed, null, 2)}`);
    });

    console.log(`Total records read: ${recordCount}`);
    console.log();

    // Example 6: List tapes and get statistics
    console.log('Example 6: Tape statistics');
    console.log('='.repeat(60));

    const allTapes = tara.global.tapes.list();
    console.log(`Total tapes in global scope: ${allTapes.length}`);

    for (const tapeId of allTapes) {
        if (tara.global.tapes.exists(tapeId)) {
            const tapeHandler = tara.global.tapes.get(tapeId);
            const meta = await tapeHandler.readMetadata();
            console.log(`\nTape: ${tapeId}`);
            console.log(`  Records: ${meta.recordCount}`);
            console.log(`  Path: ${tapeHandler.getPath()}`);
        }
    }
    console.log();

    // Example 7: Delete a tape
    console.log('Example 7: Delete a tape');
    console.log('='.repeat(60));

    const tapeToDelete = 'logs';
    console.log(`Deleting tape: ${tapeToDelete}`);
    tara.global.tapes.delete(tapeToDelete);

    const remainingTapes = tara.global.tapes.list();
    console.log(`Remaining tapes: ${remainingTapes.join(', ')}`);
    console.log();

    // Cleanup: Remove the temporary home directory
    console.log('Cleanup');
    console.log('='.repeat(60));
    console.log(`Removing temporary directory: ${tempHome}`);
    fs.rmSync(tempHome, { recursive: true, force: true });
    console.log('Done!');
}

// Run the example
main().catch(console.error);
