export interface ITaraRecordMeta {
    id: string; // uuid4
    contentHash?: string; // optional hash of the content for integrity verification
    canonicalHash?: string; // optional canonical hash for deduplication
    writer?: string; // optional identifier for who/what created this record
    type?: string; // optional record type
}

export interface ITaraRecord {
    __tararecord: ITaraRecordMeta;
    [key: string]: unknown;
}

// Tape metadata structure (nested in __taratape field)
export interface ITaraTapeMeta {
    id: string; // uuid4 for the tape itself
    name: string; // human-readable identifier (formerly tapeId)
    formatVersion: "0.0.1"; // tape format version
    createdAt: string; // ISO 8601
    writer: string; // required, non-empty
    type?: string; // optional tape type, e.g. 'taralib/tape-metadata'
}

export interface ITapeMetaRecord extends ITaraRecord {
    __taratape: ITaraTapeMeta;
    // Top level is reserved for user custom metadata
}


export interface ReadJSONLCallbackArgs {
    parsed: any | null;
    lineNumber: number;
    line: string;
}
export type ReadJSONLCallback = (elm: ReadJSONLCallbackArgs) => void | 'stop';

export interface ReadRecordsCallbackArgs {
    parsed: ITaraRecord;
    lineNumber: number;
    line: string;
}
export type ReadRecordsCallback = (elm: ReadRecordsCallbackArgs) => void | 'stop';

export type SettingSource = 'runtime' | 'env' | 'project' | 'global' | 'bootstrap';

export interface SettingsState {
    loaded: boolean;
    sources: {
        runtime: Record<string, any>;
        env: Record<string, any>;
        project: Record<string, any>;
        global: Record<string, any>;
        bootstrap: Record<string, any>;
    };
}