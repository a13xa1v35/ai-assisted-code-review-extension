import * as vscode from "vscode";
import * as cp from "child_process";
import { ReviewSidebarProvider } from "./sidebar";

class GitContentProvider implements vscode.TextDocumentContentProvider {
  provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    return new Promise((resolve, reject) => {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspaceRoot) {
        reject(new Error("No workspace folder"));
        return;
      }

      // Parse the URI: human-review-git:path/to/file?ref=abc123
      const filePath = uri.path;
      const ref = new URLSearchParams(uri.query).get("ref") || "HEAD";

      // Use git show to get file content at the specified ref
      cp.exec(
        `git show "${ref}:${filePath}"`,
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
  console.log("Human Review extension is now active");

  // Register git content provider for diff views
  const gitProvider = new GitContentProvider();
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(
      "human-review-git",
      gitProvider
    )
  );

  // Create sidebar provider
  const provider = new ReviewSidebarProvider(context.extensionUri);

  // Register sidebar webview
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("humanReview.sidebar", provider)
  );

  // Command: Open review file manually
  context.subscriptions.push(
    vscode.commands.registerCommand("humanReview.open", async () => {
      provider.promptSelectFile();
    })
  );

  // Command: Open specific group (called from sidebar)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "humanReview.openGroup",
      (groupTitle: string) => {
        provider.openGroup(groupTitle);
      }
    )
  );

  // Auto-detect: watch for ./human-review.json in workspace
  const watcher = vscode.workspace.createFileSystemWatcher(
    "**/human-review.json"
  );

  watcher.onDidChange((uri) => {
    console.log("Review file changed:", uri.fsPath);
    provider.loadReview(uri.fsPath);
  });

  watcher.onDidCreate((uri) => {
    console.log("Review file created:", uri.fsPath);
    provider.loadReview(uri.fsPath);
  });

  context.subscriptions.push(watcher);
}

export function deactivate() {}
