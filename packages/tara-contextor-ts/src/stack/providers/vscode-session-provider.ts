import type { ContextRequest, ContextRequestResult, LiteContext } from '../../base/types';
import { ContextProvider } from '../context-provider';

// QUESTION: con we just add as a dependency the vscode library?
/** VSCode API type (minimal shape needed) */
interface VscodeApi {
    window: {
        tabGroups: {
            all: Array<{
                tabs: Array<{
                    input?: {
                        uri?: { fsPath: string };
                    };
                }>;
            }>;
        };
        activeTextEditor?: {
            document: {
                uri: { fsPath: string };
            };
        };
    };
    workspace: {
        workspaceFolders?: Array<{
            uri: { fsPath: string };
        }>;
    };
}

/**
 * Provider for VSCode session context.
 * Collects information about open files, focused file, and workspace folders.
 */
export class VscodeSessionProvider extends ContextProvider {
    readonly name = 'vscode-session';
    readonly supportedItems = [
        'opened-files-paths',
        'focused-file-path',
        'workspace-folders-paths',
    ] as const;

    async collect(request: ContextRequest): Promise<ContextRequestResult> {
        const vscode = request.options?.vscode as VscodeApi | undefined;

        // Fail gracefully if vscode API missing
        if (!vscode) {
            return {
                provider: this.name,
                status: 'error',
                collectedItems: [],
                failedItems: [...request.items],
                liteContext: {},
            };
        }

        const liteContext: LiteContext = {};
        const collectedItems: string[] = [];
        const failedItems: string[] = [];

        // Collect each requested item
        for (const item of request.items) {
            try {
                switch (item) {
                    case 'opened-files-paths':
                        liteContext[item] = this.getOpenedFilesPaths(vscode);
                        collectedItems.push(item);
                        break;
                    case 'focused-file-path':
                        liteContext[item] = this.getFocusedFilePath(vscode);
                        collectedItems.push(item);
                        break;
                    case 'workspace-folders-paths':
                        liteContext[item] = this.getWorkspaceFoldersPaths(vscode);
                        collectedItems.push(item);
                        break;
                    default:
                        failedItems.push(item);
                }
            } catch {
                failedItems.push(item);
            }
        }

        // Determine status
        let status: 'success' | 'partial' | 'error';
        if (failedItems.length === 0) {
            status = 'success';
        } else if (collectedItems.length > 0) {
            status = 'partial';
        } else {
            status = 'error';
        }

        return {
            provider: this.name,
            status,
            collectedItems,
            failedItems,
            liteContext,
        };
    }

    private getOpenedFilesPaths(vscode: VscodeApi): string[] {
        const paths: string[] = [];
        for (const group of vscode.window.tabGroups.all) {
            for (const tab of group.tabs) {
                const fsPath = tab.input?.uri?.fsPath;
                if (fsPath) {
                    paths.push(fsPath);
                }
            }
        }
        return paths;
    }

    private getFocusedFilePath(vscode: VscodeApi): string | null {
        return vscode.window.activeTextEditor?.document.uri.fsPath ?? null;
    }

    private getWorkspaceFoldersPaths(vscode: VscodeApi): string[] {
        const folders = vscode.workspace.workspaceFolders;
        if (!folders) {
            return [];
        }
        return folders.map((f) => f.uri.fsPath);
    }
}
