import pLimit from 'p-limit';
import { config } from '../config/index.js';
import logger from '../utils/logger.js';
import { PageSpeedService } from '../pagespeed/pagespeedService.js';
import {
  createJobState,
  loadJobState,
  loadLatestJobState,
  saveJobState,
  listJobs,
  reconcileJobState,
} from './queueStore.js';
import { QueueProgress } from './queueProgress.js';

export class QueueManager {
  constructor(options = {}) {
    this.concurrency = options.concurrency ?? config.queue.concurrency;
    this.maxRetries = options.maxRetries ?? config.queue.maxRetries;
    this.showProgress = options.showProgress ?? true;
    this.pageSpeed = new PageSpeedService({
      concurrency: 1,
      retries: options.retries ?? config.pagespeed.retries,
      retryDelayMs: options.retryDelayMs ?? config.pagespeed.retryDelayMs,
      rateLimitDelayMs: options.rateLimitDelayMs ?? config.pagespeed.rateLimitDelayMs,
    });
  }

  createJob(urls, options = {}) {
    return createJobState(urls, {
      concurrency: options.concurrency ?? this.concurrency,
      maxRetries: options.maxRetries ?? this.maxRetries,
    });
  }

  async run(urls, options = {}) {
    const state = this.createJob(urls, options);
    return this.runJob(state, options);
  }

  async resume(jobId, options = {}) {
    const state = loadJobState(jobId);
    reconcileJobState(state);
    return this.runJob(state, options);
  }

  async resumeLatest(options = {}) {
    const state = loadLatestJobState();

    if (!state) {
      throw new Error('No saved queue progress found');
    }

    reconcileJobState(state);
    return this.runJob(state, options);
  }

  isUrlDone(state, url) {
    if (state.results[url]) {
      return true;
    }

    return (state.retryCounts[url] ?? 0) >= state.maxRetries;
  }

  dequeueNext(state) {
    while (state.pending.length > 0) {
      const url = state.pending.shift();
      if (!this.isUrlDone(state, url)) {
        return url;
      }
    }

    return null;
  }

  hasWorkRemaining(state, inFlight) {
    if (inFlight > 0) {
      return true;
    }

    for (const url of state.pending) {
      if (!this.isUrlDone(state, url)) {
        return true;
      }
    }

    return state.stats.completedCount < state.stats.total &&
      state.urls.some((url) => !this.isUrlDone(state, url));
  }

