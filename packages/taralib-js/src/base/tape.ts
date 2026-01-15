import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { ensureTaraHome, getTapesFolderPath } from './home';
import { createRecord, isValidRecord, stringifyRecord, parseRecord, checkValidRecord } from './record';
import type { ReadRecordsCallback, ReadRecordsCallbackArgs, TaraRecord, TaraTape, TaraTapeMetadata } from './types';

const FORMAT_VERSION = '1.0.0';

export function createTapeHandler(
    tapeId: string
): TaraTape {
    return {
        tapeId,
        path: buildTapePath(tapeId),
    };
}

export function buildTapePath(
    tapeId: string
): string {
    const tapesFolderPath = getTapesFolderPath();
    const tapeName = `${tapeId}.tara.jsonl`;
    return path.join(tapesFolderPath, tapeName);
}

export function getTapePath(tape: TaraTape): string {
    return tape.path;
}

function isValidTapeMetadata(obj: unknown): obj is TaraTapeMetadata {
    if (!isValidRecord(obj)) {
        return false;
    }

    const record = obj as Record<string, unknown>;

    if (record.type !== 'taralib/tape-metadata') {
        return false;
    }

    if (typeof record.tapeId !== 'string' || record.tapeId.length === 0) {
        return false;
    }

    if (typeof record.formatVersion !== 'string' || record.formatVersion.length === 0) {
        return false;
    }

    if (typeof record.createdAt !== 'string' || record.createdAt.length === 0) {
        return false;
    }

    return true;
}

function _createTapeMetadata(
    tapeId: string
): TaraTapeMetadata {
    const base = createRecord({
        type: 'taralib/tape-metadata',
        tapeId,
        formatVersion: FORMAT_VERSION,
        createdAt: new Date().toISOString(),
    });

    // TODO: move validation to tests
    // by construction this should always be valid
    // if (!isValidTapeMetadata(base)) {
    //     throw new Error('Failed to create valid tape metadata');
    // }

    return base as TaraTapeMetadata;
}

function _bootstrapTape(
    tape: TaraTape
): void {
    ensureTaraHome();
    const metadata = _createTapeMetadata(tape.tapeId);
    fs.writeFileSync(tape.path, stringifyRecord(metadata) + '\n', 'utf-8');
}

export function instantiateTape(
    tape: TaraTape
): void {
    if (fs.existsSync(tape.path)) { return; }
    _bootstrapTape(tape);
}


export async function readTapeRecords(
    tape: TaraTape,
    callback: ReadRecordsCallback
): Promise<void> {
    const tapePath = getTapePath(tape);
    const fileStream = fs.createReadStream(tapePath, { encoding: 'utf-8' });
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity,
    });

    let lineNumber = 0;
    let shouldStop = false;

    for await (const line of rl) {
        lineNumber++;

        if (line.trim().length === 0) {
            continue;
        }

        try {
            const parsed = parseRecord(line);

            const elm: ReadRecordsCallbackArgs = {
                parsed, lineNumber, line,
            };
            const result = callback(elm);
            if (result === 'stop') {
                shouldStop = true;
                break;
            }
        } catch (error) {
            throw new Error(`Corrupted record at line ${lineNumber}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    fileStream.close();
}

// assume all records are valid
// records should be made using `createRecord`
// which ensures validity
export function appendRecord(
    tape: TaraTape,
    record: TaraRecord, 
): void {
    const tapePath = getTapePath(tape);
    const line = stringifyRecord(record) + '\n';
    fs.appendFileSync(tapePath, line, 'utf-8');
}

// assume all records are valid
// records should be made using `createRecord`
// which ensures validity
export function appendRecordBatch(
    tape: TaraTape, 
    records: TaraRecord[]
): void {
    const content = records.map(
        record => stringifyRecord(record)
    ).join('\n') + '\n';
    const tapePath = getTapePath(tape);
    fs.appendFileSync(tapePath, content, 'utf-8');
}

export function checkTapeFile(
    tape: TaraTape
): void {
    const tapePath = getTapePath(tape);
    if (!fs.existsSync(tapePath)) {
        throw new Error(`Tape file does not exist: ${tapePath}`);
    }
    return;
}

export async function readTapeMetadata(
    tape: TaraTape
): Promise<TaraTapeMetadata> {

    // Ensure tape file exists
    checkTapeFile(tape);

    // Return cached metadata if available
    if (tape.metadata) {
        return tape.metadata;
    }

    // Read first record (metadata) using readTapeRecords
    let metadata: TaraTapeMetadata | null = null;

    await readTapeRecords(tape, ({ parsed }) => {
        if (!isValidTapeMetadata(parsed)) {
            throw new Error('Invalid metadata record');
        }
        metadata = parsed;
        // Stop after reading first record
        return 'stop';
    });

    if (!metadata) {
        throw new Error('No metadata record found in tape');
    }

    // Cache metadata in tape object
    tape.metadata = metadata;

    return metadata;
}

export function tapeExists(
    tara: TaraTape
): boolean {
    const tapePath = getTapePath(tara);
    return fs.existsSync(tapePath);
}

export function deleteTape(
    tape: TaraTape
): void {
    const tapePath = getTapePath(tape);
    if (fs.existsSync(tapePath)) {
        fs.unlinkSync(tapePath);
    }
}
