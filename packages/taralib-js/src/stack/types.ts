export interface TaraStackSettings {
    /** Optional writer identifier - who/what is using this TaraStack instance. Required for tape instantiation. */
    writer?: string;
    taraHome?: string;
    workingDir?: string;
    [keys: string]: any;
}