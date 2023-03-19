import * as vscode from 'vscode';
import * as path from 'path';
import * as marked from 'marked';
import DOMPurify from 'dompurify';
import  { JSDOM } from 'jsdom';
import * as puppeteer from 'puppeteer-core';
import * as chromium from './chromium';

export class ExportMarkdown {
    ctx: vscode.ExtensionContext;
    constructor(ctx: vscode.ExtensionContext) {
        this.ctx = ctx;
    }

    public async export(outFormat: string): Promise<void> {
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor; cannot find file to export');
                return;
            }

            const text = editor.document.getText();
            const fileName = path.parse(editor.document.fileName);

            const defaultOutFileName = fileName.ext === '.md'
                ? `${fileName.name}.${outFormat}`
                : `${fileName.base}.${outFormat}`;
            const defaultOutUri = vscode.Uri.file(defaultOutFileName);

            if (outFormat.toLowerCase() == 'html') {
                const content = await this.toHTML(text);
                await this.save(content, defaultOutUri);
                return;
            } else if (outFormat.toLowerCase() == 'pdf') {
                const content = await this.toPdf(text);
                if (!content) { return; }
                await this.save(content, defaultOutUri);
                return;
            }

        } catch (error) {
            console.error(error);
            vscode.window.showErrorMessage(`Error saving file; ${error}`);
        }
    }

    public async save( content: string | Buffer, defaultSavePath: vscode.Uri ): Promise<void> {
        const savePath = await vscode.window.showSaveDialog( { defaultUri: defaultSavePath } );
        if (!savePath) { return; }
        if (typeof(content) == 'string'){ content = Buffer.from(content); }

        await vscode.workspace.fs.writeFile(savePath, content);
        vscode.window.showInformationMessage(`File saved to ${savePath.fsPath}`);
    }

    private async toHTML( text: string ): Promise<string> {
        const window = new JSDOM('').window;
        const sanitizer = DOMPurify(window);

        const html = marked.parse(text);
        const clean = sanitizer.sanitize(html);
        return clean;
    }

    private async toPdf( text: string ): Promise<Buffer | undefined> {
        const chromiumChecker = new chromium.ChromiumHandler(this.ctx);
        const chromiumPath = await chromiumChecker.getChromiumPath();
        if (!chromiumPath) { return; }

        const htmlText = await this.toHTML(text);
        const browser = await puppeteer.launch({ executablePath: chromiumPath });
        const page = await browser.newPage();
        await page.setContent(htmlText);
        const pdfBuffer = await page.pdf({ format: 'A4' });
        await browser.close();
        return pdfBuffer;
    }
}
