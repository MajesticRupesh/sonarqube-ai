# Changelog

All notable changes to this project will be documented in this file.

## [0.0.3] - 2025-11-9
### Added
- Prompts Panel: Added support for creating and saving custom prompts with a single click.

### Changed
- Extracted inline HTML, CSS, and JS into separate files for better structure and maintainability.

### Fixed
- N/A

### Security
- N/A


## [0.0.2] - 2025-11-5
### Added
- Remove Filter button to improve filter usability.
- Prompts panel: users can now insert predefined prompts directly into the text box with a single click.

### Changed
- Minor internal UI adjustments for smoother interaction.

### Fixed
- Resolved issue where clicking a checkbox caused the element to jump to the top of the list; items now remain in place after interaction.

### Security
- N/A


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
