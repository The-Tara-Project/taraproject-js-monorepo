import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
    getAppsFolderPath,
    getAppFolderPath,
    getAppQuestionsFolderPath,
    ensureAppQuestionsFolder,
    listQuestionFiles,
    loadQuestion,
    loadRandomQuestion,
    saveQuestion,
    TaraQuestion,
} from '../src/base/app-handler';
import { getTaraHomePath } from '../src/base/home';

describe('app-handler', () => {
    const testAppName = 'test-app';

    beforeEach(() => {
        // Clean up test app folder if it exists
        const appFolder = getAppFolderPath(testAppName);
        if (fs.existsSync(appFolder)) {
            fs.rmSync(appFolder, { recursive: true, force: true });
        }
    });

    describe('path functions', () => {
        it('getAppsFolderPath returns apps subfolder of TARA_HOME', () => {
            const appsPath = getAppsFolderPath();
            const expected = path.join(getTaraHomePath(), 'apps');
            expect(appsPath).toBe(expected);
        });

        it('getAppFolderPath returns app-specific folder', () => {
            const appPath = getAppFolderPath(testAppName);
            const expected = path.join(getTaraHomePath(), 'apps', testAppName);
            expect(appPath).toBe(expected);
        });

        it('getAppQuestionsFolderPath returns questions subfolder', () => {
            const questionsPath = getAppQuestionsFolderPath(testAppName);
            const expected = path.join(getTaraHomePath(), 'apps', testAppName, 'questions');
            expect(questionsPath).toBe(expected);
        });
    });

    describe('ensureAppQuestionsFolder', () => {
        it('creates questions folder if it does not exist', () => {
            const questionsPath = getAppQuestionsFolderPath(testAppName);
            expect(fs.existsSync(questionsPath)).toBe(false);

            ensureAppQuestionsFolder(testAppName);

            expect(fs.existsSync(questionsPath)).toBe(true);
            expect(fs.statSync(questionsPath).isDirectory()).toBe(true);
        });

        it('does not error if folder already exists', () => {
            ensureAppQuestionsFolder(testAppName);
            expect(() => ensureAppQuestionsFolder(testAppName)).not.toThrow();
        });
    });

    describe('saveQuestion', () => {
        it('saves a question to a JSON file', () => {
            const question: TaraQuestion = {
                question: 'What are you doing?',
                prompt: 'Describe your activity',
                placeholder: 'e.g., Working on...',
                pullerName: 'test-puller',
            };

            saveQuestion(testAppName, 'test-question', question);

            const filePath = path.join(getAppQuestionsFolderPath(testAppName), 'test-question.json');
            expect(fs.existsSync(filePath)).toBe(true);

            const content = fs.readFileSync(filePath, 'utf-8');
            const parsed = JSON.parse(content);
            expect(parsed).toEqual(question);
        });

        it('creates questions folder if it does not exist', () => {
            const question: TaraQuestion = {
                question: 'Test question',
            };

            const questionsPath = getAppQuestionsFolderPath(testAppName);
            expect(fs.existsSync(questionsPath)).toBe(false);

            saveQuestion(testAppName, 'test', question);

            expect(fs.existsSync(questionsPath)).toBe(true);
        });
    });

    describe('listQuestionFiles', () => {
        it('returns empty array when no questions exist', () => {
            const files = listQuestionFiles(testAppName);
            expect(files).toEqual([]);
        });

        it('returns empty array when folder does not exist', () => {
            const files = listQuestionFiles('non-existent-app');
            expect(files).toEqual([]);
        });

        it('lists all JSON files in questions folder', () => {
            ensureAppQuestionsFolder(testAppName);
            const questionsPath = getAppQuestionsFolderPath(testAppName);

            // Create test files
            fs.writeFileSync(path.join(questionsPath, 'q1.json'), '{}');
            fs.writeFileSync(path.join(questionsPath, 'q2.json'), '{}');
            fs.writeFileSync(path.join(questionsPath, 'not-json.txt'), 'text');

            const files = listQuestionFiles(testAppName);

            expect(files).toHaveLength(2);
            expect(files.some(f => f.endsWith('q1.json'))).toBe(true);
            expect(files.some(f => f.endsWith('q2.json'))).toBe(true);
            expect(files.some(f => f.endsWith('not-json.txt'))).toBe(false);
        });
    });

    describe('loadQuestion', () => {
        it('loads a question from a file', () => {
            const question: TaraQuestion = {
                question: 'What are you doing?',
                prompt: 'Describe your activity',
                placeholder: 'e.g., Working on...',
            };

            saveQuestion(testAppName, 'test-question', question);
            const filePath = path.join(getAppQuestionsFolderPath(testAppName), 'test-question.json');

            const loaded = loadQuestion(filePath);
            expect(loaded).toEqual(question);
        });

        it('returns null for non-existent file', () => {
            const loaded = loadQuestion('/non/existent/file.json');
            expect(loaded).toBeNull();
        });

        it('returns null for invalid JSON', () => {
            ensureAppQuestionsFolder(testAppName);
            const filePath = path.join(getAppQuestionsFolderPath(testAppName), 'invalid.json');
            fs.writeFileSync(filePath, 'invalid json content');

            const loaded = loadQuestion(filePath);
            expect(loaded).toBeNull();
        });

        it('returns null if question field is missing', () => {
            ensureAppQuestionsFolder(testAppName);
            const filePath = path.join(getAppQuestionsFolderPath(testAppName), 'no-question.json');
            fs.writeFileSync(filePath, JSON.stringify({ prompt: 'only prompt' }));

            const loaded = loadQuestion(filePath);
            expect(loaded).toBeNull();
        });

        it('accepts questions with extra fields', () => {
            const question = {
                question: 'What are you doing?',
                customField: 'custom value',
                nestedData: { key: 'value' },
            };

            saveQuestion(testAppName, 'extra-fields', question);
            const filePath = path.join(getAppQuestionsFolderPath(testAppName), 'extra-fields.json');

            const loaded = loadQuestion(filePath);
            expect(loaded).toEqual(question);
        });
    });

    describe('loadRandomQuestion', () => {
        it('returns null when no questions exist', () => {
            const question = loadRandomQuestion(testAppName);
            expect(question).toBeNull();
        });

        it('loads the only question when only one exists', () => {
            const testQuestion: TaraQuestion = {
                question: 'What are you doing?',
                prompt: 'Describe your activity',
            };

            saveQuestion(testAppName, 'only-question', testQuestion);

            const loaded = loadRandomQuestion(testAppName);
            expect(loaded).toEqual(testQuestion);
        });

        it('loads a random question from multiple options', () => {
            const questions: TaraQuestion[] = [
                { question: 'Question 1' },
                { question: 'Question 2' },
                { question: 'Question 3' },
            ];

            questions.forEach((q, i) => {
                saveQuestion(testAppName, `q${i}`, q);
            });

            const loaded = loadRandomQuestion(testAppName);
            expect(loaded).not.toBeNull();
            expect(questions.some(q => q.question === loaded?.question)).toBe(true);
        });

        it('returns null if random file is invalid', () => {
            ensureAppQuestionsFolder(testAppName);
            const questionsPath = getAppQuestionsFolderPath(testAppName);
            fs.writeFileSync(path.join(questionsPath, 'invalid.json'), 'invalid');

            const loaded = loadRandomQuestion(testAppName);
            expect(loaded).toBeNull();
        });
    });
});
