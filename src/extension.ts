import * as vscode from 'vscode';
import { getIssues } from './commands/getIssues';
import { fixBugs } from './commands/fixBugs';

export function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "sonarqube-ai" is now active!');

  const disposable = vscode.commands.registerCommand('sonarqube-ai.runSonarAI', async () => {
    await getIssues(context);
  });

  const fixBugsCommand = vscode.commands.registerCommand('sonarqube-ai.fixBugs', async () => {
    await fixBugs(context);
  });

  context.subscriptions.push(disposable, fixBugsCommand);
}

// This method is called when your extension is deactivated
export function deactivate() {}


