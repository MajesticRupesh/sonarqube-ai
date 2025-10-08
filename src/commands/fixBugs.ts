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

async function runCursorAgent(dir: string, prompt: string, file: string): Promise<void> {
  const terminal = getOrCreateTerminal('Cursor Agent');
  terminal.show(true);
  
  terminal.sendText(`cd "${dir}"`);
  
  const escapedPrompt = prompt
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\$/g, '\\$')
    .replace(/`/g, '\\`');
  
  terminal.sendText(`cursor-agent -p "${escapedPrompt}" "${file}" --output-format json > sonarai-temp/ai-response.json`);
}

export async function fixBugs(context: vscode.ExtensionContext) {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('No workspace folder open');
    return;
  }

  const filePath = path.join(workspaceFolder, 'sonarai-temp', 'sonar-issues.json');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  const groupedIssues: { [key: string]: any[] } = {};
  data.issues.forEach((issue: any) => {
    const component = issue.component;
    if (!groupedIssues[component]) {
      groupedIssues[component] = [];
    }
    groupedIssues[component].push(issue);
  });

  const panel = vscode.window.createWebviewPanel(
    'fixBugs',
    'Fix Bugs',
    vscode.ViewColumn.One,
    { enableScripts: true }
  );

  panel.webview.html = getWebviewContent(groupedIssues, workspaceFolder);

  panel.webview.onDidReceiveMessage(
    async message => {
      if (message.command === 'fix') {
        const { prompt, file, dir } = message;
        if (!file) {
          vscode.window.showErrorMessage('Select a file first');
          return;
        }
        await runCursorAgent(dir, prompt, file);
      }
    },
    undefined,
    context.subscriptions
  );
}

function getWebviewContent(groupedIssues: { [key: string]: any[] }, workspaceFolder: string) {
  const issuesData = JSON.stringify(groupedIssues);
  const items = Object.keys(groupedIssues).map(file => {
    return `<div class="file-item" onclick="showIssues('${file.replace(/'/g, "\\'")}')"><strong>${file}</strong> (${groupedIssues[file].length})</div>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { padding: 0; margin: 0; font-family: var(--vscode-font-family); display: flex; height: 100vh; }
    .left { width: 40%; padding: 20px; overflow-y: auto; border-right: 1px solid var(--vscode-panel-border); }
    .right { width: 60%; padding: 20px; display: flex; flex-direction: column; }
    .file-item { margin-bottom: 10px; cursor: pointer; padding: 8px; border-radius: 4px; }
    .file-item:hover { background: var(--vscode-list-hoverBackground); }
    .file-item.selected { background: var(--vscode-list-activeSelectionBackground); }
    textarea { width: 100%; flex: 1; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); padding: 10px; font-family: monospace; margin-bottom: 10px; }
    input { width: 100%; padding: 8px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); margin-bottom: 10px; }
    button { padding: 10px 20px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; cursor: pointer; }
    button:hover { background: var(--vscode-button-hoverBackground); }
    button:disabled { opacity: 0.5; }
  </style>
</head>
<body>
  <div class="left">
    ${items}
  </div>
  <div class="right">
    <textarea id="prompt"></textarea>
    <input type="text" id="dir" value="${workspaceFolder}" />
    <button id="btn" onclick="fix()" disabled>Fix</button>
  </div>
  <script>
    const vscode = acquireVsCodeApi();
    const issues = ${issuesData};
    let currentFile = '';
    
    function showIssues(file) {
      document.querySelectorAll('.file-item').forEach(el => el.classList.remove('selected'));
      event.target.closest('.file-item').classList.add('selected');
      
      currentFile = file;
      const fileIssues = issues[file];
      let text = '';
      fileIssues.forEach((issue, idx) => {
        text += 'Issue ' + (idx + 1) + ':\\n';
        text += 'Message: ' + issue.message + '\\n';
        text += 'Severity: ' + issue.severity + '\\n';
        if (issue.line) text += 'Line: ' + issue.line + '\\n';
        text += 'Rule: ' + issue.rule + '\\n\\n';
      });
      text += 'Fix these SAST issues';
      document.getElementById('prompt').value = text;
      document.getElementById('btn').disabled = false;
    }
    
    function fix() {
      if (!currentFile) return;
      
      const prompt = document.getElementById('prompt').value;
      const filePath = currentFile.includes(':') ? currentFile.split(':').slice(1).join(':') : currentFile;
      const dir = document.getElementById('dir').value;
      
      vscode.postMessage({
        command: 'fix',
        prompt: prompt,
        file: filePath,
        dir: dir
      });
    }
  </script>
</body>
</html>`;
}