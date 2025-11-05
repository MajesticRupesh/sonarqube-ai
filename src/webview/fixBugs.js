const vscode = acquireVsCodeApi();
let issues = [];
let currentFile = '';
let filteredIssues = [];
let prompts = [];

function loadPrompts(defaultPrompts, customPrompts) {
  prompts = [...(defaultPrompts || []), ...(customPrompts || [])];
  renderPrompts();
}

function renderPrompts() {
  const promptsList = document.getElementById('promptsList');
  promptsList.innerHTML = prompts.map((text, index) => 
    `<div class="prompt-item" onclick="insertPrompt(${index})">${text.substring(0, 80)}${text.length > 80 ? '...' : ''}</div>`
  ).join('');
}

function insertPrompt(index) {
  const textarea = document.getElementById('prompt');
  if (prompts[index] && textarea) {
    textarea.value += prompts[index];
    textarea.focus();
    textarea.scrollTop = textarea.scrollHeight;
  }
}

function saveCustomPrompt() {
  const input = document.getElementById('customPromptInput');
  const text = input.value.trim();
  if (text) {
    vscode.postMessage({ command: 'saveCustomPrompt', prompt: '\n' + text });
    input.value = '';
  }
}

function initializeUI(issuesData, workspaceFolder, defaultPrompts, customPrompts) {
  issues = issuesData;
  filteredIssues = issues;
  document.getElementById('dir').value = workspaceFolder;
  loadPrompts(defaultPrompts, customPrompts);
  filter();
}

function populateFilters(containerId, values) {
  const container = document.getElementById(containerId);
  const checkedValues = Array.from(document.querySelectorAll(`#${containerId} input[type="checkbox"]:checked`)).map(cb => cb.value);
  const sortedValues = [...values].sort((a, b) => 
    getCountForValue(containerId, b) - getCountForValue(containerId, a)
  );
  container.innerHTML = sortedValues.map(value => {
    const count = getCountForValue(containerId, value);
    const checked = checkedValues.includes(value) ? 'checked' : '';
    return count > 0
      ? `<div class="checkbox"><input type="checkbox" value="${value}" onchange="filter()" ${checked}> ${value} (${count})</div>`
      : '';
  }).join('');
}

const filterMappings = {
  'typeFilters': i => i.type,
  'severityFilters': i => i.severity,
  'ruleFilters': i => i.rule,
  'directoryFilters': i => i.component.split(':')[1].split('/').slice(0, -1).join('/'),
  'fileFilters': i => i.component
};

function getCountForValue(containerId, value) {
  const filteredIssues = getFilteredIssuesExcluding(containerId);
  return filteredIssues.filter(i => filterMappings[containerId](i) === value).length;
}

function getCheckedValues(containerId) {
  return Array.from(document.querySelectorAll(`#${containerId} input[type="checkbox"]:checked`)).map(cb => cb.value);
}

function getFilteredIssuesExcluding(excludeContainerId) {
  const filters = {
    'typeFilters': excludeContainerId !== 'typeFilters' ? getCheckedValues('typeFilters') : [],
    'severityFilters': excludeContainerId !== 'severityFilters' ? getCheckedValues('severityFilters') : [],
    'ruleFilters': excludeContainerId !== 'ruleFilters' ? getCheckedValues('ruleFilters') : [],
    'directoryFilters': excludeContainerId !== 'directoryFilters' ? getCheckedValues('directoryFilters') : [],
    'fileFilters': excludeContainerId !== 'fileFilters' ? getCheckedValues('fileFilters') : []
  };
  return issues.filter(issue => {
    if (filters.typeFilters.length > 0 && !filters.typeFilters.includes(issue.type)) return false;
    if (filters.severityFilters.length > 0 && !filters.severityFilters.includes(issue.severity)) return false;
    if (filters.ruleFilters.length > 0 && !filters.ruleFilters.includes(issue.rule)) return false;
    if (filters.directoryFilters.length > 0 && !filters.directoryFilters.some(dir => issue.component.includes(dir))) return false;
    if (filters.fileFilters.length > 0 && !filters.fileFilters.includes(issue.component)) return false;
    return true;
  });
}

function filter() {
  if (document.getElementById('typeFilters').children.length === 0) {
    updateAllFilterCounts();
  }
  filteredIssues = getFilteredIssuesExcluding('');
  updateAllFilterCounts();
  const groupedByFile = filteredIssues.reduce((acc, issue) => {
    if (!acc[issue.component]) acc[issue.component] = [];
    acc[issue.component].push(issue);
    return acc;
  }, {});
  const text = Object.entries(groupedByFile).map(([file, fileIssues]) => {
    const fileText = `File: ${file} (${fileIssues.length} issues)\n`;
    const issuesText = fileIssues.map((issue, idx) => 
      `  Issue ${idx + 1}:\n  Message: ${issue.message}\n  Severity: ${issue.severity}\n${issue.line ? `  Line: ${issue.line}\n` : ''}  Rule: ${issue.rule}\n\n`
    ).join('');
    return fileText + issuesText;
  }).join('') + 'Fix these SAST issues';
  document.getElementById('prompt').value = text;
  const hasIssues = filteredIssues.length > 0;
  document.getElementById('btn').disabled = !hasIssues;
  document.getElementById('btnCopilot').disabled = !hasIssues;
  document.getElementById('issueCount').textContent = filteredIssues.length;
  updateRemoveFilterButtons();
  if (filteredIssues.length > 0) {
    currentFile = filteredIssues[0].component;
  }
}

function updateAllFilterCounts() {
  const filterConfigs = {
    'typeFilters': issues.map(i => i.type),
    'severityFilters': issues.map(i => i.severity),
    'ruleFilters': issues.map(i => i.rule),
    'directoryFilters': issues.map(i => i.component.split(':')[1].split('/').slice(0, -1).join('/')),
    'fileFilters': issues.map(i => i.component)
  };
  Object.entries(filterConfigs).forEach(([containerId, values]) => {
    populateFilters(containerId, [...new Set(values)]);
  });
  updateRemoveFilterButtons();
}

function updateRemoveFilterButtons() {
  const filterIds = ['typeFilters', 'severityFilters', 'ruleFilters', 'directoryFilters', 'fileFilters'];
  filterIds.forEach(containerId => {
    const checkedCount = document.querySelectorAll(`#${containerId} input[type="checkbox"]:checked`).length;
    const container = document.getElementById(containerId);
    const details = container?.closest('details');
    const button = details?.querySelector('summary .remove-filter-btn');
    if (button) {
      button.style.display = checkedCount > 0 ? 'inline-block' : 'none';
    }
  });
}

function removeFilter(containerId, event) {
  event.stopPropagation();
  const checkboxes = document.querySelectorAll(`#${containerId} input[type="checkbox"]:checked`);
  checkboxes.forEach(cb => { cb.checked = false; });
  filter();
}

function fix(agent) {
  if (filteredIssues.length === 0) return;
  const prompt = document.getElementById('prompt').value;
  const filePath = currentFile.includes(':') ? currentFile.split(':').slice(1).join(':') : currentFile;
  const dir = document.getElementById('dir').value;
  vscode.postMessage({ command: agent === 'cursor' ? 'fixWithCursor' : 'fixWithCopilot', prompt: prompt, file: filePath, dir: dir });
}

window.addEventListener('message', event => {
  const message = event.data;
  if (message.command === 'initialize') {
    initializeUI(message.issues, message.workspaceFolder, message.defaultPrompts, message.customPrompts);
  } else if (message.command === 'customPromptSaved') {
    loadPrompts(message.defaultPrompts, message.customPrompts);
  }
});

