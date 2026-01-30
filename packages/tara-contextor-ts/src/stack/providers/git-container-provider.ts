import { GitHandler } from '@jose_pereiro/taralib-js';
import type { ContextRequest, ContextRequestResult, LiteContext } from '../../base/types';
import { ContextProvider } from '../context-provider';

/**
 * Provider for git repository container context.
 * Collects identification data from git repositories for later matching.
 */
export class GitContainerProvider extends ContextProvider {
    readonly name = 'git-container';
    readonly supportedItems = [
        'repo-user-name',
        'repo-user-email',
        'repo-remotes',
        'repo-first-commits',
        'repo-last-commits',
    ] as const;

    async collect(request: ContextRequest): Promise<ContextRequestResult> {
        const path = request.options?.path as string | undefined;

        // Fail gracefully if path not provided
        if (!path) {
            return {
                provider: this.name,
                status: 'error',
                collectedItems: [],
                failedItems: [...request.items],
                liteContext: {},
            };
        }

        // Create GitHandler and check if path is inside a git repo
        const gitHandler = new GitHandler(path, { silent: true });
        if (!gitHandler.checkInsideWorkingTree()) {
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

        for (const item of request.items) {
            try {
                switch (item) {
                    case 'repo-user-name':
                        liteContext[item] = this.getUserName(gitHandler);
                        collectedItems.push(item);
                        break;
                    case 'repo-user-email':
                        liteContext[item] = this.getUserEmail(gitHandler);
                        collectedItems.push(item);
                        break;
                    case 'repo-remotes':
                        liteContext[item] = this.getRemotes(gitHandler);
                        collectedItems.push(item);
                        break;
                    case 'repo-first-commits':
                        liteContext[item] = this.getFirstCommits(gitHandler);
                        collectedItems.push(item);
                        break;
                    case 'repo-last-commits':
                        liteContext[item] = this.getLastCommits(gitHandler);
                        collectedItems.push(item);
                        break;
                    default:
                        failedItems.push(item);
                }
            } catch {
                failedItems.push(item);
            }
        }

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

    private getUserName(gitHandler: GitHandler): string | null {
        try {
            return gitHandler.execCmdSync('config user.name');
        } catch {
            return null;
        }
    }

    private getUserEmail(gitHandler: GitHandler): string | null {
        try {
            return gitHandler.execCmdSync('config user.email');
        } catch {
            return null;
        }
    }

    private getRemotes(gitHandler: GitHandler): Record<string, { fetch?: string; push?: string }> {
        try {
            const output = gitHandler.execCmdSync('remote -v');
            const remotes: Record<string, { fetch?: string; push?: string }> = {};
            
            for (const line of output.split('\n')) {
                const match = line.match(/^(\S+)\s+(\S+)\s+\((fetch|push)\)$/);
                if (match) {
                    const [, name, url, type] = match;
                    if (!remotes[name]) {
                        remotes[name] = {};
                    }
                    remotes[name][type as 'fetch' | 'push'] = url;
                }
            }
            
            return remotes;
        } catch {
            return {};
        }
    }

    private getFirstCommits(gitHandler: GitHandler): string[] {
        try {
            // Get commits in chronological order (oldest first), take first 5
            const output = gitHandler.execCmdSync('rev-list --reverse HEAD');
            const commits = output.split('\n').filter(Boolean);
            return commits.slice(0, 5);
        } catch {
            return [];
        }
    }

    private getLastCommits(gitHandler: GitHandler): string[] {
        try {
            // Get most recent 5 commits
            const output = gitHandler.execCmdSync('rev-list -n 5 HEAD');
            return output.split('\n').filter(Boolean);
        } catch {
            return [];
        }
    }
}
