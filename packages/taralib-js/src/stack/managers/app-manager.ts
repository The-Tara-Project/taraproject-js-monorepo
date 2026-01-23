import * as fs from 'fs';
import * as path from 'path';
import type { TaraStack } from '../tara-stack';
import { AppHandler } from '../../base/app-handler';

/**
 * AppManager provides high-level operations for managing Tara apps.
 *
 * AGENTS/TODO/DONE: Merged App class functionality with AppManager
 */
export class AppManager {
  constructor(private context: TaraStack) {}

  /**
   * List all app names in ~/.taraproject/apps/
   * @returns Array of app names
   */
  list(): string[] {
    const appsPath = this.context.global.home.getAppsPath();
    if (!fs.existsSync(appsPath)) return [];

    return fs.readdirSync(appsPath).filter(f => {
      const fullPath = path.join(appsPath, f);
      return fs.statSync(fullPath).isDirectory();
    });
  }

  /**
   * Get app handler (creates AppHandler instance).
   * Note: App folder may not exist yet - use exists() to check.
   *
   * @param appName - The name of the app
   * @returns An AppHandler instance
   */
  get(appName: string): AppHandler {
    const appsPath = this.context.global.home.getAppsPath();
    return new AppHandler(appName, appsPath);
  }

  /**
   * Create app folder structure.
   *
   * @param appName - The name of the app to create
   * @returns An AppHandler instance
   */
  create(appName: string): AppHandler {
    const appsPath = this.context.global.home.getAppsPath();
    const appPath = path.join(appsPath, appName);
    if (!fs.existsSync(appPath)) {
      fs.mkdirSync(appPath, { recursive: true });
    }
    return this.get(appName);
  }

  /**
   * Check if app folder exists.
   *
   * @param appName - The name of the app to check
   * @returns true if the app folder exists, false otherwise
   */
  exists(appName: string): boolean {
    return this.list().includes(appName);
  }
}
