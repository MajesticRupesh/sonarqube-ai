import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { logAudit } from '../utils/auditLog';

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
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('No workspace folder open');
    return;
  }
  
  logAudit(workspaceFolder, 'getIssues_opened');

  // Load existing config
  const configPath = path.join(workspaceFolder, '.vscode/sonar-ai', 'config.json');
  let existingConfig = null;
  try {
    if (fs.existsSync(configPath)) {
      existingConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (error) {
    // Ignore config loading errors
  }

  const panel = vscode.window.createWebviewPanel(
    'sonarqubeConfig',
    'SonarQube Configuration',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true
    }
  );

  panel.webview.html = getWebviewContent(existingConfig);

  panel.webview.onDidReceiveMessage(
    async message => {
      if (message.command === 'submit') {
        const { token, url } = message;
        
        logAudit(workspaceFolder, 'config_saved', { url });
        
        const configDir = path.join(workspaceFolder, '.vscode/sonar-ai');
        if (!fs.existsSync(configDir)) {
          fs.mkdirSync(configDir, { recursive: true });
        }
        
        fs.writeFileSync(configPath, JSON.stringify({ token, url }, null, 2));
        
        const filePath = path.join(configDir, 'sonar-issues.json');
        const terminal = getOrCreateTerminal('SonarQube API');
        terminal.show(true);
        
        terminal.sendText(`curl -u "${token.replace(/"/g, '\\"')}:" "${url.replace(/"/g, '\\"')}" > "${filePath}"`);
        
        logAudit(workspaceFolder, 'issues_fetch_triggered', { url });
        vscode.window.showInformationMessage(`Configuration saved and fetching SonarQube issues... Check the terminal for progress.`);
      }
    },
    undefined,
    context.subscriptions
  );
}

function getWebviewContent(existingConfig: any) {
    const tokenValue = existingConfig?.token || '';
    const urlValue = existingConfig?.url || '';
    
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
        .status {
            margin-top: 10px;
            padding: 8px;
            background: var(--vscode-textBlockQuote-background);
            border-left: 3px solid var(--vscode-textBlockQuote-border);
            font-size: 0.9em;
        }
    </style>
</head>
<body>
    <h2>SonarQube Configuration</h2>
    ${existingConfig ? '<div class="status">✓ Configuration loaded from previous session</div>' : ''}
    <form id="configForm">
        <div class="form-group">
            <label for="token">Token:</label>
            <input type="text" id="token" value="${tokenValue}" required>
        </div>
        <div class="form-group">
            <label for="url">URL:</label>
            <input type="text" id="url" value="${urlValue}" placeholder="https://sonarqube.your-company.com" required>
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
