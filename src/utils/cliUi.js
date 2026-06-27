const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
};

function paint(color, text) {
  return `${color}${text}${colors.reset}`;
}

export class Spinner {
  constructor(message) {
    this.message = message;
    this.frameIndex = 0;
    this.timer = null;
    this.active = false;
  }

  start() {
    if (this.active) {
      return;
    }

    this.active = true;
    this.timer = setInterval(() => {
      const frame = SPINNER_FRAMES[this.frameIndex++ % SPINNER_FRAMES.length];
      process.stdout.write(`\r${paint(colors.cyan, frame)} ${this.message}`);
    }, 90);
  }

  update(message) {
    this.message = message;
  }

  stop(finalMessage = '') {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    this.active = false;
    process.stdout.write(`\r${' '.repeat(Math.max(this.message.length + 4, 20))}\r`);

    if (finalMessage) {
      console.log(finalMessage);
    }
  }
}

export class CliUi {
  constructor(runLogger = null) {
    this.runLogger = runLogger;
    this.spinner = null;
  }

  log(level, message, meta = null) {
    this.runLogger?.write(level, message, meta);

    switch (level) {
      case 'success':
        console.log(paint(colors.green, `✔ ${message}`));
        break;
      case 'retry':
        console.log(paint(colors.yellow, `↻ ${message}`));
        break;
      case 'error':
        console.log(paint(colors.red, `✖ ${message}`));
        break;
      case 'info':
        console.log(paint(colors.cyan, `ℹ ${message}`));
        break;
      case 'step':
        console.log(paint(colors.blue, message));
        break;
      default:
        console.log(message);
    }
  }

  success(message, meta) {
    this.log('success', message, meta);
  }

  retry(message, meta) {
    this.log('retry', message, meta);
  }

  error(message, meta) {
    this.log('error', message, meta);
  }

  info(message, meta) {
    this.log('info', message, meta);
  }

  step(message, meta) {
    this.log('step', message, meta);
  }

  startSpinner(message) {
    this.stopSpinner();
    this.spinner = new Spinner(message);
    this.spinner.start();
    return this.spinner;
  }

  stopSpinner(finalMessage = '') {
    if (this.spinner) {
      this.spinner.stop(finalMessage);
      this.spinner = null;
    }
  }

  printSummary(summary) {
    const lines = [
      '',
      paint(colors.bold, 'Final Summary'),
      paint(colors.gray, '─'.repeat(32)),
      `${paint(colors.bold, 'Total URLs')}     ${summary.totalUrls}`,
      `${paint(colors.green, 'Success')}         ${summary.success}`,
      `${paint(colors.red, 'Failed')}           ${summary.failed}`,
      `${paint(colors.bold, 'Average Mobile')}  ${summary.averageMobile ?? 'N/A'}`,
      `${paint(colors.bold, 'Average Desktop')} ${summary.averageDesktop ?? 'N/A'}`,
      `${paint(colors.bold, 'Total Time')}      ${summary.totalTime}`,
      paint(colors.gray, '─'.repeat(32)),
    ];

    console.log(lines.join('\n'));
    this.runLogger?.write('info', 'Final summary', summary);
  }
}

export function formatDurationMinutes(ms) {
  if (!Number.isFinite(ms) || ms <= 0) {
    return '0 Minutes';
  }

  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  return `${minutes} Minute${minutes === 1 ? '' : 's'}`;
}

export function buildAuditSummary(finalState, results, startedAtMs) {
  const totalUrls = finalState.stats.total;
  const success = results.length;
  const failed = finalState.urls.filter((url) => !finalState.results[url]).length;

  let mobileTotal = 0;
  let mobileCount = 0;
  let desktopTotal = 0;
  let desktopCount = 0;

  for (const result of results) {
    if (result.mobile?.performanceScore != null) {
      mobileTotal += result.mobile.performanceScore;
      mobileCount += 1;
    }

    if (result.desktop?.performanceScore != null) {
      desktopTotal += result.desktop.performanceScore;
      desktopCount += 1;
    }
  }

  return {
    totalUrls,
    success,
    failed,
    averageMobile: mobileCount > 0 ? Math.round(mobileTotal / mobileCount) : null,
    averageDesktop: desktopCount > 0 ? Math.round(desktopTotal / desktopCount) : null,
    totalTime: formatDurationMinutes(Date.now() - startedAtMs),
    totalTimeMs: Date.now() - startedAtMs,
  };
}

export default CliUi;
