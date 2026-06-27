import cliProgress from 'cli-progress';
import { formatDurationMinutes } from './cliUi.js';

const BAR_WIDTH = 17;

function formatEtaText(completed, remainingMs) {
  if (completed === 0) {
    return 'Calculating...';
  }

  if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
    return '0 Minutes';
  }

  return formatDurationMinutes(remainingMs);
}

export class AuditProgress {
  constructor(total) {
    this.total = total;
    this.completed = 0;
    this.errors = 0;
    this.startedAt = Date.now();
    this.durations = [];

    this.bar = new cliProgress.SingleBar(
      {
        format:
          '[{bar}] Completed {value}/{total}\nETA {etaText}{retryLine}',
        barsize: BAR_WIDTH,
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        hideCursor: true,
        clearOnComplete: false,
        stopOnComplete: true,
      },
      cliProgress.Presets.shades_classic
    );

    this.bar.start(total, 0, this.buildPayload());
  }

  estimateRemainingMs() {
    const remaining = Math.max(this.total - this.completed, 0);
    if (remaining === 0 || this.completed === 0) {
      return 0;
    }

    const averageMs =
      this.durations.length > 0
        ? this.durations.reduce((sum, value) => sum + value, 0) / this.durations.length
        : (Date.now() - this.startedAt) / this.completed;

    return averageMs * remaining;
  }

  buildPayload() {
    return {
      etaText: formatEtaText(this.completed, this.estimateRemainingMs()),
      retryLine: this.errors > 0 ? `\nRetries/Errors ${this.errors}` : '',
    };
  }

  update(completed, errors = 0) {
    this.completed = completed;
    this.errors = errors;
    this.bar.update(completed, this.buildPayload());
  }

  recordCompletion(durationMs, completed, errors = 0) {
    if (durationMs > 0) {
      this.durations.push(durationMs);
    }

    this.update(completed, errors);
  }

  finish() {
    this.bar.update(this.completed, {
      etaText: formatEtaText(this.completed, 0),
      retryLine: this.errors > 0 ? `\nRetries/Errors ${this.errors}` : '',
    });
    this.bar.stop();
  }
}

export default AuditProgress;
