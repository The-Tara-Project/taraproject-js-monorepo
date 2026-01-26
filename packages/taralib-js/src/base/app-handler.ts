import * as fs from 'fs';
import * as path from 'path';

/**
 * AppHandler manages workflows for a specific Tara app.
 *
 */
export class AppHandler {
    private appName: string;
    private appPath: string;

    constructor(appName: string, appsBasePath: string) {
        this.appName = appName;
        this.appPath = path.join(appsBasePath, appName);
    }

    /**
     * Get the name of this app.
     * @returns The app name
     */
    getName(): string {
        return this.appName;
    }

    /**
     * Get the app folder path.
     * @returns Absolute path to the app folder
     */
    getHomePath(): string {
        return this.appPath;
    }

    /**
     * Check if the app folder exists.
     * @returns true if the app folder exists, false otherwise
     */
    exists(): boolean {
        return fs.existsSync(this.appPath);
    }

    /**
     * Delete the app folder and all its contents.
     */
    delete(): void {
        if (fs.existsSync(this.appPath)) {
            fs.rmSync(this.appPath, { recursive: true, force: true });
        }
    }
}