  async runJob(state, options = {}) {
    reconcileJobState(state);

    if (state.urls.every((url) => this.isUrlDone(state, url))) {
      state.status = state.stats.completedCount === state.stats.total ? 'completed' : 'failed';
      state.stats.finishedAt = new Date().toISOString();
      state.stats.remainingCount = state.urls.filter((url) => !state.results[url]).length;
      await saveJobState(state);
      logger.info('Queue job already completed', { jobId: state.id });
      return state;
    }

    state.status = 'running';
    state.stats.startedAt = state.stats.startedAt ?? new Date().toISOString();
    await saveJobState(state);

    const limit = pLimit(state.concurrency ?? this.concurrency);
    const progress = this.showProgress ? new QueueProgress(state.stats.total) : null;
    let inFlight = 0;

    const markFailure = async (url, error) => {
      const attempts = (state.retryCounts[url] ?? 0) + 1;
      state.retryCounts[url] = attempts;

      state.errors.push({
        url,
        message: error.message,
        attempts,
        at: new Date().toISOString(),
      });
      state.stats.failedCount = state.errors.length;

      if (attempts < state.maxRetries) {
        state.pending.push(url);
        logger.warn('Queue URL failed, scheduled for retry', {
          url,
          attempts,
          maxRetries: state.maxRetries,
        });
        options.onUrlRetry?.(url, attempts, state.maxRetries, error);
      } else {
        logger.error('Queue URL permanently failed', { url, attempts });
        options.onUrlFailed?.(url, attempts, error);
      }

      if (
        !config.pagespeed.apiKey &&
        state.stats.completedCount === 0 &&
        state.stats.failedCount >= 10 &&
        state.errors.slice(-10).every((entry) => /rate limit|429/i.test(entry.message))
      ) {
        throw new Error(
          'PageSpeed API rate limit exceeded. Add PAGESPEED_API_KEY to .env, then re-run the same URL to resume.'
        );
      }

      state.stats.remainingCount = state.urls.filter((urlItem) => !this.isUrlDone(state, urlItem)).length;
      await saveJobState(state);
    };

    const processUrl = async (url) => {
      const startedAt = Date.now();

      progress?.setCurrentUrl(
        url,
        state.stats.completedCount,
        state.stats.total,
        state.stats.failedCount
      );
      options.onUrlStart?.(url, state);

      try {
        const result = await this.pageSpeed.analyzeUrl(url);

        state.results[url] = result;

        if (!state.completed.includes(url)) {
          state.completed.push(url);
        }

        state.stats.completedCount = state.completed.length;
        state.stats.remainingCount = state.urls.filter((urlItem) => !this.isUrlDone(state, urlItem)).length;
        state.stats.totalElapsedMs += Date.now() - startedAt;
        state.stats.averageMsPerUrl =
          state.stats.completedCount > 0
            ? Math.round(state.stats.totalElapsedMs / state.stats.completedCount)
            : 0;

        await saveJobState(state);

        const durationMs = Date.now() - startedAt;
        progress?.recordCompletion(
          durationMs,
          state.stats.completedCount,
          state.stats.total,
          state.stats.failedCount,
          url
        );
        options.onUrlComplete?.(url, state, durationMs);
        options.onUrlSuccess?.(url, state, result);
      } catch (error) {
        await markFailure(url, error);
        const durationMs = Date.now() - startedAt;
        progress?.recordCompletion(
          durationMs,
          state.stats.completedCount,
          state.stats.total,
          state.stats.failedCount,
          url
        );
        options.onUrlComplete?.(url, state, durationMs);
      }
    };

    const pump = async () => {
      while (this.hasWorkRemaining(state, inFlight)) {
        const batch = [];

        while (batch.length < state.concurrency) {
          const url = this.dequeueNext(state);
          if (!url) {
            break;
          }

          batch.push(
            limit(async () => {
              inFlight += 1;
              try {
                await processUrl(url);
              } finally {
                inFlight -= 1;
              }
            })
          );
        }

        if (batch.length > 0) {
          await Promise.all(batch);
          continue;
        }

        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    };

    try {
      logger.info('Queue job started', {
        jobId: state.id,
        total: state.stats.total,
        remaining: state.stats.remainingCount,
        concurrency: state.concurrency,
      });

      await pump();

      const unresolved = state.urls.filter((url) => !state.results[url]).length;
      state.status = unresolved > 0 ? 'failed' : 'completed';
      state.stats.finishedAt = new Date().toISOString();
      state.stats.remainingCount = unresolved;
      await saveJobState(state);

      progress?.stop(state.stats.completedCount, state.stats.total, state.stats.failedCount);

      logger.info('Queue job finished', {
        jobId: state.id,
        status: state.status,
        completed: state.stats.completedCount,
        errors: state.stats.failedCount,
      });

      return state;
    } catch (error) {
      state.status = 'failed';
      state.stats.finishedAt = new Date().toISOString();
      await saveJobState(state);
      progress?.stop(state.stats.completedCount, state.stats.total, state.stats.failedCount);
      throw error;
    }
  }

  getResults(state) {
    return state.urls
      .filter((url) => state.results[url])
      .map((url) => state.results[url]);
  }
}

export async function runPageSpeedQueue(urls, options = {}) {
  const manager = new QueueManager(options);
  const state = await manager.run(urls, options);
  return {
    jobId: state.id,
    status: state.status,
    results: manager.getResults(state),
    errors: state.errors,
    stats: state.stats,
  };
}

export async function resumePageSpeedQueue(jobId, options = {}) {
  const manager = new QueueManager(options);
  const state = jobId ? await manager.resume(jobId, options) : await manager.resumeLatest(options);
  return {
    jobId: state.id,
    status: state.status,
    results: manager.getResults(state),
    errors: state.errors,
    stats: state.stats,
  };
}

export { listJobs };
export default QueueManager;
