import { createRunLogger } from '../utils/runLogger.js';

export class WebUiAdapter {
  constructor(job) {
    this.job = job;
    this.runLogger = createRunLogger();
  }

  push(type, message, meta = null) {
    this.job.messages.push({
      type,
      message,
      meta,
      at: new Date().toISOString(),
    });

    if (this.job.messages.length > 100) {
      this.job.messages.shift();
    }
  }

  step(message, meta) {
    this.job.stage = message;
    this.push('step', message, meta);
    this.runLogger.write('info', message, meta);
  }

  success(message, meta) {
    this.push('success', message, meta);
    this.runLogger.write('success', message, meta);
  }

  info(message, meta) {
    this.push('info', message, meta);
    this.runLogger.write('info', message, meta);
  }

  error(message, meta) {
    this.push('error', message, meta);
    this.runLogger.write('error', message, meta);
  }

  retry(message, meta) {
    this.push('retry', message, meta);
    this.runLogger.write('warn', message, meta);
  }

  startSpinner() {}

  stopSpinner() {}

  printSummary(summary) {
    this.job.summary = summary;
  }
}

export default WebUiAdapter;
