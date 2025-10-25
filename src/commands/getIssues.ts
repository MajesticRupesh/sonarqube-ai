import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

const terminals = new Map<string, vscode.Terminal>();

function getOrCreateTerminal(name: string): vscode.Terminal {
  let terminal = terminals.get(name);
  if (terminal && terminal.exitStatus === undefined) {
    return terminal;
  }
  
  terminal = vscode.window.createTerminal({ name });
  terminals.set(name, terminal);
  
  vscode.window.onDidCloseTerminal((closedTerminal) => {
    if (closedTerminal === terminal) {
      terminals.delete(name);
    }
  });
  
  return terminal;
}

export async function getIssues(context: vscode.ExtensionContext) {
  const panel = vscode.window.createWebviewPanel(
    'sonarqubeConfig',
    'SonarQube Configuration',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true
    }
  );

  panel.webview.html = getWebviewContent();

  panel.webview.onDidReceiveMessage(
    async message => {
      if (message.command === 'submit') {
        const { token, url } = message;
        
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
        if (!workspaceFolder) {
          vscode.window.showErrorMessage('No workspace folder open');
          return;
        }
        
        const tempDir = path.join(workspaceFolder, 'sonarai-temp');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        
        const filePath = path.join(tempDir, 'sonar-issues.json');
        
        // Run curl command in a separate terminal
        const terminal = getOrCreateTerminal('SonarQube API');
        terminal.show(true);
        
        const escapedToken = token.replace(/"/g, '\\"');
        const escapedUrl = url.replace(/"/g, '\\"');
        
        terminal.sendText(`curl -u "${escapedToken}:" "${escapedUrl}" > "${filePath}"`);
        
        vscode.window.showInformationMessage(`Fetching SonarQube issues... Check the terminal for progress. Data will be saved to: ${filePath}`);
        panel.dispose();
      }
    },
    undefined,
    context.subscriptions
  );
}

function getWebviewContent() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SonarQube Configuration</title>
    <style>
        body {
            padding: 20px;
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
        }
        .form-group {
            margin-bottom: 15px;
        }
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }
        input {
            width: 100%;
            padding: 8px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            box-sizing: border-box;
        }
        button {
            padding: 10px 20px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            cursor: pointer;
        }
        button:hover {
            background: var(--vscode-button-hoverBackground);
        }
    </style>
</head>
<body>
    <h2>SonarQube Configuration</h2>
    <form id="configForm">
        <div class="form-group">
            <label for="token">Token:</label>
            <input type="text" id="token" required>
        </div>
        <div class="form-group">
            <label for="url">URL:</label>
            <input type="text" id="url" placeholder="https://sonarqube.your-company.com" required>
        </div>
        <button type="submit">Submit</button>
    </form>
    <script>
        const vscode = acquireVsCodeApi();
        document.getElementById('configForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const token = document.getElementById('token').value;
            const url = document.getElementById('url').value;
            vscode.postMessage({
                command: 'submit',
                token: token,
                url: url,
            });
        });
    </script>
</body>
</html>`;
}
