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
  
  const panel = vscode.window.createWebviewPanel(
    'fixBugs',
    'Fix Bugs',
    vscode.ViewColumn.One,
    { enableScripts: true }
  );

  panel.webview.html = getWebviewContent(data.issues, workspaceFolder);

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

function getWebviewContent(issues: any[], workspaceFolder: string) {
  const issuesData = JSON.stringify(issues);
  
  const types = [...new Set(issues.map(i => i.type))];
  const severities = [...new Set(issues.map(i => i.severity))];
  const rules = [...new Set(issues.map(i => i.rule))];
  const directories = [...new Set(issues.map(i => i.component.split(':')[1].split('/').slice(0, -1).join('/')))];
  const files = [...new Set(issues.map(i => i.component))];

  return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { padding: 0; margin: 0; font-family: var(--vscode-font-family); display: flex; height: 100vh; }
    .left { width: 40%; padding: 20px; overflow-y: auto; border-right: 1px solid var(--vscode-panel-border); }
    .right { width: 60%; padding: 20px; display: flex; flex-direction: column; }
    input { width: 100%; padding: 8px; margin-bottom: 10px; }
    .filter-group { margin-bottom: 10px; }
    .filter-group h4 { margin: 0 0 3px 0; }
    .checkbox { margin: 1px 0; display: flex; align-items: center; }
    .checkbox input { width: auto; margin-right: 5px; }
    textarea { width: 100%; flex: 1; font-family: monospace; margin-bottom: 10px; }
    button { padding: 10px 20px; }
  </style>
</head>
<body>
  <div class="left">
    <div id="totalCount" style="font-weight: bold; margin-bottom: 10px;">Total:  issues</div>
    <details class="filter-group">
      <summary>Type</summary>
      ${types.map(t => `<div class="checkbox"><input type="checkbox" value="${t}" onchange="filter()"> ${t}</div>`).join('')}
    </details>
    <details class="filter-group">
      <summary>Severity</summary>
      ${severities.map(s => `<div class="checkbox"><input type="checkbox" value="${s}" onchange="filter()"> ${s}</div>`).join('')}
    </details>
    <details class="filter-group">
      <summary>Rule</summary>
      ${rules.map(r => `<div class="checkbox"><input type="checkbox" value="${r}" onchange="filter()"> ${r}</div>`).join('')}
    </details>
    <details class="filter-group">
      <summary>Directory</summary>
      ${directories.map(d => `<div class="checkbox"><input type="checkbox" value="${d}" onchange="filter()"> ${d}</div>`).join('')}
    </details>
    <details class="filter-group">
      <summary>File</summary>
      ${files.map(f => `<div class="checkbox"><input type="checkbox" value="${f}" onchange="filter()"> ${f}</div>`).join('')}
    </details>
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
    let filteredIssues = issues;
    
    function filter() {
      const checkedTypes = Array.from(document.querySelectorAll('input[type="checkbox"]')).filter(cb => cb.parentElement.parentElement.querySelector('summary').textContent === 'Type' && cb.checked).map(cb => cb.value);
      const checkedSeverities = Array.from(document.querySelectorAll('input[type="checkbox"]')).filter(cb => cb.parentElement.parentElement.querySelector('summary').textContent === 'Severity' && cb.checked).map(cb => cb.value);
      const checkedRules = Array.from(document.querySelectorAll('input[type="checkbox"]')).filter(cb => cb.parentElement.parentElement.querySelector('summary').textContent === 'Rule' && cb.checked).map(cb => cb.value);
      const checkedDirs = Array.from(document.querySelectorAll('input[type="checkbox"]')).filter(cb => cb.parentElement.parentElement.querySelector('summary').textContent === 'Directory' && cb.checked).map(cb => cb.value);
      const checkedFiles = Array.from(document.querySelectorAll('input[type="checkbox"]')).filter(cb => cb.parentElement.parentElement.querySelector('summary').textContent === 'File' && cb.checked).map(cb => cb.value);
      
      filteredIssues = issues.filter(issue => {
        if (checkedTypes.length > 0 && !checkedTypes.includes(issue.type)) return false;
        if (checkedSeverities.length > 0 && !checkedSeverities.includes(issue.severity)) return false;
        if (checkedRules.length > 0 && !checkedRules.includes(issue.rule)) return false;
        if (checkedDirs.length > 0 && !checkedDirs.some(dir => issue.component.includes(dir))) return false;
        if (checkedFiles.length > 0 && !checkedFiles.includes(issue.component)) return false;
        return true;
      });
      
      let text = '';
      
      const groupedByFile = {};
      filteredIssues.forEach(issue => {
        if (!groupedByFile[issue.component]) groupedByFile[issue.component] = [];
        groupedByFile[issue.component].push(issue);
      });
      
      Object.keys(groupedByFile).forEach(file => {
        text += 'File: ' + file + ' (' + groupedByFile[file].length + ' issues)\\n';
        groupedByFile[file].forEach((issue, idx) => {
          text += '  Issue ' + (idx + 1) + ':\\n';
          text += '  Message: ' + issue.message + '\\n';
          text += '  Severity: ' + issue.severity + '\\n';
          if (issue.line) text += '  Line: ' + issue.line + '\\n';
          text += '  Rule: ' + issue.rule + '\\n\\n';
        });
      });
      text += 'Fix these SAST issues';
      document.getElementById('prompt').value = text;
      document.getElementById('btn').disabled = filteredIssues.length === 0;
      document.getElementById('totalCount').textContent = 'Total: ' + filteredIssues.length + ' issues';
      
      if (filteredIssues.length > 0) {
        currentFile = filteredIssues[0].component;
      }
    }
    
    function fix() {
      if (filteredIssues.length === 0) return;
      const prompt = document.getElementById('prompt').value;
      const filePath = currentFile.includes(':') ? currentFile.split(':').slice(1).join(':') : currentFile;
      const dir = document.getElementById('dir').value;
      vscode.postMessage({ command: 'fix', prompt: prompt, file: filePath, dir: dir });
    }
    
    filter();
  </script>
</body>
</html>`;
}