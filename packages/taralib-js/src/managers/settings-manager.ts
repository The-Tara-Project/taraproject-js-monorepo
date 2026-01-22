import type { TaraStack } from '../tara-project';
import { SettingsHandler } from '../base/settings';
import type { SettingSource } from '../base/types';

/**
 * SettingsManager provides operations for managing Tara settings.
 * This is a stack-layer component that wraps the SettingsHandler primitive.
 */
export class SettingsManager {
  readonly handler: SettingsHandler;

  constructor(private context: TaraStack) {
    this.handler = new SettingsHandler();
  }

  /**
   * Refresh settings from all sources.
   *
   * @param workingDir - Optional working directory to use for project settings
   */
  refresh(workingDir?: string): void {
    this.handler.refresh(workingDir);
  }

  /**
   * Get a setting value with cascade resolution.
   *
   * @param key - The setting key to retrieve
   * @param defaultValue - Optional default value if setting is not found
   * @returns The resolved setting value, default value, or undefined
   */
  get<T>(key: string, defaultValue?: T): T | undefined {
    return this.handler.getSetting(key, defaultValue);
  }

  /**
   * Get raw value from specific source.
   *
   * @param key - The setting key to retrieve
   * @param source - The source to query ('env', 'project', or 'global')
   * @returns The value from the specified source, or undefined
   */
  getRaw<T>(key: string, source: SettingSource): T | undefined {
    return this.handler.getRawValue(key, source);
  }

  /**
   * Check if settings have been loaded.
   *
   * @returns true if settings have been loaded, false otherwise
   */
  isLoaded(): boolean {
    return this.handler.isLoaded();
  }

  /**
   * Get the current working directory.
   *
   * @returns The working directory path
   */
  getWorkingDir(): string {
    return this.handler.getWorkingDir();
  }
}
