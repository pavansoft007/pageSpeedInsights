import cliProgress from 'cli-progress';

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) {
    return '--';
  }

  const totalSeconds = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

function truncateUrl(url, maxLength = 70) {
  if (!url || url.length <= maxLength) {
    return url ?? '';
  }

  return `${url.slice(0, maxLength - 3)}...`;
}

export class QueueProgress {
  constructor(total) {
    this.startedAt = Date.now();
    this.completedDurations = [];

    this.bar = new cliProgress.SingleBar(
      {
        format:
          'PageSpeed Queue |{bar}| {percentage}% | {value}/{total}\n' +
          'Current:   {currentUrl}\n' +
          'Completed: {completed} | Remaining: {remaining} | ETA: {eta} | Errors: {errors}',
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        hideCursor: true,
        clearOnComplete: false,
      },
      cliProgress.Presets.shades_classic
    );

    this.bar.start(total, 0, this.buildPayload('', 0, total, 0));
  }

  buildPayload(currentUrl, completed, total, errors) {
    const remaining = Math.max(total - completed, 0);
    const eta = this.estimateRemainingMs(completed, remaining);

    return {
      currentUrl: truncateUrl(currentUrl),
      completed,
      remaining,
      eta: formatDuration(eta),
      errors,
    };
  }

  estimateRemainingMs(completed, remaining) {
    if (remaining <= 0 || completed <= 0) {
      return 0;
    }

    const averageMs =
      this.completedDurations.length > 0
        ? this.completedDurations.reduce((sum, value) => sum + value, 0) /
          this.completedDurations.length
        : (Date.now() - this.startedAt) / completed;

    return averageMs * remaining;
  }

  setCurrentUrl(url, completed, total, errors) {
    this.bar.update(completed, this.buildPayload(url, completed, total, errors));
  }

  recordCompletion(durationMs, completed, total, errors, currentUrl = '') {
    if (durationMs > 0) {
      this.completedDurations.push(durationMs);
    }

    this.bar.update(completed, this.buildPayload(currentUrl, completed, total, errors));
  }

  stop(completed, total, errors) {
    this.bar.update(completed, this.buildPayload('Done', completed, total, errors));
    this.bar.stop();
  }
}

export default QueueProgress;
