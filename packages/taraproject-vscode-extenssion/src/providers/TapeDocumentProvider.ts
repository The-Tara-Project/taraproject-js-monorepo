import * as vscode from 'vscode';
import * as fs from 'node:fs';
import { TaraTapeHandler, getTapesFolderPath } from '@jose_pereiro/taralib-js';
import * as path from 'node:path';

export class TapeDocumentProvider implements vscode.TextDocumentContentProvider {
  provideTextDocumentContent(uri: vscode.Uri): string {
    try {
      // uri: tara-tape:///<tapeId>
      const tapeId = uri.path.substring(1).replace('.tara.jsonl', '');
      const tapesFolder = getTapesFolderPath();
      const filePath = path.join(tapesFolder, `${tapeId}.tara.jsonl`);

      // Read raw JSONL content
      const content = fs.readFileSync(filePath, 'utf-8');
      return content;
    } catch (error) {
      return `Error loading tape: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}
