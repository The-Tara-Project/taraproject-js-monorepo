import * as fs from 'fs';
import * as path from 'path';
import type { TaraStack } from '../tara-stack';
import type { TaraQuestion } from '../../base/app-handler';
import {
  getAppQuestionsFolderPath,
  listQuestionFiles,
  loadQuestion as appHandlerLoadQuestion,
  loadRandomQuestion as appHandlerLoadRandomQuestion,
  saveQuestion as appHandlerSaveQuestion,
} from '../../base/app-handler';

/**
 * QuestionManager provides operations for managing questions within a specific app.
 */
export class QuestionManager {
  constructor(
    private appName: string,
    private context: TaraStack
  ) {}

  /**
   * List all question file names.
   * @returns Array of question file paths (absolute paths to .json files)
   */
  list(): string[] {
    return listQuestionFiles(this.appName);
  }

  /**
   * Get a specific question by file path.
   *
   * @param filePath - Absolute path to the question file
   * @returns The question object, or null if not found or invalid
   */
  get(filePath: string): TaraQuestion | null {
    return appHandlerLoadQuestion(filePath);
  }

  /**
   * Get a random question from this app.
   * @returns A random question object, or null if no questions exist
   */
  getRandom(): TaraQuestion | null {
    return appHandlerLoadRandomQuestion(this.appName);
  }

  /**
   * Save a question to a file.
   * Auto-creates ~/.taraproject/apps/{appName}/questions/ if needed.
   *
   * @param fileName - The name of the file (without .json extension)
   * @param question - The question object to save
   */
  save(fileName: string, question: TaraQuestion): void {
    appHandlerSaveQuestion(this.appName, fileName, question);
  }

  /**
   * Delete a question file.
   *
   * @param fileName - The name of the file to delete (with .json extension)
   */
  delete(fileName: string): void {
    const questionsPath = getAppQuestionsFolderPath(this.appName);
    const filePath = path.join(questionsPath, fileName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}
