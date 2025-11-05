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

function escapePrompt(prompt: string): string {
  return prompt
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\$/g, '\\$')
    .replace(/`/g, '\\`');
}

async function runCursorAgent(dir: string, prompt: string, file: string): Promise<void> {
  const terminal = getOrCreateTerminal('Cursor Agent');
  terminal.show(true);
  terminal.sendText(`cd "${dir}"`);
  const escapedPrompt = escapePrompt(prompt);
  terminal.sendText(`cursor-agent -p "${escapedPrompt}" "${file}" --output-format json > .vscode/sonar-ai/ai-response.json`);
}

async function runCopilotAgent(dir: string, prompt: string, file: string): Promise<void> {
  const terminal = getOrCreateTerminal('Copilot Agent');
  terminal.show(true);
  terminal.sendText(`cd "${dir}"`);
  const escapedPrompt = escapePrompt(prompt);
  terminal.sendText(`copilot -p "${escapedPrompt}" --allow-all-tools > .vscode/sonar-ai/ai-response.json`);
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
        await runCursorAgent(dir, prompt, file);
      } else if (message.command === 'fixWithCopilot') {
        await runCopilotAgent(dir, prompt, file);
      }
    },
    undefined,
    context.subscriptions
  );
}
