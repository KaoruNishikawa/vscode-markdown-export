import * as vscode from 'vscode';
import * as puppeteer from 'puppeteer-core';

export class ChromiumHandler {
    ctx: vscode.ExtensionContext;
    public constructor(ctx: vscode.ExtensionContext) {
        this.ctx = ctx;
    }

    private async isExistingFile(filePath: string): Promise<boolean> {
        try {
            const stat = await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
            return stat.type === vscode.FileType.File ? true : false;
        } catch (error) {
            console.error(error);
            return false;
        }
    }

    /**
     * Find the path to Chromium executable.
     * @returns Path to Chromium executable or undefined if not found.
     * @description
     * 1. Check if the path to Chromium is configured in the extension settings.
     * 2. Check if the path to Chromium is auto-detected by puppeteer.
     * 3. If not found, return undefined.
     */
    public async findChromiumPath(): Promise<string | undefined> {
        try {
            const fromConfiguration: string | undefined = vscode.workspace.getConfiguration('markdown-export').get('chrome.path');
            if (fromConfiguration && await this.isExistingFile(fromConfiguration)) {
                return fromConfiguration;
            } else if (fromConfiguration) {
                console.info(`Cannot find Chromium at ${fromConfiguration}.`);
            }

            const autoDetected = puppeteer.executablePath();
            if (autoDetected && await this.isExistingFile(autoDetected)) {
                return autoDetected;
            }
        } catch (error) {
            console.error(error);
        }
        return;
    }

    /**
     * Get path to Chromium executable, may be downloaded if not found.
     * @returns Path to Chrome executable or undefined if installation was cancelled or
     * failed.
     */
    public async getChromiumPath(): Promise<string | undefined> {
        const found = await this.findChromiumPath();
        if (found) { return found; }

        // Prompt install or configure.
        const selection = vscode.window.showErrorMessage(
            'Cannot find Chromium. Please install or configure the path to Chromium.',
            'Install Chromium',
            'Configure Chromium Path',
            'Cancel'
        );
        const result = selection.then(async (selected) => {
            if ( !selected || selected === 'Cancel' ) {
                return;
            } else if (selected === 'Install Chromium') {
                return await this.installChromium();
            } else if ( selected === 'Configure Chromium Path' ) {
                vscode.commands.executeCommand('workbench.action.openSettings', 'markdown-export.chrome.path');
                return;
            } else {
                return;
            }
        }, (error: Error) => {
            console.error(error);
            return;
        });

        return await result;
    }

    public async installChromium(): Promise<string> {
        const installDirectory = this.ctx.globalStorageUri.fsPath;
        vscode.window.showInformationMessage(`Installing Chromium into '${installDirectory}'`);
        const statusBarMessage = vscode.window.setStatusBarMessage('Installing Chromium...');

        const onProgress = (downloadedBytes: number, totalBytes: number): void => {
            const percent = Math.round((downloadedBytes / totalBytes) * 100);
            const downloadedMegaBytes = Math.round(downloadedBytes / 1024 / 1024);
            const totalMegaBytes = Math.round(totalBytes / 1024 / 1024);
            vscode.window.setStatusBarMessage(
                `Installing Chromium : ${percent}% (${downloadedMegaBytes} MB / ${totalMegaBytes} MB)`,
                1000
            );
        };
        const onError = (error: Error): void => {
            statusBarMessage.dispose();
            vscode.window.showErrorMessage(`Failed to install Chromium: ${error}`);
        };
        const onSuccess = async (): Promise<void> => {
            const allRevisions = fetcher.localRevisions();
            const oldRevisions = allRevisions.filter((revision) => revision !== revisionToInstall);
            const removing = oldRevisions.map((revision) => fetcher.remove(revision));
            if (await this.findChromiumPath()) {
                statusBarMessage.dispose();
                vscode.window.showInformationMessage('Chromium installed.');
            } else {
                vscode.window.showErrorMessage('Install completed but couldn\'t find the executable.');
            }
            await Promise.all(removing);
        };

        const https_proxy: string = vscode.workspace.getConfiguration('http').get('proxy') || '';
        if (https_proxy) {
            process.env.HTTPS_PROXY = https_proxy;
            process.env.HTTP_PROXY = https_proxy;
        }

        const fetcher = new puppeteer.BrowserFetcher({ path: installDirectory });
        const revisionToInstall: string = (puppeteer as any).PUPPETEER_REVISIONS.chromium;
        console.info(`Installing Chromium revision ${revisionToInstall} into '${installDirectory}'...`);
        await fetcher.download(revisionToInstall, onProgress).then(onSuccess).catch(onError);

        const revisionInfo = await fetcher.revisionInfo(revisionToInstall);
        await vscode.workspace.getConfiguration('markdown-export').update('chrome.path', revisionInfo.executablePath, true);
        return revisionInfo.executablePath;
    }
}
