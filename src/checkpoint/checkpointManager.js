import { config } from '../config/index.js';
import logger from '../utils/logger.js';
import { discoverWebsite } from '../crawler/index.js';
import { QueueManager } from '../queue/queueManager.js';
import { generatePageSpeedReports } from '../reports/pagespeedReport.js';
import {
  createCheckpoint,
  isCheckpointResumable,
  loadCheckpointByStartUrl,
  markCheckpointCompleted,
  saveCheckpoint,
} from './checkpointStore.js';

export class CheckpointManager {
  constructor(options = {}) {
    this.concurrency = options.concurrency ?? config.queue.concurrency;
    this.maxRetries = options.maxRetries ?? config.queue.maxRetries;
    this.maxUrls = options.maxUrls;
    this.outputBasename = options.outputBasename ?? 'pagespeed-report';
    this.ui = options.ui ?? null;
    this.queueManager = new QueueManager({
      showProgress: false,
      concurrency: this.concurrency,
      maxRetries: this.maxRetries,
    });
    this.activeState = null;
  }

  async persist(state) {
    this.activeState = state;
    await saveCheckpoint(state);
    return state;
  }

  registerShutdownHandlers() {
    const saveActive = async () => {
      if (this.activeState && this.activeState.status === 'running') {
        this.activeState.status = 'paused';
        await saveCheckpoint(this.activeState);
        logger.info('Checkpoint saved on shutdown', { jobId: this.activeState.id });
        this.ui?.info('Checkpoint saved before exit');
      }
    };

    process.once('SIGINT', () => {
      saveActive()
        .then(() => process.exit(130))
        .catch(() => process.exit(130));
    });

    process.once('SIGTERM', () => {
      saveActive()
        .then(() => process.exit(143))
        .catch(() => process.exit(143));
    });
  }

  createCheckpointFromDiscovery(startUrl, urls, discoveryMethod = 'unknown') {
    const state = createCheckpoint(startUrl, urls, {
      concurrency: this.concurrency,
      maxRetries: this.maxRetries,
    });
    state.discoveryMethod = discoveryMethod;
    return state;
  }

  async resolveCheckpoint(startUrl) {
    const existing = loadCheckpointByStartUrl(startUrl);

    if (isCheckpointResumable(existing)) {
      return { state: existing, resumed: true };
    }

    const discovery = await discoverWebsite(startUrl, {
      showProgress: false,
      maxUrls: this.maxUrls,
    });

    if (discovery.urls.length === 0) {
      throw new Error('No URLs found to analyze');
    }

    const state = this.createCheckpointFromDiscovery(
      startUrl,
      discovery.urls,
      discovery.discoveryMethod
    );

    await this.persist(state);
    return { state, resumed: false, discovery };
  }

  async runPageSpeedPhase(state, progress) {
    state.status = 'running';
    await this.persist(state);
    progress?.update(state.stats.completedCount, state.stats.failedCount);

    const ui = this.ui;
    let rateLimitWarned = false;

    const finalState = await this.queueManager.runJob(state, {
      onUrlStart(_url, job) {
        progress?.update(job.stats.completedCount, job.stats.failedCount);
      },
      onUrlSuccess(url) {
        ui?.runLogger?.write('success', `Completed ${url}`, { url });
      },
      onUrlRetry(url, attempts, maxRetries, error) {
        ui?.retry(`Retry ${attempts}/${maxRetries} for ${url} (${error.message})`, {
          url,
          attempts,
          maxRetries,
        });

        if (!rateLimitWarned && !config.pagespeed.apiKey && /rate limit|429/i.test(error.message)) {
          rateLimitWarned = true;
          ui?.error(
            'PageSpeed API rate limit reached. Set PAGESPEED_API_KEY in .env to continue reliably.'
          );
        }
      },
      onUrlFailed(url, attempts, error) {
        ui?.error(`Failed ${url} after ${attempts} attempts (${error.message})`, {
          url,
          attempts,
        });
      },
      onUrlComplete: async (_url, job, durationMs) => {
        progress?.recordCompletion(
          durationMs,
          job.stats.completedCount,
          job.stats.failedCount
        );
        await this.persist(job);
      },
    });

    this.activeState = finalState;
    return finalState;
  }

  async generateReport(state) {
    const results = this.queueManager.getResults(state);
    const reports = await generatePageSpeedReports(results, {
      pages: state.pages ?? [],
      outputBasename: this.outputBasename,
    });

    await markCheckpointCompleted(state);
    this.activeState = state;

    return { results, reports };
  }
}

export default CheckpointManager;
