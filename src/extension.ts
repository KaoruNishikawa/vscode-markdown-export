import * as vscode from 'vscode';
import { ExportMarkdown } from './export-markdown';

export function activate(context: vscode.ExtensionContext) {
    console.log('Extension "markdown-export" is now active.');

    const fileHandler = new ExportMarkdown(context);

    const commands = [
        vscode.commands.registerCommand('markdown-export.to.html', async () => { await fileHandler.export('html'); }),
        vscode.commands.registerCommand('markdown-export.to.pdf', async () => { await fileHandler.export('pdf'); })
    ];

    commands.forEach(element => {
        context.subscriptions.push(element);
    });
}

export function deactivate(): void { return; }
