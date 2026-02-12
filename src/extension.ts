import * as vscode from "vscode";
import * as cp from "child_process";
import { ReviewSidebarProvider, ExplanationContentProvider } from "./sidebar";

class GitContentProvider implements vscode.TextDocumentContentProvider {
  provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    return new Promise((resolve, reject) => {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspaceRoot) {
        reject(new Error("No workspace folder"));
        return;
      }

      // Parse the URI: code-review-git:path/to/file?ref=abc123
      const filePath = uri.path;
      const ref = new URLSearchParams(uri.query).get("ref") || "HEAD";
      if (ref.startsWith('-')) {
        reject(new Error("Invalid git ref"));
        return;
      }

      // Use git show to get file content at the specified ref
      cp.execFile(
        'git',
        ['show', `${ref}:${filePath}`],
        { cwd: workspaceRoot, maxBuffer: 10 * 1024 * 1024 },
        (error, stdout, stderr) => {
          if (error) {
            // File might not exist in base ref (new file)
            if (
              stderr.includes("does not exist") ||
              stderr.includes("fatal:")
            ) {
              resolve("");
            } else {
              reject(new Error(stderr || error.message));
            }
          } else {
            resolve(stdout);
          }
        }
      );
    });
  }
}

export function activate(context: vscode.ExtensionContext) {
  console.log("AI-assisted Code Review extension is now active");

  // Register git content provider for diff views
  const gitProvider = new GitContentProvider();
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(
      "code-review-git",
      gitProvider
    )
  );

  // Register explanation content provider for markdown preview
  const explanationProvider = new ExplanationContentProvider();
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(
      "code-review-explanation",
      explanationProvider
    )
  );

  // Create sidebar provider
  const provider = new ReviewSidebarProvider(context.extensionUri, explanationProvider);

  // Register sidebar webview
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("codeReview.sidebar", provider)
  );

  // Command: Open review file manually
  context.subscriptions.push(
    vscode.commands.registerCommand("codeReview.open", async () => {
      provider.promptSelectFile();
    })
  );

  // Command: Open specific group (called from sidebar)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "codeReview.openGroup",
      (groupIndex: number) => {
        provider.openGroup(groupIndex);
      }
    )
  );

  // Auto-detect: watch for ./code-review.json in workspace
  const watcher = vscode.workspace.createFileSystemWatcher(
    "*/code-review.json"
  );

  // Debounce watcher to avoid partial-write reloads
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  const debouncedLoad = (uri: vscode.Uri) => {
    if (debounceTimer) { clearTimeout(debounceTimer); }
    debounceTimer = setTimeout(() => {
      provider.loadReview(uri.fsPath);
    }, 500);
  };

  watcher.onDidChange((uri) => {
    console.log("Review file changed:", uri.fsPath);
    debouncedLoad(uri);
  });

  watcher.onDidCreate((uri) => {
    console.log("Review file created:", uri.fsPath);
    debouncedLoad(uri);
  });

  watcher.onDidDelete((uri) => {
    console.log("Review file deleted:", uri.fsPath);
    provider.unloadReview();
  });

  context.subscriptions.push(watcher);
}

export function deactivate() {}
