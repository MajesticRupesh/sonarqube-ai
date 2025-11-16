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

function escapePrompt(prompt: string): string {
  return prompt
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\$/g, '\\$')
    .replace(/`/g, '\\`');
}

function watchAndLogResponse(workspaceFolder: string, responsePath: string, agent: string, file: string) {
  const dir = path.dirname(responsePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.watchFile(responsePath, { interval: 1000 }, () => {
    try {
      if (fs.existsSync(responsePath)) {
        const content = fs.readFileSync(responsePath, 'utf8');
        if (content.trim()) {
          const data = JSON.parse(content);
          const response = data.response || data.text || data.message || content;
          logAudit(workspaceFolder, 'ai_response_received', { agent, file, response: response.substring(0, 500) });
          fs.unwatchFile(responsePath);
        }
      }
    } catch {}
  });
}

async function runCursorAgent(workspaceFolder: string, dir: string, prompt: string, file: string): Promise<void> {
  const responsePath = path.join(workspaceFolder, '.vscode', 'sonar-ai', 'ai-response.json');
  watchAndLogResponse(workspaceFolder, responsePath, 'cursor', file);
  const terminal = getOrCreateTerminal('Cursor Agent');
  terminal.show(true);
  terminal.sendText(`cd "${dir}"`);
  const escapedPrompt = escapePrompt(prompt);
  terminal.sendText(`cursor-agent -p "${escapedPrompt}" "${file}" --output-format json > "${responsePath}"`);
}

async function runCopilotAgent(workspaceFolder: string, dir: string, prompt: string, file: string): Promise<void> {
  const responsePath = path.join(workspaceFolder, '.vscode', 'sonar-ai', 'ai-response.json');
  watchAndLogResponse(workspaceFolder, responsePath, 'copilot', file);
  const terminal = getOrCreateTerminal('Copilot Agent');
  terminal.show(true);
  terminal.sendText(`cd "${dir}"`);
  const escapedPrompt = escapePrompt(prompt);
  terminal.sendText(`copilot -p "${escapedPrompt}" --allow-all-tools > "${responsePath}"`);
}

export async function fixBugs(context: vscode.ExtensionContext) {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('No workspace folder open');
    return;
  }

  const filePath = path.join(workspaceFolder, '.vscode/sonar-ai', 'sonar-issues.json');
  if (!fs.existsSync(filePath)) {
    vscode.window.showErrorMessage('SonarQube issues file not found. Please run "Get SonarQube Issues" first.');
    return;
  }
  
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to parse SonarQube issues file: ${error}`);
    return;
  }
  
  logAudit(workspaceFolder, 'fixBugs_opened', { issueCount: data.issues?.length || 0 });
  
  const panel = vscode.window.createWebviewPanel(
    'fixBugs',
    'Fix Bugs',
    vscode.ViewColumn.One,
    { 
      enableScripts: true,
      retainContextWhenHidden: true
    }
  );

  // Load and combine HTML, CSS, and JS files
  const webviewDir = path.join(context.extensionPath, 'src', 'webview');
  const htmlContent = fs.readFileSync(path.join(webviewDir, 'fixBugs.html'), 'utf8');
  const cssContent = fs.readFileSync(path.join(webviewDir, 'fixBugs.css'), 'utf8');
  const jsContent = fs.readFileSync(path.join(webviewDir, 'fixBugs.js'), 'utf8');
  
  const combinedHtml = htmlContent
    .replace('<link rel="stylesheet" href="fixBugs.css">', `<style>${cssContent}</style>`)
    .replace('<script src="fixBugs.js"></script>', `<script>${jsContent}</script>`);
  
  panel.webview.html = combinedHtml;

  // Helper functions
  const loadPrompts = (filePath: string): string[] => {
    try {
      return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : [];
    } catch {
      return [];
    }
  };

  const defaultPromptsPath = path.join(context.extensionPath, 'src', 'webview', 'prompts.json');
  const customPromptsPath = path.join(workspaceFolder, '.vscode', 'sonar-ai', 'custom-prompts.json');
  
  const defaultPrompts = loadPrompts(defaultPromptsPath);
  const customPrompts = loadPrompts(customPromptsPath);

  // Send data to the webview
  panel.webview.postMessage({
    command: 'initialize',
    issues: data.issues,
    workspaceFolder: workspaceFolder,
    defaultPrompts: defaultPrompts,
    customPrompts: customPrompts
  });

  panel.webview.onDidReceiveMessage(
    async message => {
      if (message.command === 'saveCustomPrompt') {
        const customPromptsDir = path.dirname(customPromptsPath);
        if (!fs.existsSync(customPromptsDir)) {
          fs.mkdirSync(customPromptsDir, { recursive: true });
        }
        
        const updatedCustomPrompts = [...loadPrompts(customPromptsPath), message.prompt];
        fs.writeFileSync(customPromptsPath, JSON.stringify(updatedCustomPrompts, null, 2));
        
        logAudit(workspaceFolder, 'custom_prompt_saved', { prompt: message.prompt.substring(0, 50) });
        
        panel.webview.postMessage({
          command: 'customPromptSaved',
          defaultPrompts: loadPrompts(defaultPromptsPath),
          customPrompts: updatedCustomPrompts
        });
        return;
      }
      
      const { prompt, file, dir } = message;
      if (!file) {
        vscode.window.showErrorMessage('Select a file first');
        return;
      }
      
      if (message.command === 'fixWithCursor') {
        logAudit(workspaceFolder, 'fix_triggered', { agent: 'cursor', file, promptLength: prompt.length });
        await runCursorAgent(workspaceFolder, dir, prompt, file);
      } else if (message.command === 'fixWithCopilot') {
        logAudit(workspaceFolder, 'fix_triggered', { agent: 'copilot', file, promptLength: prompt.length });
        await runCopilotAgent(workspaceFolder, dir, prompt, file);
      }
      
      if (message.command === 'filter_changed' || message.command === 'prompt_inserted') {
        logAudit(workspaceFolder, message.command, message.details || {});
      }
    },
    undefined,
    context.subscriptions
  );
}
