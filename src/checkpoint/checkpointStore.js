import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config/index.js';
import {
  createJobState,
  loadJobState,
  reconcileJobState,
  saveJobState,
} from '../queue/queueStore.js';
import { normalizeStartUrl } from '../crawler/urlNormalizer.js';

function ensureCheckpointDir() {
  fs.mkdirSync(config.paths.checkpoint, { recursive: true });
}

function getIndexPath() {
  return path.join(config.paths.checkpoint, 'index.json');
}


function loadIndex() {
  ensureCheckpointDir();
  const indexPath = getIndexPath();

  if (!fs.existsSync(indexPath)) {
    return { byUrl: {}, latestId: null };
  }

  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  index.byUrl = index.byUrl ?? {};
  return index;
}

function writeIndex(index) {
  ensureCheckpointDir();
  const indexPath = getIndexPath();
  const tempPath = `${indexPath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(index, null, 2), 'utf8');
  fs.renameSync(tempPath, indexPath);
}

export function isCheckpointResumable(state) {
  if (!state) {
    return false;
  }

  reconcileJobState(state);

  if (state.status === 'completed') {
    return false;
  }

  return state.pending.length > 0 || state.stats.completedCount < state.stats.total;
}

export function createCheckpoint(startUrl, urls, options = {}) {
  const normalizedStartUrl = normalizeStartUrl(startUrl);
  const pages =
    options.pages ??
    urls.map((pageUrl) => ({
      url: pageUrl,
      finalUrl: pageUrl,
      statusCode: 200,
    }));

  const state = createJobState(urls, {
    id: options.id,
    concurrency: options.concurrency,
    maxRetries: options.maxRetries,
  });

  state.startUrl = normalizedStartUrl;
  state.phase = options.phase ?? 'pagespeed';
  state.pages = pages;
  state.crawlCompleted = true;

  return state;
}

export function loadCheckpointByStartUrl(startUrl) {
  const normalizedStartUrl = normalizeStartUrl(startUrl);
  const index = loadIndex();
  const checkpointId = index.byUrl[normalizedStartUrl];

  if (!checkpointId) {
    return null;
  }

  try {
    const state = loadJobState(checkpointId);
    reconcileJobState(state);
    return state;
  } catch {
    return null;
  }
}

export function loadLatestCheckpoint() {
  const index = loadIndex();

  if (!index.latestId) {
    return null;
  }

  try {
    const state = loadJobState(index.latestId);
    reconcileJobState(state);
    return state;
  } catch {
    return null;
  }
}

export async function saveCheckpoint(state) {
  reconcileJobState(state);
  state.updatedAt = new Date().toISOString();

  await saveJobState(state);

  const index = loadIndex();
  if (state.startUrl) {
    index.byUrl[state.startUrl] = state.id;
  }
  index.latestId = state.id;
  writeIndex(index);

  return state;
}

export async function markCheckpointCompleted(state) {
  state.status = 'completed';
  state.phase = 'completed';
  state.stats.finishedAt = new Date().toISOString();
  state.stats.remainingCount = 0;
  return saveCheckpoint(state);
}

export function getCompletedUrls(state) {
  reconcileJobState(state);
  return Object.keys(state.results ?? {});
}

export default {
  createCheckpoint,
  loadCheckpointByStartUrl,
  loadLatestCheckpoint,
  saveCheckpoint,
  markCheckpointCompleted,
  isCheckpointResumable,
  getCompletedUrls,
};
