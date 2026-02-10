import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { Review, Group } from "./types";

export class ReviewSidebarProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private review?: Review;
  private reviewPath?: string;
  private currentGroupIndex = 0;
  private currentDecoration?: vscode.TextEditorDecorationType;

  constructor(private extensionUri: vscode.Uri) {}

  async loadReview(filePath: string) {
    try {
      const content = await fs.promises.readFile(filePath, "utf-8");
      this.review = JSON.parse(content);
      this.reviewPath = filePath;
      this.currentGroupIndex = 0;

      // Reveal the sidebar
      await vscode.commands.executeCommand("humanReview.sidebar.focus");

      this.refresh();
      vscode.window.showInformationMessage(
        `Loaded review: ${this.review?.groups.length ?? 0} groups`
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to load review: ${error}`);
    }
  }

  async openGroup(groupId: string) {
    const group = this.review?.groups.find((g) => g.id === groupId);
    if (!group || !this.review) {
      return;
    }

    // Update current index
    const index = this.review.groups.findIndex((g) => g.id === groupId);
    if (index !== -1) {
      this.currentGroupIndex = index;
    }

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      vscode.window.showErrorMessage("No workspace folder open");
      return;
    }

    const file = group.files[0];
    if (!file) {
      vscode.window.showWarningMessage("No files in this group");
      return;
    }

    // Get file content at base ref using git show
    const baseRef = this.review.meta.base;
    const headUri = vscode.Uri.file(path.join(workspaceRoot, file.path));

    try {
      // Create a temporary URI scheme for the base content
      const baseUri = vscode.Uri.parse(
        `human-review-git:${file.path}?ref=${baseRef}`
      );

      // Open native diff editor
      await vscode.commands.executeCommand(
        "vscode.diff",
        baseUri,
        headUri,
        `${file.path} - ${group.title}`
      );

      // Scroll to first hunk after a short delay to let editor initialize
      setTimeout(async () => {
        const editor = vscode.window.activeTextEditor;
        if (editor && file.hunks[0]) {
          const pos = new vscode.Position(file.hunks[0].start - 1, 0);
          editor.revealRange(
            new vscode.Range(pos, pos),
            vscode.TextEditorRevealType.InCenter
          );
        }

        // Apply decorations
        this.applyDecoration(vscode.window.activeTextEditor, group);
      }, 100);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to open diff: ${error}`);
    }
  }

  nextGroup() {
    if (!this.review || this.review.groups.length === 0) {
      return;
    }
    this.currentGroupIndex =
      (this.currentGroupIndex + 1) % this.review.groups.length;
    const group = this.review.groups[this.currentGroupIndex];
    this.openGroup(group.id);
  }

  prevGroup() {
    if (!this.review || this.review.groups.length === 0) {
      return;
    }
    this.currentGroupIndex =
      (this.currentGroupIndex - 1 + this.review.groups.length) %
      this.review.groups.length;
    const group = this.review.groups[this.currentGroupIndex];
    this.openGroup(group.id);
  }

  private applyDecoration(editor: vscode.TextEditor | undefined, group: Group) {
    if (!editor) {
      return;
    }

    // Dispose previous decoration
    if (this.currentDecoration) {
      this.currentDecoration.dispose();
    }

    this.currentDecoration = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      borderWidth: "0 0 0 3px",
      borderStyle: "solid",
      borderColor: "#4EC9B0",
      overviewRulerColor: "#4EC9B0",
      overviewRulerLane: vscode.OverviewRulerLane.Left,
    });

    // Find hunks for the current file
    const currentFilePath = editor.document.uri.fsPath;
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    const ranges: vscode.Range[] = [];
    for (const f of group.files) {
      const fullPath = workspaceRoot
        ? path.join(workspaceRoot, f.path)
        : f.path;
      if (fullPath === currentFilePath || currentFilePath.endsWith(f.path)) {
        for (const h of f.hunks) {
          ranges.push(new vscode.Range(h.start - 1, 0, h.end - 1, 0));
        }
      }
    }

    editor.setDecorations(this.currentDecoration, ranges);
  }

  private refresh() {
    if (!this.view || !this.review) {
      return;
    }
    this.view.webview.postMessage({ type: "update", review: this.review });
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
        this.openGroup(msg.groupId);
      } else if (msg.type === "openFlag") {
        this.openFlag(msg.file, msg.line);
      } else if (msg.type === "selectFile") {
        this.promptSelectFile();
      }
    });

    // If we already have a review loaded, refresh the view
    if (this.review) {
      this.refresh();
    }
  }

  private async openFlag(file: string, line: number) {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      return;
    }

    const uri = vscode.Uri.file(path.join(workspaceRoot, file));
    const doc = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(doc);
    const pos = new vscode.Position(line - 1, 0);
    editor.revealRange(
      new vscode.Range(pos, pos),
      vscode.TextEditorRevealType.InCenter
    );
    editor.selection = new vscode.Selection(pos, pos);
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
    .stats {
      display: flex;
      gap: 8px;
      margin-top: 4px;
      font-size: 12px;
    }
    .add { color: var(--vscode-gitDecoration-addedResourceForeground); }
    .del { color: var(--vscode-gitDecoration-deletedResourceForeground); }
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
    .flag-location {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-top: 2px;
    }
    .moved {
      padding: 0;
    }
    .moved-item {
      padding: 8px 12px;
      font-size: 12px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    .moved-desc {
      margin-bottom: 4px;
    }
    .moved-paths {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
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
      if (e.data.type === 'update') render(e.data.review);
    });

    function render(review) {
      const root = document.getElementById('root');

      root.innerHTML = \`
        <div class="header">
          <strong>Changes in PR</strong>
          <div class="group-meta">\${review.groups.length} group\${review.groups.length !== 1 ? 's' : ''}</div>
        </div>

        \${review.groups.map((g, i) => \`
          <div class="group" onclick="openGroup('\${g.id}')">
            <div class="group-title">\${i + 1}. \${esc(g.title)}</div>
            \${g.summary ? \`<div class="group-summary">\${esc(g.summary)}</div>\` : ''}
            <div class="group-meta">\${g.files.length} file\${g.files.length !== 1 ? 's' : ''}</div>
            <div class="stats">
              <span class="add">+\${g.additions}</span>
              <span class="del">-\${g.deletions}</span>
            </div>
          </div>
        \`).join('')}

        \${review.flags?.length ? \`
          <div class="section-header">Flags</div>
          <div class="flags">
            \${review.flags.map(f => \`
              <div class="flag flag-\${f.severity}" onclick="openFlag('\${esc(f.file)}', \${f.line})">
                <span class="flag-icon">\${f.severity === 'error' ? '\u2716' : f.severity === 'warning' ? '\u26A0' : '\u24D8'}</span>
                <div class="flag-content">
                  <div class="flag-title">\${esc(f.title)}</div>
                  <div class="flag-location">\${esc(f.file)}:\${f.line}</div>
                </div>
              </div>
            \`).join('')}
          </div>
        \` : ''}

        \${review.moved?.length ? \`
          <div class="section-header">Moved Code</div>
          <div class="moved">
            \${review.moved.map(m => \`
              <div class="moved-item">
                <div class="moved-desc">\${esc(m.description)}</div>
                <div class="moved-paths">
                  \${esc(m.from.path)}:\${m.from.start}-\${m.from.end} \u2192 \${esc(m.to.path)}:\${m.to.start}-\${m.to.end}
                </div>
              </div>
            \`).join('')}
          </div>
        \` : ''}
      \`;
    }

    function openGroup(id) {
      vscode.postMessage({ type: 'openGroup', groupId: id });
    }

    function openFlag(file, line) {
      vscode.postMessage({ type: 'openFlag', file: file, line: line });
    }

    function selectFile() {
      vscode.postMessage({ type: 'selectFile' });
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
