import * as vscode from 'vscode';
import { TapeTreeItem } from '../models/TapeTreeItem';
import { getAllTapes } from '../utils/tape-utils';
import type { TapeInfo } from '../models/types';

export class TapeTreeDataProvider implements vscode.TreeDataProvider<TapeTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TapeTreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private _tapeCache: TapeInfo[] | null = null;
  private _cacheTimestamp: number = 0;
  private readonly CACHE_TTL = 30000; // 30 seconds

  async getChildren(element?: TapeTreeItem): Promise<TapeTreeItem[]> {
    if (!element) {
      // Root level: return all tapes
      const tapes = await this.loadTapes();
      return tapes.map(tape => new TapeTreeItem(tape));
    }
    return []; // No children for now (flat list)
  }

  getTreeItem(element: TapeTreeItem): vscode.TreeItem {
    return element;
  }

  refresh(): void {
    this._tapeCache = null;
    this._onDidChangeTreeData.fire(undefined);
  }

  private async loadTapes(): Promise<TapeInfo[]> {
    // Check cache
    if (this._tapeCache && (Date.now() - this._cacheTimestamp < this.CACHE_TTL)) {
      return this._tapeCache;
    }

    // Load fresh data
    try {
      this._tapeCache = await getAllTapes();
      this._tapeCache.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
      this._cacheTimestamp = Date.now();
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to load tapes: ${error instanceof Error ? error.message : String(error)}`);
      this._tapeCache = [];
    }

    return this._tapeCache;
  }
}
