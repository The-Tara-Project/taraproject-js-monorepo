import * as fs from 'fs';
import * as path from 'path';
import { getAppsFolderPath as getAppsFolderPathFromHome } from './home';

const QUESTIONS_DIR = 'questions';

/**
 * Get the path to the apps folder within TARA_HOME
 * @returns Path to ~/.taraproject/apps
 * @deprecated Import from home.ts instead
 */
export function getAppsFolderPath(): string {
    return getAppsFolderPathFromHome();
}

/**
 * Interface for a question file stored in `.taraproject/apps/<app_name>/questions/`
 */
export interface TaraQuestion {
    /** The question text to display to the user */
    question: string;
    /** Optional prompt/description shown below the question */
    prompt?: string;
    /** Optional placeholder text for the input field */
    placeholder?: string;
    /** Optional name of the puller that owns this question */
    pullerName?: string;
    /** Any additional metadata */
    [key: string]: unknown;
}

/**
 * Get the path to a specific app's folder
 * @param appName - The name of the app
 * @returns Path to ~/.taraproject/apps/<app_name>
 */
export function getAppFolderPath(appName: string): string {
    return path.join(getAppsFolderPath(), appName);
}

/**
 * Get the path to an app's questions folder
 * @param appName - The name of the app
 * @returns Path to ~/.taraproject/apps/<app_name>/questions
 */
export function getAppQuestionsFolderPath(appName: string): string {
    return path.join(getAppFolderPath(appName), QUESTIONS_DIR);
}

/**
 * Ensure the app's questions folder exists
 * @param appName - The name of the app
 */
export function ensureAppQuestionsFolder(appName: string): void {
    const questionsPath = getAppQuestionsFolderPath(appName);
    if (!fs.existsSync(questionsPath)) {
        fs.mkdirSync(questionsPath, { recursive: true });
    }
}

/**
 * List all question files in an app's questions folder
 * @param appName - The name of the app
 * @returns Array of question file paths (absolute paths to .json files)
 */
export function listQuestionFiles(appName: string): string[] {
    const questionsPath = getAppQuestionsFolderPath(appName);

    if (!fs.existsSync(questionsPath)) {
        return [];
    }

    const files = fs.readdirSync(questionsPath);
    return files
        .filter(file => file.endsWith('.json'))
        .map(file => path.join(questionsPath, file));
}

/**
 * Load a question from a file
 * @param filePath - Absolute path to the question JSON file
 * @returns The parsed question object, or null if loading fails
 */
export function loadQuestion(filePath: string): TaraQuestion | null {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(content);

        // Validate that at least the question field exists
        if (typeof parsed.question !== 'string') {
            return null;
        }

        return parsed as TaraQuestion;
    } catch {
        return null;
    }
}

/**
 * Load a random question from an app's questions folder
 * @param appName - The name of the app
 * @returns The parsed question object, or null if no questions exist or loading fails
 */
export function loadRandomQuestion(appName: string): TaraQuestion | null {
    const files = listQuestionFiles(appName);

    if (files.length === 0) {
        return null;
    }

    // Pick a random file
    const randomIndex = Math.floor(Math.random() * files.length);
    const randomFile = files[randomIndex];

    return loadQuestion(randomFile);
}

/**
 * Save a question to a file in an app's questions folder
 * @param appName - The name of the app
 * @param fileName - The name of the file (without .json extension)
 * @param question - The question object to save
 */
export function saveQuestion(appName: string, fileName: string, question: TaraQuestion): void {
    ensureAppQuestionsFolder(appName);
    const filePath = path.join(getAppQuestionsFolderPath(appName), `${fileName}.json`);
    fs.writeFileSync(filePath, JSON.stringify(question, null, 2), 'utf-8');
}
