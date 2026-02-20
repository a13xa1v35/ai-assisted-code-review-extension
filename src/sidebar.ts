import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as cp from "child_process";
import * as crypto from "crypto";
import { Review, ValidationResult } from "./types";
import { getSidebarHtml } from "./sidebarHtml";

/** Returns true if resolved path is inside the workspace root. */
function isInsideWorkspace(workspaceRoot: string, filePath: string): boolean {
  const resolved = path.resolve(workspaceRoot, filePath);
  return resolved.startsWith(workspaceRoot + path.sep) || resolved === workspaceRoot;
}

export const EXPLANATION_URI = vscode.Uri.parse('code-review-explanation:Explanation.md');

export class ExplanationContentProvider implements vscode.TextDocumentContentProvider {
  private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
  readonly onDidChange = this._onDidChange.event;
  private content = '';

  update(content: string) {
    this.content = content;
    this._onDidChange.fire(EXPLANATION_URI);
  }

  clear() {
    this.content = '';
    this._onDidChange.fire(EXPLANATION_URI);
  }

  provideTextDocumentContent(): string {
    return this.content;
  }
}

export class ReviewSidebarProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private review?: Review;
  private reviewPath?: string;
  private reviewMtime?: Date;
  private validation?: ValidationResult;
  private navigating = false;
  private messageDisposable?: vscode.Disposable;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly explanationProvider: ExplanationContentProvider
  ) {}

  async loadReview(filePath: string) {
    try {
      const stat = await fs.promises.stat(filePath);

      // Skip reload if same file and mtime hasn't changed
      if (this.reviewPath === filePath && this.reviewMtime && stat.mtime.getTime() === this.reviewMtime.getTime()) {
        return;
      }

      const content = await fs.promises.readFile(filePath, "utf-8");
      const parsed = JSON.parse(content);

      // Validate required fields
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Review JSON must be an object');
      }
      if (!parsed.meta || typeof parsed.meta.base !== 'string' || typeof parsed.meta.head !== 'string') {
        throw new Error('Review JSON must have meta.base and meta.head strings');
      }
      if (!Array.isArray(parsed.groups)) {
        throw new Error('Review JSON must have a groups array');
      }

      // Validate git refs don't start with '-' (could be interpreted as flags)
      const refPattern = /^[a-zA-Z0-9_.\/~^{}\-][a-zA-Z0-9_.\/~^{}\-]*$/;
      if (parsed.meta.base.startsWith('-') || parsed.meta.head.startsWith('-')) {
        throw new Error('Git refs must not start with "-"');
      }
      if (!refPattern.test(parsed.meta.base) || !refPattern.test(parsed.meta.head)) {
        throw new Error('Git refs contain invalid characters');
      }

      this.review = parsed as Review;
      this.reviewPath = filePath;
      this.reviewMtime = stat.mtime;

      // Validate files against git diff
      this.validation = await this.validateFiles(this.review!);

      // Close any existing diff tabs from previous review
      await this.closeAllDiffTabs();

      // Reveal the sidebar
      await vscode.commands.executeCommand("codeReview.sidebar.focus");

      this.refresh();

      // Auto-open the explanation so the main view isn't empty
      if (this.review?.explanation) {
        this.openExplanation();
      }

      // Show toast with validation warnings
      const missing = this.validation.missingFiles.length;
      const phantom = this.validation.phantomFiles.length;
      if (missing > 0 || phantom > 0) {
        const parts: string[] = [];
        if (missing > 0) { parts.push(`${missing} file${missing !== 1 ? 's' : ''} missing from review`); }
        if (phantom > 0) { parts.push(`${phantom} phantom file${phantom !== 1 ? 's' : ''}`); }
        vscode.window.showErrorMessage(`Review mismatch: ${parts.join(', ')}`);
      } else {
        vscode.window.showInformationMessage(
          `Loaded review: ${this.review?.groups.length ?? 0} groups`
        );
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to load review: ${error}`);
    }
  }

  async openGroup(groupIndex: number) {
    const group = this.review?.groups[groupIndex];
    if (!group || !this.review || this.navigating) {
      return;
    }
    this.navigating = true;
    try {
      // Notify webview of selection
      this.view?.webview.postMessage({ type: 'selectGroup', index: groupIndex });

      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspaceRoot) {
        vscode.window.showErrorMessage("No workspace folder open");
        return;
      }

      if (group.files.length === 0) {
        vscode.window.showWarningMessage("No files in this group");
        return;
      }

      // Close existing code-review diff tabs before opening new ones
      await this.closeAllDiffTabs();

      const baseRef = this.review.meta.base;

      // Filter out phantom files
      const phantomSet = new Set(this.validation?.phantomFiles ?? []);
      const validFiles = group.files.filter(f => !phantomSet.has(f));

      // Open all valid files in the group as separate diff tabs
      for (const filePath of validFiles) {
        if (!isInsideWorkspace(workspaceRoot, filePath)) {
          vscode.window.showWarningMessage(`Skipping file outside workspace: ${filePath}`);
          continue;
        }
        const baseUri = vscode.Uri.parse(
          `code-review-git:${filePath}?ref=${baseRef}`
        );
        const headUri = vscode.Uri.file(path.join(workspaceRoot, filePath));

        try {
          await vscode.commands.executeCommand(
            "vscode.diff",
            baseUri,
            headUri,
            `${filePath} — ${group.title}`
          );
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to open diff for ${filePath}: ${error}`
          );
        }
      }
    } finally {
      this.navigating = false;
    }
  }

  private async validateFiles(review: Review): Promise<ValidationResult> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      return { missingFiles: [], phantomFiles: [] };
    }

    const base = review.meta.base;
    const head = review.meta.head;

    // Get actual changed files from git
    const diffFiles = await new Promise<string[]>((resolve) => {
      cp.execFile(
        'git',
        ['diff', '--name-only', `${base}..${head}`],
        { cwd: workspaceRoot, maxBuffer: 10 * 1024 * 1024, timeout: 30_000 },
        (error, stdout) => {
          if (error) {
            resolve([]);
            return;
          }
          resolve(stdout.trim().split('\n').filter(Boolean));
        }
      );
    });

    const diffSet = new Set(diffFiles);

    // Collect all files referenced in the review
    const reviewFiles = new Set<string>();
    for (const group of review.groups) {
      for (const file of group.files) {
        reviewFiles.add(file);
      }
    }
    if (review.flags) {
      for (const flag of review.flags) {
        reviewFiles.add(flag.file);
      }
    }

    const missingFiles = diffFiles.filter(f => !reviewFiles.has(f));
    const phantomFiles = [...reviewFiles].filter(f => !diffSet.has(f));

    return { missingFiles, phantomFiles };
  }

  private async openSingleFile(filePath: string) {
    if (this.validation?.phantomFiles.includes(filePath)) {
      vscode.window.showWarningMessage(`Cannot open diff: ${filePath} is not in the git diff`);
      return;
    }
    if (this.navigating) { return; }
    this.navigating = true;
    try {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspaceRoot || !this.review) {
        return;
      }

      if (!isInsideWorkspace(workspaceRoot, filePath)) {
        vscode.window.showWarningMessage(`Cannot open file outside workspace: ${filePath}`);
        return;
      }

      const baseRef = this.review.meta.base;
      const baseUri = vscode.Uri.parse(
        `code-review-git:${filePath}?ref=${baseRef}`
      );
      const headUri = vscode.Uri.file(path.join(workspaceRoot, filePath));

      await vscode.commands.executeCommand(
        "vscode.diff",
        baseUri,
        headUri,
        filePath
      );
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to open diff for ${filePath}: ${error}`
      );
    } finally {
      this.navigating = false;
    }
  }

  private async openExplanation() {
    if (!this.review?.explanation) {
      return;
    }

    this.explanationProvider.update(this.review.explanation);

    // Close any existing explanation tab so a fresh preview gets focus
    await this.closeExplanationTab();

    try {
      await vscode.commands.executeCommand('markdown.showPreview', EXPLANATION_URI);
    } catch {
      // Fallback: open as raw markdown with syntax highlighting
      const doc = await vscode.workspace.openTextDocument(EXPLANATION_URI);
      await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.One, preview: true });
    }
  }

  private refresh() {
    if (!this.view || !this.review) {
      return;
    }
    this.view.webview.postMessage({ type: "update", review: this.review, mtime: this.reviewMtime?.toISOString(), validation: this.validation });
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this.view = webviewView;
    const mediaUri = vscode.Uri.joinPath(this._extensionUri, 'media');
    webviewView.webview.options = { enableScripts: true, localResourceRoots: [mediaUri] };
    webviewView.webview.html = this.getHtml();

    // Dispose previous handler if resolveWebviewView is called again
    this.messageDisposable?.dispose();
    this.messageDisposable = webviewView.webview.onDidReceiveMessage(async (msg) => {
      if (msg.type === "openGroup") {
        this.openGroup(msg.groupIndex);
      } else if (msg.type === "openFlag") {
        await vscode.env.clipboard.writeText(msg.clipText);
        vscode.window.setStatusBarMessage("Copied to clipboard", 2000);
        this.openFlag(msg.file, msg.line);
      } else if (msg.type === "openExplanation") {
        this.openExplanation();
      } else if (msg.type === "openFile") {
        this.openSingleFile(msg.file);
      } else if (msg.type === "selectFile") {
        this.promptSelectFile();
      } else if (msg.type === "unloadReview") {
        this.unloadReview();
      } else if (msg.type === "ready") {
        // Webview finished loading — sync state
        if (this.review) {
          this.refresh();
        } else {
          // No review loaded: clear any stale webview state (e.g. file was deleted while sidebar was hidden)
          this.view?.webview.postMessage({ type: 'reset' });
        }
      }
    });
  }

  private async openFlag(file: string, line: number) {
    if (this.validation?.phantomFiles.includes(file)) {
      vscode.window.showWarningMessage(`Cannot open diff: ${file} is not in the git diff`);
      return;
    }
    if (this.navigating) { return; }
    this.navigating = true;
    try {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspaceRoot || !this.review) {
        return;
      }

      if (!isInsideWorkspace(workspaceRoot, file)) {
        vscode.window.showWarningMessage(`Cannot open file outside workspace: ${file}`);
        return;
      }

      const baseRef = this.review.meta.base;
      const baseUri = vscode.Uri.parse(
        `code-review-git:${file}?ref=${baseRef}`
      );
      const headUri = vscode.Uri.file(path.join(workspaceRoot, file));

      await vscode.commands.executeCommand(
        "vscode.diff",
        baseUri,
        headUri,
        `${file} — Flag`
      );

      // Wait for the diff editor to become active before scrolling
      const editor = await new Promise<vscode.TextEditor | undefined>((resolve) => {
        const current = vscode.window.activeTextEditor;
        if (current && current.document.uri.fsPath.endsWith(file)) {
          resolve(current);
          return;
        }
        const timeout = setTimeout(() => { d.dispose(); resolve(undefined); }, 2000);
        const d = vscode.window.onDidChangeActiveTextEditor((e) => {
          if (e && e.document.uri.fsPath.endsWith(file)) { clearTimeout(timeout); d.dispose(); resolve(e); }
        });
      });
      if (editor) {
        const pos = new vscode.Position(line - 1, 0);
        editor.revealRange(
          new vscode.Range(pos, pos),
          vscode.TextEditorRevealType.InCenter
        );
        editor.selection = new vscode.Selection(pos, pos);
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to open diff for ${file}: ${error}`
      );
    } finally {
      this.navigating = false;
    }
  }

  private async closeAllDiffTabs() {
    for (const tabGroup of vscode.window.tabGroups.all) {
      const tabsToClose = tabGroup.tabs.filter((tab) => {
        if (tab.input instanceof vscode.TabInputTextDiff) {
          return tab.input.original.scheme === 'code-review-git';
        }
        return false;
      });
      if (tabsToClose.length > 0) {
        await vscode.window.tabGroups.close(tabsToClose);
      }
    }
  }

  private async closeExplanationTab() {
    for (const tabGroup of vscode.window.tabGroups.all) {
      const tabsToClose = tabGroup.tabs.filter((tab) => {
        // Raw markdown fallback
        if (tab.input instanceof vscode.TabInputText) {
          return tab.input.uri.scheme === 'code-review-explanation';
        }
        // Rendered markdown preview (webview)
        if (tab.input instanceof vscode.TabInputWebview) {
          return tab.label.includes('Explanation.md');
        }
        return false;
      });
      if (tabsToClose.length > 0) {
        await vscode.window.tabGroups.close(tabsToClose);
      }
    }
  }

  async unloadReview() {
    this.review = undefined;
    this.reviewPath = undefined;
    this.reviewMtime = undefined;
    this.validation = undefined;
    this.explanationProvider.clear();
    await this.closeExplanationTab();
    await this.closeAllDiffTabs();
    if (this.view) {
      this.view.webview.postMessage({ type: 'reset' });
    }
  }

  async promptSelectFile() {
    const file = await this.showFilePickerWithHidden();
    if (file) {
      this.loadReview(file);
    }
  }

  private async showFilePickerWithHidden(): Promise<string | undefined> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      vscode.window.showErrorMessage("No workspace folder open");
      return undefined;
    }

    // Recursively find all JSON files including in hidden directories
    const jsonFiles = await this.findJsonFilesRecursive(workspaceRoot);

    const items: vscode.QuickPickItem[] = jsonFiles.map((filePath) => {
      const relativePath = path.relative(workspaceRoot, filePath);
      const fileName = path.basename(filePath);
      return {
        label: fileName,
        description: relativePath,
        detail: filePath,
      };
    });

    // Sort by path
    items.sort((a, b) =>
      (a.description || "").localeCompare(b.description || "")
    );

    const picked = await vscode.window.showQuickPick(items, {
      placeHolder: "Type to filter JSON files...",
      title: "Open Review File",
      matchOnDescription: true,
    });

    if (!picked) {
      return undefined;
    }

    return picked.detail;
  }

  private async findJsonFilesRecursive(dir: string): Promise<string[]> {
    const results: string[] = [];
    const skipDirs = new Set(["node_modules", ".git", "dist", "out", "build"]);
    const maxDepth = 10;
    const visited = new Set<string>();

    const scan = async (currentDir: string, depth: number) => {
      if (depth > maxDepth) { return; }

      // Resolve real path to detect symlink loops
      let realPath: string;
      try {
        realPath = await fs.promises.realpath(currentDir);
      } catch {
        return;
      }
      if (visited.has(realPath)) { return; }
      visited.add(realPath);

      try {
        const entries = await fs.promises.readdir(currentDir, {
          withFileTypes: true,
        });

        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);

          if (entry.isDirectory()) {
            // Skip common large directories but include hidden ones
            if (!skipDirs.has(entry.name)) {
              await scan(fullPath, depth + 1);
            }
          } else if (entry.name.endsWith(".json")) {
            results.push(fullPath);
          }
        }
      } catch {
        // Ignore permission errors
      }
    };

    await scan(dir, 0);
    return results;
  }

  private getHtml(): string {
    const nonce = crypto.randomBytes(16).toString('base64');
    const codiconFontUri = this.view!.webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'codicon.ttf')
    );
    return getSidebarHtml(nonce, codiconFontUri.toString(), this.view!.webview.cspSource);
  }
}
