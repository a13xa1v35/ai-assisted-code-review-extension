import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as cp from "child_process";
import { Review, ValidationResult } from "./types";

export const EXPLANATION_URI = vscode.Uri.parse('human-review-explanation:Explanation.md');

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
  private currentGroupIndex = 0;
  private validation?: ValidationResult;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly explanationProvider: ExplanationContentProvider
  ) {}

  async loadReview(filePath: string) {
    try {
      const content = await fs.promises.readFile(filePath, "utf-8");
      const stat = await fs.promises.stat(filePath);
      this.review = JSON.parse(content);
      this.reviewPath = filePath;
      this.reviewMtime = stat.mtime;
      this.currentGroupIndex = 0;

      // Validate files against git diff
      this.validation = await this.validateFiles(this.review!);

      // Close any existing diff tabs from previous review
      await this.closeAllDiffTabs();

      // Reveal the sidebar
      await vscode.commands.executeCommand("humanReview.sidebar.focus");

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

  async openGroup(groupTitle: string) {
    const group = this.review?.groups.find((g) => g.title === groupTitle);
    if (!group || !this.review) {
      return;
    }

    // Update current index
    const index = this.review.groups.findIndex((g) => g.title === groupTitle);
    if (index !== -1) {
      this.currentGroupIndex = index;
    }

    // Notify webview of selection
    this.view?.webview.postMessage({ type: 'selectGroup', index: this.currentGroupIndex });

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      vscode.window.showErrorMessage("No workspace folder open");
      return;
    }

    if (group.files.length === 0) {
      vscode.window.showWarningMessage("No files in this group");
      return;
    }

    // Close existing human-review diff tabs before opening new ones
    await this.closeAllDiffTabs();

    const baseRef = this.review.meta.base;

    // Filter out phantom files
    const phantomSet = new Set(this.validation?.phantomFiles ?? []);
    const validFiles = group.files.filter(f => !phantomSet.has(f));

    // Open all valid files in the group as separate diff tabs
    for (const filePath of validFiles) {
      const baseUri = vscode.Uri.parse(
        `human-review-git:${filePath}?ref=${baseRef}`
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
      cp.exec(
        `git diff --name-only ${base}..${head}`,
        { cwd: workspaceRoot, maxBuffer: 10 * 1024 * 1024 },
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

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot || !this.review) {
      return;
    }

    const baseRef = this.review.meta.base;
    const baseUri = vscode.Uri.parse(
      `human-review-git:${filePath}?ref=${baseRef}`
    );
    const headUri = vscode.Uri.file(path.join(workspaceRoot, filePath));

    await this.closeAllDiffTabs();

    try {
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
    }
  }

  private async openExplanation() {
    if (!this.review?.explanation) {
      return;
    }

    this.explanationProvider.update(this.review.explanation);

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
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this.getHtml();

    webviewView.webview.onDidReceiveMessage((msg) => {
      if (msg.type === "openGroup") {
        this.openGroup(msg.groupTitle);
      } else if (msg.type === "openFlag") {
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
        // Webview finished loading, send current review if we have one
        if (this.review) {
          this.refresh();
        }
      }
    });
  }

  private async openFlag(file: string, line: number) {
    if (this.validation?.phantomFiles.includes(file)) {
      vscode.window.showWarningMessage(`Cannot open diff: ${file} is not in the git diff`);
      return;
    }

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot || !this.review) {
      return;
    }

    const baseRef = this.review.meta.base;
    const baseUri = vscode.Uri.parse(
      `human-review-git:${file}?ref=${baseRef}`
    );
    const headUri = vscode.Uri.file(path.join(workspaceRoot, file));

    await this.closeAllDiffTabs();

    try {
      await vscode.commands.executeCommand(
        "vscode.diff",
        baseUri,
        headUri,
        `${file} — Flag`
      );

      // Scroll to the flag's line in the diff editor
      const editor = vscode.window.activeTextEditor;
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
    }
  }

  private async closeAllDiffTabs() {
    for (const tabGroup of vscode.window.tabGroups.all) {
      const tabsToClose = tabGroup.tabs.filter((tab) => {
        if (tab.input instanceof vscode.TabInputTextDiff) {
          return tab.input.original.scheme === 'human-review-git';
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
        if (tab.input instanceof vscode.TabInputText) {
          return tab.input.uri.scheme === 'human-review-explanation';
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
    this.currentGroupIndex = 0;
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

    const scan = async (currentDir: string) => {
      try {
        const entries = await fs.promises.readdir(currentDir, {
          withFileTypes: true,
        });

        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);

          if (entry.isDirectory()) {
            // Skip common large directories but include hidden ones
            if (!skipDirs.has(entry.name)) {
              await scan(fullPath);
            }
          } else if (entry.name.endsWith(".json")) {
            results.push(fullPath);
          }
        }
      } catch {
        // Ignore permission errors
      }
    };

    await scan(dir);
    return results;
  }

  private getHtml(): string {
    return `<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: var(--vscode-font-family);
      font-size: 13px;
      line-height: 1.5;
      padding: 0;
      margin: 0;
      color: var(--vscode-foreground);
    }
    .empty {
      padding: 20px;
      text-align: center;
      color: var(--vscode-descriptionForeground);
    }
    .header {
      padding: 10px 12px;
      border-bottom: 1px solid var(--vscode-panel-border);
      background: var(--vscode-sideBar-background);
    }
    .explanation-link {
      padding: 10px 12px;
      font-size: 12px;
      color: var(--vscode-textLink-foreground);
      border-bottom: 1px solid var(--vscode-panel-border);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .explanation-link:hover {
      background: var(--vscode-list-hoverBackground);
    }
    .explanation-spacer {
      flex: 1;
    }
    .explanation-date {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      white-space: nowrap;
    }
    .group {
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    .group-header {
      padding: 12px;
      cursor: pointer;
      line-height: 1.4;
    }
    .group-header:hover {
      background: var(--vscode-list-hoverBackground);
    }
    .group-title {
      font-weight: 500;
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .group-title-text {
      flex: 1;
      min-width: 0;
    }
    .group-summary {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      line-height: 1.5;
    }
    .group-meta {
      padding: 8px 12px;
      color: var(--vscode-descriptionForeground);
      border-top: 1px solid var(--vscode-panel-border);
    }
    .group-meta:hover {
      background: var(--vscode-list-hoverBackground);
    }
    .section-header {
      padding: 10px 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--vscode-descriptionForeground);
      background: var(--vscode-sideBar-background);
      border-bottom: 1px solid var(--vscode-panel-border);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
      user-select: none;
    }
    .section-header:hover {
      background: var(--vscode-list-hoverBackground);
    }
    .flags {
      padding: 0;
    }
    .flag {
      padding: 10px 12px;
      font-size: 12px;
      display: flex;
      align-items: flex-start;
      gap: 8px;
      cursor: pointer;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    .flag:hover {
      background: var(--vscode-list-hoverBackground);
    }
    .flag.selected {
      background: var(--vscode-list-activeSelectionBackground);
      color: var(--vscode-list-activeSelectionForeground);
    }
    .flag.selected:hover {
      background: var(--vscode-list-activeSelectionBackground);
    }
    .flag.selected .flag-summary,
    .flag.selected .flag-location {
      color: var(--vscode-list-activeSelectionForeground);
      opacity: 0.9;
    }
    .flag.selected .flag-icon {
      color: var(--vscode-list-activeSelectionForeground);
    }
    .flag-icon {
      flex-shrink: 0;
    }
    .flag-info .flag-icon { color: var(--vscode-editorInfo-foreground); }
    .flag-warning .flag-icon { color: var(--vscode-editorWarning-foreground); }
    .flag-error .flag-icon { color: var(--vscode-editorError-foreground); }
    .flag-content {
      flex: 1;
      min-width: 0;
    }
    .flag-title {
      font-weight: 500;
      line-height: 1.4;
    }
    .flag-summary {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      margin-top: 6px;
      line-height: 1.5;
    }
    .group-summary code, .flag-summary code {
      font-family: var(--vscode-editor-font-family);
      font-size: 0.9em;
      background: var(--vscode-textCodeBlock-background);
      padding: 1px 4px;
      border-radius: 3px;
    }
    .flag-location {
      font-size: 11px;
      color: var(--vscode-textLink-foreground);
      margin-top: 6px;
    }
    .flag-copy {
      flex-shrink: 0;
      background: none;
      border: none;
      color: var(--vscode-descriptionForeground);
      cursor: pointer;
      font-size: 16px;
      padding: 4px 6px;
      border-radius: 3px;
      opacity: 0;
      transition: opacity 0.15s;
    }
    .flag:hover .flag-copy {
      opacity: 1;
    }
    .flag-copy:hover {
      background: var(--vscode-toolbar-hoverBackground);
      color: var(--vscode-foreground);
    }
.select-btn {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 8px 16px;
      cursor: pointer;
      border-radius: 2px;
      font-size: 13px;
      margin-top: 12px;
    }
    .select-btn:hover {
      background: var(--vscode-button-hoverBackground);
    }
    .fc-green { color: var(--vscode-testing-iconPassed); }
    .fc-yellow { color: var(--vscode-editorWarning-foreground); }
    .fc-red { color: var(--vscode-editorError-foreground); }
    .group.selected .group-header {
      background: var(--vscode-list-activeSelectionBackground);
      color: var(--vscode-list-activeSelectionForeground);
    }
    .group.selected .group-header:hover {
      background: var(--vscode-list-activeSelectionBackground);
    }
    .group.selected .group-summary {
      color: var(--vscode-list-activeSelectionForeground);
      opacity: 0.9;
    }
    .group.selected .group-header .fc-green,
    .group.selected .group-header .fc-yellow,
    .group.selected .group-header .fc-red {
      color: var(--vscode-list-activeSelectionForeground);
    }
    .group.selected .tree-group-badge {
      color: var(--vscode-list-activeSelectionForeground);
      opacity: 0.8;
    }
    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .unload-btn {
      background: none;
      border: none;
      color: var(--vscode-descriptionForeground);
      cursor: pointer;
      font-size: 14px;
      padding: 4px 6px;
      border-radius: 3px;
      line-height: 1;
    }
    .unload-btn:hover {
      background: var(--vscode-toolbar-hoverBackground);
      color: var(--vscode-foreground);
    }
    .group-file-tree {
      padding: 4px 0 8px 0;
      border-top: 1px solid var(--vscode-panel-border);
    }
    .tree-prefix-line {
      padding: 3px 8px 3px 24px;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }
    .file-count-toggle {
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 13px;
    }
    .tree-dir {
      padding: 3px 8px;
      cursor: pointer;
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 4px;
      user-select: none;
    }
    .tree-dir:hover {
      background: var(--vscode-list-hoverBackground);
    }
    .tree-chevron {
      font-size: 10px;
      width: 12px;
      text-align: center;
      flex-shrink: 0;
    }
    .tree-file {
      padding: 3px 8px;
      cursor: pointer;
      font-size: 12px;
      user-select: none;
      color: var(--vscode-textLink-foreground);
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .tree-file:hover {
      background: var(--vscode-list-hoverBackground);
    }
    .tree-file-icon {
      font-size: 10px;
      flex-shrink: 0;
    }
    .tree-group-badge {
      font-size: 11px;
      min-width: 16px;
      height: 16px;
      line-height: 16px;
      text-align: center;
      border-radius: 3px;
      color: var(--vscode-descriptionForeground);
      font-weight: 500;
    }
    .validation-banner {
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    .validation-header {
      padding: 10px 12px;
      font-size: 12px;
      color: var(--vscode-editorError-foreground);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      user-select: none;
    }
    .validation-header:hover {
      background: var(--vscode-list-hoverBackground);
    }
    .validation-content {
      padding: 0 12px 8px 12px;
      font-size: 12px;
    }
    .validation-subtitle {
      font-size: 11px;
      font-weight: 600;
      color: var(--vscode-descriptionForeground);
      margin: 8px 0 4px 0;
    }
    .phantom-file {
      color: var(--vscode-descriptionForeground);
      cursor: default;
    }
    .phantom-file:hover {
      background: none !important;
    }
  </style>
</head>
<body>
  <div id="root">
    <div class="empty">
      <p>No review loaded</p>
      <p style="font-size: 12px;">Select a review JSON file to get started.</p>
      <button class="select-btn" onclick="selectFile()">Select Review File</button>
    </div>
  </div>
  <script>
    const vscode = acquireVsCodeApi();
    let _phantomSet = new Set();

    window.addEventListener('message', e => {
      if (e.data.type === 'update') {
        render(e.data.review, e.data.mtime, e.data.validation);
        const prev = vscode.getState() || {};
        vscode.setState({ review: e.data.review, mtime: e.data.mtime, validation: e.data.validation, selectedGroup: -1, collapsedDirs: prev.collapsedDirs || [], expandedGroups: prev.expandedGroups || [] });
      } else if (e.data.type === 'selectGroup') {
        highlightGroup(e.data.index);
        const state = vscode.getState() || {};
        vscode.setState({ ...state, selectedGroup: e.data.index, selectedFlag: -1 });
      } else if (e.data.type === 'reset') {
        showEmpty();
        vscode.setState({});
      }
    });

    // Restore state when webview is re-created (e.g. after switching views)
    const savedState = vscode.getState();
    if (savedState?.review) {
      render(savedState.review, savedState.mtime, savedState.validation);
      if (savedState.selectedFlag >= 0) {
        highlightFlag(savedState.selectedFlag);
      } else if (savedState.selectedGroup >= 0) {
        highlightGroup(savedState.selectedGroup);
      }
    }

    // Tell the extension we're ready to receive data
    vscode.postMessage({ type: 'ready' });

    function inlineCode(text) {
      return esc(text).replace(/\`([^\`]+)\`/g, '<code>$1</code>');
    }

    function formatDate(iso) {
      if (!iso) return '';
      const d = new Date(iso);
      return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    function render(review, mtime, validation) {
      const root = document.getElementById('root');
      const state = vscode.getState() || {};
      const expandedGroups = state.expandedGroups || [];
      const groupsCollapsed = state.groupsCollapsed || false;
      const flagsCollapsed = state.flagsCollapsed || false;
      const validationCollapsed = state.validationCollapsed || false;
      _phantomSet = new Set(validation?.phantomFiles || []);
      const hasWarnings = validation && (validation.missingFiles.length > 0 || validation.phantomFiles.length > 0);

      root.innerHTML = \`
        \${review.explanation ? \`<div class="explanation-link" onclick="openExplanation()">
          <span>Changes Explanation</span>
          <span class="explanation-spacer"></span>
          \${mtime ? \`<span class="explanation-date">\${formatDate(mtime)}</span>\` : ''}
          <button class="unload-btn" onclick="event.stopPropagation(); unloadReview()" title="Close review">\u2715</button>
        </div>\` : \`<div class="header">
          <div class="header-row">
            <span></span>
            <button class="unload-btn" onclick="unloadReview()" title="Close review">\u2715</button>
          </div>
        </div>\`}

        \${hasWarnings ? \`<div class="validation-banner">
          <div class="validation-header" onclick="toggleSection('validation')">
            <span>\u2716</span>
            <span>Error: \${validation.missingFiles.length ? validation.missingFiles.length + ' missing' : ''}\${validation.missingFiles.length && validation.phantomFiles.length ? ', ' : ''}\${validation.phantomFiles.length ? validation.phantomFiles.length + ' phantom' : ''}</span>
            <span class="tree-chevron">\${validationCollapsed ? '\u25B8' : '\u25BE'}</span>
          </div>
          \${!validationCollapsed ? \`<div class="validation-content">
            \${validation.phantomFiles.length ? \`<div class="validation-subtitle">Phantom files (not in diff)</div>\${validation.phantomFiles.map(f => '<div style="padding: 2px 0; color: var(--vscode-descriptionForeground);"><span style="color: var(--vscode-editorError-foreground)">\u2716</span> <span style="text-decoration: line-through">' + esc(f) + '</span></div>').join('')}\` : ''}
            \${validation.missingFiles.length ? \`<div class="validation-subtitle">Missing from review</div>\${buildGroupTree(validation.missingFiles, 'missing')}\` : ''}
          </div>\` : ''}
        </div>\` : ''}

        <div class="section-header" onclick="toggleSection('groups')"><span class="tree-chevron">\${groupsCollapsed ? '\u25B8' : '\u25BE'}</span>\${review.groups.length} Review Group\${review.groups.length !== 1 ? 's' : ''}</div>

        \${!groupsCollapsed ? review.groups.map((g, i) => \`
          <div class="group" id="group-\${i}">
            <div class="group-header" onclick="openGroup('\${esc(g.title)}')">
              <div class="group-title"><span class="tree-group-badge">\${i + 1}</span><span class="group-title-text">\${esc(g.title)}</span></div>
              \${g.summary ? \`<div class="group-summary">\${inlineCode(g.summary)}</div>\` : ''}
            </div>
            <div class="group-meta" onclick="toggleGroupFiles(\${i})"><span class="file-count-toggle \${g.files.length < 5 ? 'fc-green' : g.files.length < 10 ? 'fc-yellow' : 'fc-red'}"><span class="tree-chevron">\${expandedGroups.includes(i) ? '\u25BE' : '\u25B8'}</span>\${g.files.length} file\${g.files.length !== 1 ? 's' : ''}</span></div>
            \${expandedGroups.includes(i) ? buildGroupTree(g.files, i) : ''}
          </div>
        \`).join('') : ''}

        \${review.flags?.length ? \`
          <div class="section-header" onclick="toggleSection('flags')"><span class="tree-chevron">\${flagsCollapsed ? '\u25B8' : '\u25BE'}</span>Flags</div>
          \${!flagsCollapsed ? \`<div class="flags">
            \${review.flags.map((f, i) => \`
              <div class="flag flag-\${f.severity}" id="flag-\${i}" onclick="openFlag('\${esc(f.file)}', \${f.line}, \${i})">
                <span class="flag-icon">\${f.severity === 'error' ? '\u2716' : f.severity === 'warning' ? '\u26A0' : '\u24D8'}</span>
                <div class="flag-content">
                  <div class="flag-title">\${esc(f.title)}</div>
                  \${f.summary ? \`<div class="flag-summary">\${inlineCode(f.summary)}</div>\` : ''}
                  <div class="flag-location">\${esc(f.file)}:\${f.line}</div>
                </div>
                <button class="flag-copy" onclick="copyFlag(event, '\${esc(f.title)}', '\${esc(f.summary || '')}')" title="Copy to clipboard">\u2398</button>
              </div>
            \`).join('')}
          </div>\` : ''}
        \` : ''}

      \`;
    }

    function openGroup(title) {
      vscode.postMessage({ type: 'openGroup', groupTitle: title });
    }

    function openFlag(file, line, index) {
      highlightFlag(index);
      const state = vscode.getState() || {};
      vscode.setState({ ...state, selectedGroup: -1, selectedFlag: index });
      vscode.postMessage({ type: 'openFlag', file: file, line: line });
    }

    function copyFlag(event, title, summary) {
      event.stopPropagation();
      const text = summary ? title + ' | ' + summary : title;
      navigator.clipboard.writeText(text);
    }

    function openExplanation() {
      vscode.postMessage({ type: 'openExplanation' });
    }

    function selectFile() {
      vscode.postMessage({ type: 'selectFile' });
    }

    function unloadReview() {
      vscode.postMessage({ type: 'unloadReview' });
    }

    function highlightGroup(index) {
      document.querySelectorAll('.group').forEach((el, i) => {
        el.classList.toggle('selected', i === index);
      });
      document.querySelectorAll('.flag').forEach(el => {
        el.classList.remove('selected');
      });
    }

    function highlightFlag(index) {
      document.querySelectorAll('.group').forEach(el => {
        el.classList.remove('selected');
      });
      document.querySelectorAll('.flag').forEach((el, i) => {
        el.classList.toggle('selected', i === index);
      });
    }

    function showEmpty() {
      document.getElementById('root').innerHTML = \`
        <div class="empty">
          <p>No review loaded</p>
          <p style="font-size: 12px;">Select a review JSON file to get started.</p>
          <button class="select-btn" onclick="selectFile()">Select Review File</button>
        </div>
      \`;
    }

    function buildGroupTree(files, groupIndex) {
      if (files.length === 0) return '';

      const parts = files.map(f => f.split('/'));
      let commonLen = 0;
      if (parts.length > 0) {
        for (let i = 0; i < parts[0].length - 1; i++) {
          if (parts.every(p => i < p.length - 1 && p[i] === parts[0][i])) {
            commonLen = i + 1;
          } else break;
        }
      }
      const prefix = commonLen > 0 ? parts[0].slice(0, commonLen).join('/') + '/' : '';

      const tree = {};
      for (const file of files) {
        const segs = file.split('/').slice(commonLen);
        let node = tree;
        for (let i = 0; i < segs.length; i++) {
          if (i === segs.length - 1) {
            node[segs[i]] = file;
          } else {
            if (!node[segs[i]] || typeof node[segs[i]] === 'string') node[segs[i]] = {};
            node = node[segs[i]];
          }
        }
      }

      const state = vscode.getState() || {};
      const collapsed = state.collapsedDirs || [];
      const gp = 'g' + groupIndex + ':';

      function compactDir(name, obj) {
        const entries = Object.entries(obj);
        const dirs = entries.filter(([, v]) => v !== null && typeof v === 'object');
        const fl = entries.filter(([, v]) => typeof v === 'string');
        if (dirs.length === 1 && fl.length === 0) {
          return compactDir(name + '/' + dirs[0][0], dirs[0][1]);
        }
        return { label: name, node: obj };
      }

      function renderNode(obj, depth, pathPrefix) {
        let h = '';
        const entries = Object.entries(obj);
        const dirs = entries.filter(([, v]) => v !== null && typeof v === 'object').sort((a, b) => a[0].localeCompare(b[0]));
        const leaves = entries.filter(([, v]) => typeof v === 'string').sort((a, b) => a[0].localeCompare(b[0]));
        for (const [name, children] of dirs) {
          const compacted = compactDir(name, children);
          const dp = pathPrefix ? pathPrefix + '/' + compacted.label : compacted.label;
          const key = gp + dp;
          const ic = collapsed.includes(key);
          h += '<div class="tree-dir" style="padding-left:' + (depth * 16 + 8) + 'px" data-path="' + esc(key) + '" onclick="event.stopPropagation(); toggleDir(this.dataset.path)">';
          h += '<span class="tree-chevron">' + (ic ? '\u25B8' : '\u25BE') + '</span>' + esc(compacted.label);
          h += '</div>';
          if (!ic) h += renderNode(compacted.node, depth + 1, dp);
        }
        for (const [name, fullPath] of leaves) {
          if (_phantomSet.has(fullPath)) {
            h += '<div class="tree-file phantom-file" style="padding-left:' + (depth * 16 + 24) + 'px">';
            h += '<span class="tree-file-icon" style="color: var(--vscode-editorError-foreground)">\u2716</span><span style="text-decoration: line-through">' + esc(name) + '</span>';
            h += '</div>';
          } else {
            h += '<div class="tree-file" style="padding-left:' + (depth * 16 + 24) + 'px" data-path="' + esc(fullPath) + '" onclick="event.stopPropagation(); openFile(this.dataset.path)">';
            h += '<span class="tree-file-icon">\u25A0</span>' + esc(name);
            h += '</div>';
          }
        }
        return h;
      }

      let html = '<div class="group-file-tree">';
      if (prefix) html += '<div class="tree-prefix-line">' + esc(prefix) + '</div>';
      html += renderNode(tree, 0, '');
      html += '</div>';
      return html;
    }

    function toggleSection(section) {
      const state = vscode.getState() || {};
      const key = section + 'Collapsed';
      vscode.setState({ ...state, [key]: !state[key] });
      if (state.review) {
        render(state.review, state.mtime, state.validation);
        if (state.selectedFlag >= 0) highlightFlag(state.selectedFlag);
        else if (state.selectedGroup >= 0) highlightGroup(state.selectedGroup);
      }
    }

    function toggleGroupFiles(index) {
      const state = vscode.getState() || {};
      let expanded = state.expandedGroups || [];
      if (expanded.includes(index)) {
        expanded = expanded.filter(i => i !== index);
      } else {
        expanded.push(index);
      }
      vscode.setState({ ...state, expandedGroups: expanded });
      if (state.review) {
        render(state.review, state.mtime, state.validation);
        if (state.selectedFlag >= 0) highlightFlag(state.selectedFlag);
        else if (state.selectedGroup >= 0) highlightGroup(state.selectedGroup);
      }
    }

    function toggleDir(dirPath) {
      const state = vscode.getState() || {};
      let collapsed = state.collapsedDirs || [];
      if (collapsed.includes(dirPath)) {
        collapsed = collapsed.filter(d => d !== dirPath);
      } else {
        collapsed.push(dirPath);
      }
      vscode.setState({ ...state, collapsedDirs: collapsed });
      if (state.review) {
        render(state.review, state.mtime, state.validation);
        if (state.selectedFlag >= 0) highlightFlag(state.selectedFlag);
        else if (state.selectedGroup >= 0) highlightGroup(state.selectedGroup);
      }
    }

    function openFile(filePath) {
      vscode.postMessage({ type: 'openFile', file: filePath });
    }

    function esc(s) {
      if (!s) return '';
      return String(s).replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
  </script>
</body>
</html>`;
  }
}
