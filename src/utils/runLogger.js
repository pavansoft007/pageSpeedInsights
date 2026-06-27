import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config/index.js';

function getRunLogPath(date = new Date()) {
  const day = date.toISOString().slice(0, 10);
  return path.join(config.paths.logs, `run-${day}.log`);
}

function formatMeta(meta) {
  if (!meta || Object.keys(meta).length === 0) {
    return '';
  }

  return ` ${JSON.stringify(meta)}`;
}

export class RunLogger {
  constructor() {
    fs.mkdirSync(config.paths.logs, { recursive: true });
    this.logPath = getRunLogPath();
    this.startedAt = new Date().toISOString();
    this.write('info', 'Audit run started', { logPath: this.logPath });
  }

  write(level, message, meta = null) {
    const line = `${new Date().toISOString()} [${level.toUpperCase()}] ${message}${formatMeta(meta)}\n`;
    fs.appendFileSync(this.logPath, line, 'utf8');
  }

  getRelativePath(projectRoot = config.projectRoot) {
    return path.relative(projectRoot, this.logPath).replace(/\\/g, '/');
  }
}

export function createRunLogger() {
  return new RunLogger();
}

export default createRunLogger;
