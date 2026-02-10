import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { Review } from "./types";

export class ReviewSidebarProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private review?: Review;
  private reviewPath?: string;
  private reviewMtime?: Date;
  private currentGroupIndex = 0;
  private explanationPanel?: vscode.WebviewPanel;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  async loadReview(filePath: string) {
    try {
      const content = await fs.promises.readFile(filePath, "utf-8");
      const stat = await fs.promises.stat(filePath);
      this.review = JSON.parse(content);
      this.reviewPath = filePath;
      this.reviewMtime = stat.mtime;
      this.currentGroupIndex = 0;

      // Close any existing diff tabs from previous review
      await this.closeAllDiffTabs();

      // Reveal the sidebar
      await vscode.commands.executeCommand("humanReview.sidebar.focus");

      this.refresh();

      // Auto-open the explanation so the main view isn't empty
      if (this.review?.explanation) {
        this.openExplanation();
      }

      vscode.window.showInformationMessage(
        `Loaded review: ${this.review?.groups.length ?? 0} groups`
      );
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

    // Open all files in the group as separate diff tabs
    for (const filePath of group.files) {
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

  private async openExplanation() {
    if (!this.review?.explanation) {
      return;
    }

    // If panel already exists, reveal it
    if (this.explanationPanel) {
      this.explanationPanel.reveal();
      return;
    }

    this.explanationPanel = vscode.window.createWebviewPanel(
      'humanReview.explanation',
      'Changes Explanation',
      vscode.ViewColumn.One,
      {}
    );

    this.explanationPanel.webview.html = await this.getExplanationHtml(this.review.explanation);

    this.explanationPanel.onDidDispose(() => {
      this.explanationPanel = undefined;
    });
  }

  private async getExplanationHtml(explanation: string): Promise<string> {
    const { marked } = await import("marked");
    const html = marked.parse(explanation) as string;
    return `<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 40px;
      max-width: 700px;
      margin: 0 auto;
      line-height: 1.6;
      font-size: 14px;
    }
    h1, h2, h3 { color: var(--vscode-foreground); font-weight: 600; }
    h1 { font-size: 18px; margin: 0 0 20px 0; }
    h2 { font-size: 16px; margin: 24px 0 12px 0; }
    h3 { font-size: 14px; margin: 20px 0 8px 0; }
    p { margin: 0 0 12px 0; }
    ul, ol { margin: 0 0 12px 0; padding-left: 24px; }
    li { margin: 0 0 4px 0; }
    code {
      font-family: var(--vscode-editor-font-family);
      font-size: 13px;
      background: var(--vscode-textCodeBlock-background);
      padding: 2px 5px;
      border-radius: 3px;
    }
    pre {
      background: var(--vscode-textCodeBlock-background);
      padding: 12px;
      border-radius: 4px;
      overflow-x: auto;
      margin: 0 0 12px 0;
    }
    pre code { background: none; padding: 0; }
  </style>
</head>
<body>
  <h1>Changes Explanation</h1>
  ${html}
</body>
</html>`;
  }

  private refresh() {
    if (!this.view || !this.review) {
      return;
    }
    this.view.webview.postMessage({ type: "update", review: this.review, mtime: this.reviewMtime?.toISOString() });
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

  async unloadReview() {
    this.review = undefined;
    this.reviewPath = undefined;
    this.reviewMtime = undefined;
    this.currentGroupIndex = 0;
    this.explanationPanel?.dispose();
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
      padding: 12px;
      border-bottom: 1px solid var(--vscode-panel-border);
      position: sticky;
      top: 0;
      background: var(--vscode-sideBar-background);
    }
    .header-date {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-top: 4px;
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
    .group {
      padding: 12px;
      border-bottom: 1px solid var(--vscode-panel-border);
      cursor: pointer;
    }
    .group:hover {
      background: var(--vscode-list-hoverBackground);
    }
    .group-title {
      font-weight: 500;
      margin-bottom: 4px;
    }
    .group-summary {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 4px;
    }
    .group-meta {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }
    .section-header {
      padding: 8px 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--vscode-descriptionForeground);
      background: var(--vscode-sideBar-background);
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    .flags {
      padding: 0;
    }
    .flag {
      padding: 8px 12px;
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
    }
    .flag-summary {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      margin-top: 2px;
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
      color: var(--vscode-descriptionForeground);
      margin-top: 2px;
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
    .group.selected .fc-green,
    .group.selected .fc-yellow,
    .group.selected .fc-red {
      color: var(--vscode-list-activeSelectionForeground);
    }
    .group.selected {
      background: var(--vscode-list-activeSelectionBackground);
      color: var(--vscode-list-activeSelectionForeground);
    }
    .group.selected:hover {
      background: var(--vscode-list-activeSelectionBackground);
    }
    .group.selected .group-summary,
    .group.selected .group-meta {
      color: var(--vscode-list-activeSelectionForeground);
      opacity: 0.9;
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

    window.addEventListener('message', e => {
      if (e.data.type === 'update') {
        render(e.data.review, e.data.mtime);
        vscode.setState({ review: e.data.review, mtime: e.data.mtime, selectedGroup: -1 });
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
      render(savedState.review, savedState.mtime);
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

    function render(review, mtime) {
      const root = document.getElementById('root');

      root.innerHTML = \`
        <div class="header">
          <div class="header-row">
            <strong>\${review.groups.length} Review Group\${review.groups.length !== 1 ? 's' : ''}</strong>
            <button class="unload-btn" onclick="unloadReview()" title="Close review">\u2715</button>
          </div>
          \${mtime ? \`<div class="header-date">\${formatDate(mtime)}</div>\` : ''}
        </div>

        \${review.explanation ? \`<div class="explanation-link" onclick="openExplanation()">Changes Explanation</div>\` : ''}

        \${review.groups.map((g, i) => \`
          <div class="group" id="group-\${i}" onclick="openGroup('\${esc(g.title)}')">
            <div class="group-title">\${i + 1}. \${esc(g.title)}</div>
            \${g.summary ? \`<div class="group-summary">\${inlineCode(g.summary)}</div>\` : ''}
            <div class="group-meta"><span class="file-count \${g.files.length < 5 ? 'fc-green' : g.files.length < 10 ? 'fc-yellow' : 'fc-red'}">\${g.files.length} file\${g.files.length !== 1 ? 's' : ''}</span></div>
          </div>
        \`).join('')}

        \${review.flags?.length ? \`
          <div class="section-header">Flags</div>
          <div class="flags">
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
          </div>
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

    function esc(s) {
      if (!s) return '';
      return String(s).replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
  </script>
</body>
</html>`;
  }
}
