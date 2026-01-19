import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    console.log('Tara Puller extension is now active!');

    const disposable = vscode.commands.registerCommand('taraPuller.helloWorld', () => {
        vscode.window.showInformationMessage('Hello from Tara Puller!');
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}
