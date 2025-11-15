import * as fs from 'fs';
import * as path from 'path';

export function logAudit(workspaceFolder: string, action: string, details: any = {}) {
  const auditPath = path.join(workspaceFolder, '.vscode', 'sonar-ai', 'audit-log.json');
  const auditDir = path.dirname(auditPath);
  
  if (!fs.existsSync(auditDir)) {
    fs.mkdirSync(auditDir, { recursive: true });
  }
  
  const logEntry = {
    timestamp: new Date().toISOString(),
    action,
    ...details
  };
  
  let logs = [];
  if (fs.existsSync(auditPath)) {
    logs = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
  }
  
  logs.push(logEntry);
  fs.writeFileSync(auditPath, JSON.stringify(logs, null, 2));
}

