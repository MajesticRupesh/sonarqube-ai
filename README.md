# SonarQube AI — VS Code Extension

A compact VS Code extension that fetches SonarQube issues for the current repository and offers an automated fix flow using either Cursor CLI (`cursor-agent`) or Copilot CLI (`copilot`). The UI is intentionally minimal with cascading filters for quick triage and fixes.

## Key features

* **Get SonarQube Issues** — Download SonarQube issues for the project (JSON).
* **Fix SonarQube Bugs** — Open a webview with cascading filters (type, severity, rule, directory, file) and run fixes via Cursor or Copilot CLIs.
* Local caching of SonarQube token & URL for convenience.
* Saves fetched issues and AI responses locally for review.

## Commands

* `Get SonarQube Issues` — Fetch issues from your SonarQube instance and save to `.vscode/sonar-ai/`.
* `Fix SonarQube Bugs` — Open the webview to filter issues, add a custom prompt, and run fixes with Cursor or Copilot.

## Quick start

1. Run **Get SonarQube Issues** from the Command Palette.
2. Paste your SonarQube **URL** and **token** in the webview that appears. The extension will save issues as JSON under `.vscode/sonar-ai/`.

   * Note: SonarQube API limits export to **500 issues per API call**.
3. Run **Fix SonarQube Bugs**. In the webview:

   * Choose filters (type, severity, rule, directory, file).
   * Add a prompt in the textbox at the end to guide the AI (the whole textbox content actually goes as a prompt to the AI).
   * Click **Fix with Cursor** or **Fix with Copilot** to run the selected CLI and apply suggested fixes live.
4. After completion, the AI responses are saved to `.vscode/sonar-ai/ai-response.json`.

## Files & storage

Files are stored under the workspace's `.vscode/sonar-ai/` directory:

* `config.json` — Cached SonarQube URL & token (stored locally in the workspace).
* `sonar-issues.json` — Downloaded SonarQube issues (JSON).
* `ai-response.json` — AI output from fix operations.

**Security note:** the SonarQube token is cached locally in `config.json`. Treat your workspace folder as sensitive — avoid committing `.vscode/sonar-ai/` to version control.

## Prerequisites

* A running SonarQube instance and a user token with permission to read issues.
* Either Cursor CLI (`cursor-agent`) or Copilot CLI (`copilot`) installed and authenticated if you plan to use the auto-fix feature.

## Limitations & behavior

* SonarQube limits exports to 500 issues per API call — large projects may require multiple fetches.
* The extension runs CLI commands in the integrated terminal; fixes are applied live in the workspace.
* The extension caches SonarQube settings after the first run. Re-run **Get SonarQube Issues** to refresh or change credentials.

## Contributing

PRs, bug reports and improvements are welcome.

## License

MIT
