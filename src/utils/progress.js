import cliProgress from 'cli-progress';

export function createProgressBar(total, label = 'Processing') {
  const bar = new cliProgress.SingleBar(
    {
      format: `${label} |{bar}| {percentage}% | {value}/{total} | {url}`,
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true,
    },
    cliProgress.Presets.shades_classic
  );

  bar.start(total, 0, { url: '' });

  return {
    increment(payload = {}) {
      bar.increment(1, payload);
    },
    update(payload = {}) {
      if (payload.value !== undefined) {
        bar.update(payload.value, payload);
        return;
      }
      bar.update(bar.value, payload);
    },
    stop() {
      bar.stop();
    },
  };
}

export default createProgressBar;
