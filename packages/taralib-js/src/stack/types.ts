export interface TaraStackSettings {
    /** Optional writer identifier - who/what is using this TaraStack instance. Required for tape instantiation. */
    writer?: string;
    taraHome?: string;
    workingDir?: string;
    /** Silent mode - suppress git command output (defaults to true). */
    silent?: boolean;
    [keys: string]: any;
}