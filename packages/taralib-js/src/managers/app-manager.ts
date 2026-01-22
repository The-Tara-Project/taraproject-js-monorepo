import * as fs from 'fs';
import * as path from 'path';
import type { TaraStack } from '../tara-project';
import { QuestionManager } from './question-manager';
import { getAppsFolderPath, getAppFolderPath } from '../base/app-handler';

/**
 * AppManager provides high-level operations for managing Tara apps.
 */
export class AppManager {
  constructor(private context: TaraStack) {}

  /**
   * List all app names in ~/.taraproject/apps/
   * @returns Array of app names
   */
  list(): string[] {
    const appsPath = getAppsFolderPath();
    if (!fs.existsSync(appsPath)) return [];

    return fs.readdirSync(appsPath).filter(f => {
      const fullPath = path.join(appsPath, f);
      return fs.statSync(fullPath).isDirectory();
    });
  }

  /**
   * Get app context (creates App instance).
   * Note: App folder may not exist yet - use exists() to check.
   *
   * @param appName - The name of the app
   * @returns An App instance
   */
  get(appName: string): App {
    return new App(appName, this.context);
  }

  /**
   * Create app folder structure.
   * Auto-creates ~/.taraproject/apps/{appName}/questions/
   *
   * @param appName - The name of the app to create
   * @returns An App instance
   */
  create(appName: string): App {
    const appPath = getAppFolderPath(appName);
    if (!fs.existsSync(appPath)) {
      fs.mkdirSync(appPath, { recursive: true });
    }
    const questionsPath = path.join(appPath, 'questions');
    if (!fs.existsSync(questionsPath)) {
      fs.mkdirSync(questionsPath, { recursive: true });
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

/**
 * Represents a Tara app context.
 * Each app has its own questions folder and can manage question files.
 */
export class App {
  readonly name: string;
  readonly questions: QuestionManager;

  constructor(
    name: string,
    private context: TaraStack
  ) {
    this.name = name;
    this.questions = new QuestionManager(name, context);
  }

  /**
   * Get app folder path.
   * @returns Absolute path to the app folder
   */
  getPath(): string {
    return getAppFolderPath(this.name);
  }

  /**
   * Delete app folder and all contents.
   */
  delete(): void {
    const appPath = this.getPath();
    if (fs.existsSync(appPath)) {
      fs.rmSync(appPath, { recursive: true, force: true });
    }
  }

  /**
   * Check if app folder exists.
   * @returns true if the app folder exists, false otherwise
   */
  exists(): boolean {
    return fs.existsSync(this.getPath());
  }
}
