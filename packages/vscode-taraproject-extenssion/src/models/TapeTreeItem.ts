import * as vscode from 'vscode';
import type { TapeInfo } from './types';
import { formatFileSize, formatDate } from '../utils/tape-utils';

export class TapeTreeItem extends vscode.TreeItem {
  constructor(public readonly tapeInfo: TapeInfo) {
    super(tapeInfo.tapeFile.replace('.tara.jsonl', ''), vscode.TreeItemCollapsibleState.None);

    this.description = `${tapeInfo.recordCount} records, ${formatFileSize(tapeInfo.fileSize)}`;
    this.tooltip = `${tapeInfo.tapeFile}\nRecords: ${tapeInfo.recordCount}\nSize: ${formatFileSize(tapeInfo.fileSize)}\nCreated: ${formatDate(tapeInfo.createdAt)}\nModified: ${formatDate(tapeInfo.lastModified)}`;
    this.iconPath = new vscode.ThemeIcon('file-code');
    this.contextValue = 'tape';

    // Click to open
    this.command = {
      command: 'taraReader.openTape',
      title: 'Open Tape',
      arguments: [this.tapeInfo]
    };
  }
}
