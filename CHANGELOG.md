# Changelog

All notable changes to this project will be documented in this file.

## [0.0.1] - 2025-10-28
### Added
- Initial release of SonarQube AI VS Code Extension.
- `Get SonarQube Issues` command: fetches issues and saves them to `.vscode/sonar-ai/sonar-issues.json`.
- `Fix SonarQube Bugs` webview: cascading filters, custom prompt, Fix with Cursor / Fix with Copilot.
- Local caching of SonarQube URL & token (`.vscode/sonar-ai/config.json`).
- Save AI responses to `.vscode/sonar-ai/ai-response.json`.

### Changed
- N/A

### Fixed
- N/A

### Security
- SonarQube token stored locally in `.vscode/sonar-ai/config.json` (do not commit).
