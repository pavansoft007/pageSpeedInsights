import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { config } from '../config/index.js';
import logger from '../utils/logger.js';

function ensureStateDir() {
  fs.mkdirSync(config.paths.queue, { recursive: true });
}

function getJobPath(jobId) {
  return path.join(config.paths.queue, `${jobId}.json`);
}

function getLatestJobPath() {
  return path.join(config.paths.queue, 'latest.json');
}

let saveChain = Promise.resolve();

export function createJobState(urls, options = {}) {
  const uniqueUrls = [...new Set(urls)];
  const now = new Date().toISOString();

  return {
    id: options.id ?? randomUUID(),
    createdAt: options.createdAt ?? now,
    updatedAt: now,
    status: 'pending',
    concurrency: options.concurrency ?? config.queue.concurrency,
    maxRetries: options.maxRetries ?? config.queue.maxRetries,
    urls: uniqueUrls,
    pending: [...uniqueUrls],
    processing: [],
    completed: [],
    results: {},
    errors: [],
    retryCounts: {},
    stats: {
      total: uniqueUrls.length,
      completedCount: 0,
      failedCount: 0,
      remainingCount: uniqueUrls.length,
      startedAt: null,
      finishedAt: null,
      averageMsPerUrl: 0,
      totalElapsedMs: 0,
    },
  };
}

export function loadJobState(jobId) {
  ensureStateDir();
  const filepath = getJobPath(jobId);

  if (!fs.existsSync(filepath)) {
    throw new Error(`Queue job not found: ${jobId}`);
  }

  const state = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  reconcileJobState(state);
  return state;
}

export function loadLatestJobState() {
  ensureStateDir();
  const latestPath = getLatestJobPath();

  if (!fs.existsSync(latestPath)) {
    return null;
  }

  const { jobId } = JSON.parse(fs.readFileSync(latestPath, 'utf8'));
  return loadJobState(jobId);
}

export function reconcileJobState(state) {
  const completedSet = new Set(state.completed ?? []);
  const resultUrls = new Set(Object.keys(state.results ?? {}));

  for (const url of resultUrls) {
    completedSet.add(url);
  }

  state.completed = [...completedSet];
  state.results = state.results ?? {};
  state.errors = state.errors ?? [];
  state.retryCounts = state.retryCounts ?? {};
  state.processing = [];

  state.pending = state.urls.filter(
    (url) => !completedSet.has(url) && !isPermanentlyFailed(state, url)
  );

  state.stats.completedCount = state.completed.length;
  state.stats.failedCount = state.errors.length;
  state.stats.remainingCount = state.pending.length;
  state.stats.total = state.urls.length;
}

function isPermanentlyFailed(state, url) {
  return (state.retryCounts[url] ?? 0) >= state.maxRetries;
}

function writeJobStateSync(state) {
  ensureStateDir();
  state.updatedAt = new Date().toISOString();

  const filepath = getJobPath(state.id);
  const tempPath = `${filepath}.tmp`;
  const payload = JSON.stringify(state, null, 2);

  fs.writeFileSync(tempPath, payload, 'utf8');
  fs.renameSync(tempPath, filepath);
  fs.writeFileSync(getLatestJobPath(), JSON.stringify({ jobId: state.id, updatedAt: state.updatedAt }), 'utf8');
}

export async function saveJobState(state) {
  saveChain = saveChain.then(() => {
    writeJobStateSync(state);
    logger.debug('Queue progress saved', {
      jobId: state.id,
      completed: state.stats.completedCount,
      remaining: state.stats.remainingCount,
    });
  });

  return saveChain;
}

export function listJobs() {
  ensureStateDir();
  return fs
    .readdirSync(config.paths.queue)
    .filter((name) => name.endsWith('.json') && name !== 'latest.json')
    .map((name) => {
      const state = JSON.parse(fs.readFileSync(path.join(config.paths.queue, name), 'utf8'));
      return {
        id: state.id,
        status: state.status,
        total: state.stats?.total ?? state.urls?.length ?? 0,
        completed: state.stats?.completedCount ?? 0,
        updatedAt: state.updatedAt,
      };
    })
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

export default {
  createJobState,
  loadJobState,
  loadLatestJobState,
  saveJobState,
  listJobs,
  reconcileJobState,
};
