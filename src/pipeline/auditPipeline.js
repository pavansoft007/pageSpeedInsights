import path from 'node:path';
import { config } from '../config/index.js';
import { CheckpointManager } from '../checkpoint/checkpointManager.js';
import { discoverWebsite } from '../crawler/index.js';
import { loadCheckpointByStartUrl, isCheckpointResumable } from '../checkpoint/checkpointStore.js';
import { AuditProgress } from '../utils/auditProgress.js';
import { buildAuditSummary } from '../utils/cliUi.js';
import { PipelineStage, PipelineStageLabels } from './stages.js';

function validateUrl(input, normalizeStartUrlFn, isValidHttpUrl) {
  if (!input || typeof input !== 'string') {
    throw new Error('Usage: npm start <url>');
  }

  const normalized = normalizeStartUrlFn(input);

  if (!normalized || !isValidHttpUrl(normalized)) {
    throw new Error(`Invalid URL: ${input}`);
  }

  return normalized;
}

function toRelativePath(filepath) {
  return path.relative(config.projectRoot, filepath).replace(/\\/g, '/');
}

export class AuditPipeline {
  constructor(options = {}) {
    this.options = options;
    this.manager = new CheckpointManager(options);
    this.startedAtMs = Date.now();
  }

  logStage(ui, stage, detail = '') {
    const label = PipelineStageLabels[stage] ?? stage;
    ui?.runLogger?.write('info', label, detail ? { detail } : null);
    ui?.step(detail ? `${label} — ${detail}` : label);
  }

  async discoverUrls(startUrl, ui) {
    this.logStage(ui, PipelineStage.SITEMAP, 'checking robots.txt and sitemap.xml');
    ui?.startSpinner('Checking sitemap.xml...');

    const discovery = await discoverWebsite(startUrl, {
      showProgress: false,
      maxUrls: this.options.maxUrls,
    });

    ui?.stopSpinner();

    if (discovery.discoveryMethod === 'sitemap') {
      ui?.success(`Sitemap found — extracted ${discovery.urls.length} internal URLs`);
    } else {
      ui?.info('Sitemap not found — crawled website with Playwright');
      ui?.success(`Crawl complete — found ${discovery.urls.length} internal URLs`);
    }

    this.logStage(
      ui,
      PipelineStage.DEDUPE,
      `${discovery.urls.length} unique internal URLs (${discovery.stats?.duplicateCanonicals ?? 0} duplicate canonicals removed)`
    );

    return discovery;
  }

  async run(startUrl, { ui, runLogger, validateDeps }) {
    const url = validateUrl(
      startUrl,
      validateDeps.normalizeStartUrl,
      validateDeps.isValidHttpUrl
    );

    this.logStage(ui, PipelineStage.INPUT, url);
    this.manager.registerShutdownHandlers();

    const existing = loadCheckpointByStartUrl(url);
    let state;
    let resumed = false;

    if (isCheckpointResumable(existing)) {
      state = existing;
      resumed = true;
      ui?.info(
        `Checkpoint loaded — resuming ${state.stats.completedCount}/${state.stats.total} completed URLs`
      );
      ui?.info(`Skipping ${state.stats.completedCount} already completed URLs`);
    } else {
      const discovery = await this.discoverUrls(url, ui);

      if (discovery.urls.length === 0) {
        throw new Error('No URLs found to analyze');
      }

      state = this.manager.createCheckpointFromDiscovery(
        url,
        discovery.urls,
        discovery.discoveryMethod
      );
      await this.manager.persist(state);
    }

    this.logStage(
      ui,
      PipelineStage.PAGESPEED,
      'mobile + desktop strategies, concurrent requests'
    );

    const progress = new AuditProgress(state.stats.total);
    progress.update(state.stats.completedCount, state.stats.failedCount);

    let finalState;

    try {
      finalState = await this.manager.runPageSpeedPhase(state, progress);
    } catch (error) {
      progress.finish();
      await this.manager.persist(state);
      ui?.error(`PageSpeed phase failed: ${error.message}`);
      throw error;
    }

    progress.finish();
    ui?.success('PageSpeed analysis completed');

    this.logStage(ui, PipelineStage.REPORTS);
    ui?.startSpinner('Generating Excel and CSV reports...');

    const { results, reports } = await this.manager.generateReport(finalState);
    ui?.stopSpinner();
    ui?.success(`Excel report: ${toRelativePath(reports.excel)}`);
    ui?.success(`CSV report: ${toRelativePath(reports.csv)}`);

    this.logStage(ui, PipelineStage.SUMMARY);
    const summary = buildAuditSummary(finalState, results, this.startedAtMs);
    ui?.printSummary(summary);
    ui?.info(`Run log: ${runLogger.getRelativePath()}`);
    ui?.info(`Checkpoint: reports/checkpoint/${finalState.id}.json`);

    return {
      url,
      resumed,
      discoveryMethod: resumed ? 'checkpoint' : state.discoveryMethod,
      checkpointId: finalState.id,
      urlsFound: finalState.stats.total,
      analyzed: results.length,
      reportPath: reports.excel,
      reportCsvPath: reports.csv,
      logPath: runLogger.logPath,
      summary,
      errors: finalState.errors,
      status: finalState.status,
    };
  }
}

export default AuditPipeline;
