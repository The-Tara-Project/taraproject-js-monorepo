import * as vscode from 'vscode';
import { ensureTaraHome } from '@jose_pereiro/taralib-js';
import { TapeTreeDataProvider } from './providers/TapeTreeDataProvider';
import { TapeDocumentProvider } from './providers/TapeDocumentProvider';
import type { TapeInfo } from './models/types';

export function activate(context: vscode.ExtensionContext) {
  console.log('Tara Reader extension is now active');

  // Ensure TARA_HOME exists
  try {
    ensureTaraHome();
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to initialize Tara home: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }

  // Register TreeView
  const tapeTreeProvider = new TapeTreeDataProvider();
  const treeView = vscode.window.createTreeView('taraReader.tapesView', {
    treeDataProvider: tapeTreeProvider,
    showCollapseAll: false
  });

  // Register Document Provider
  const docProvider = new TapeDocumentProvider();
  const docProviderDisposable = vscode.workspace.registerTextDocumentContentProvider('tara-tape', docProvider);

  // Register Commands
  const refreshCommand = vscode.commands.registerCommand('taraReader.refreshTapes', () => {
    tapeTreeProvider.refresh();
    vscode.window.showInformationMessage('Tapes refreshed');
  });

  const openTapeCommand = vscode.commands.registerCommand('taraReader.openTape', (tapeInfo: TapeInfo) => {
    const uri = vscode.Uri.parse(`tara-tape:///${tapeInfo.tapeId}.tara.jsonl`);
    vscode.window.showTextDocument(uri, { preview: false });
  });

  const copyPathCommand = vscode.commands.registerCommand('taraReader.copyTapePath', (tapeInfo: TapeInfo) => {
    vscode.env.clipboard.writeText(tapeInfo.filePath);
    vscode.window.showInformationMessage(`Copied: ${tapeInfo.filePath}`);
  });

  // Add all disposables to subscriptions
  context.subscriptions.push(
    treeView,
    docProviderDisposable,
    refreshCommand,
    openTapeCommand,
    copyPathCommand
  );
}

export function deactivate() {
  console.log('Tara Reader extension is now deactivated');
}
