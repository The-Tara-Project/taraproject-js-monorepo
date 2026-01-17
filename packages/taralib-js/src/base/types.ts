export interface TaraRecordMeta {
    id: string; // uuid4
}

export interface TaraRecord {
    __tara: TaraRecordMeta;
    [key: string]: unknown;
}

export interface TaraTapeMetadata extends TaraRecord {
    type: 'taralib/tape-metadata';
    tapeId: string;
    formatVersion: string;
    createdAt: string; // ISO 8601
}


export interface ReadRecordsCallbackArgs {
    parsed: TaraRecord;
    lineNumber: number;
    line: string;
}
export type ReadRecordsCallback = (elm: ReadRecordsCallbackArgs) => void | 'stop';

export type SettingSource = 'env' | 'project' | 'global';

export interface SettingsState {
    loaded: boolean;
    workingDir: string;
    sources: {
        env: Record<string, any>;
        project: Record<string, any>;
        global: Record<string, any>;
    };
}