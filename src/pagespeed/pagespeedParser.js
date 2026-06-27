function simplifyDetails(details) {
  if (!details) {
    return null;
  }

  if (details.type === 'table') {
    return {
      type: 'table',
      headings: details.headings,
      items: details.items?.slice(0, 25) ?? [],
    };
  }

  if (details.type === 'opportunity') {
    return {
      type: 'opportunity',
      overallSavingsMs: details.overallSavingsMs ?? null,
      overallSavingsBytes: details.overallSavingsBytes ?? null,
      items: details.items?.slice(0, 25) ?? [],
    };
  }

  if (details.type === 'list') {
    return {
      type: 'list',
      items: details.items?.slice(0, 25) ?? [],
    };
  }

  if (details.type === 'debugdata') {
    return {
      type: 'debugdata',
      items: details.items?.slice(0, 25) ?? details,
    };
  }

  return details;
}

function extractAudit(audit) {
  if (!audit) {
    return null;
  }

  return {
    id: audit.id,
    title: audit.title,
    description: audit.description,
    score: audit.score ?? null,
    displayValue: audit.displayValue ?? null,
    numericValue: audit.numericValue ?? null,
    scoreDisplayMode: audit.scoreDisplayMode ?? null,
    warnings: audit.warnings ?? [],
    details: simplifyDetails(audit.details),
  };
}

function extractMetric(audits, auditId) {
  const audit = audits?.[auditId];
  if (!audit) {
    return null;
  }

  return {
    displayValue: audit.displayValue ?? null,
    numericValue: audit.numericValue ?? null,
    score: audit.score ?? null,
  };
}

function scoreToPercent(score) {
  return score != null ? Math.round(score * 100) : null;
}

function formatFieldMs(ms) {
  if (ms == null || Number.isNaN(ms)) {
    return null;
  }

  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(1)} s`;
  }

  return `${Math.round(ms)} ms`;
}

function extractFieldMetrics(data) {
  const loading = data.loadingExperience;
  if (!loading?.metrics) {
    return null;
  }

  const metrics = loading.metrics;
  const clsPercentile = metrics.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile;

  return {
    overallCategory: loading.overall_category ?? null,
    lcpMs: metrics.LARGEST_CONTENTFUL_PAINT_MS?.percentile ?? null,
    inpMs: metrics.INTERACTION_TO_NEXT_PAINT?.percentile ?? null,
    cls: clsPercentile != null ? clsPercentile / 100 : null,
    fcpMs: metrics.FIRST_CONTENTFUL_PAINT_MS?.percentile ?? null,
    ttfbMs: metrics.EXPERIMENTAL_TIME_TO_FIRST_BYTE?.percentile ?? null,
    lcp: formatFieldMs(metrics.LARGEST_CONTENTFUL_PAINT_MS?.percentile),
    inp: formatFieldMs(metrics.INTERACTION_TO_NEXT_PAINT?.percentile),
    clsDisplay: clsPercentile != null ? String(clsPercentile / 100) : null,
    fcp: formatFieldMs(metrics.FIRST_CONTENTFUL_PAINT_MS?.percentile),
  };
}

function extractDiagnostics(audits) {
  const diagnostics = [];

  for (const [id, audit] of Object.entries(audits)) {
    if (!audit || audit.scoreDisplayMode !== 'informative') {
      continue;
    }

    if (!audit.displayValue && audit.numericValue == null && !audit.details) {
      continue;
    }

    diagnostics.push({
      id,
      title: audit.title,
      description: audit.description,
      displayValue: audit.displayValue ?? null,
      numericValue: audit.numericValue ?? null,
    });
  }

  return diagnostics.slice(0, 50);
}

function extractImageOptimization(audits) {
  return {
    usesOptimizedImages: extractAudit(audits['uses-optimized-images']),
    modernImageFormats: extractAudit(audits['modern-image-formats']),
    usesResponsiveImages: extractAudit(audits['uses-responsive-images']),
    efficientlyEncodeImages: extractAudit(audits['uses-efficiently-encoded-images']),
    offscreenImages: extractAudit(audits['offscreen-images']),
    properAspectRatio: extractAudit(audits['image-aspect-ratio']),
  };
}

export function parseStrategyResult(data, strategy) {
  const lighthouse = data.lighthouseResult ?? {};
  const categories = lighthouse.categories ?? {};
  const audits = lighthouse.audits ?? {};

  return {
    strategy,
    fetchedAt: new Date().toISOString(),
    dataSource: 'lab',
    fieldData: extractFieldMetrics(data),
    performanceScore: scoreToPercent(categories.performance?.score),
    accessibilityScore: scoreToPercent(categories.accessibility?.score),
    bestPracticesScore: scoreToPercent(categories['best-practices']?.score),
    seoScore: scoreToPercent(categories.seo?.score),
    fcp: extractMetric(audits, 'first-contentful-paint'),
    lcp: extractMetric(audits, 'largest-contentful-paint'),
    inp: extractMetric(audits, 'interaction-to-next-paint'),
    cls: extractMetric(audits, 'cumulative-layout-shift'),
    speedIndex: extractMetric(audits, 'speed-index'),
    totalBlockingTime: extractMetric(audits, 'total-blocking-time'),
    timeToInteractive: extractMetric(audits, 'interactive'),
    largestContentfulPaintElement: extractAudit(audits['largest-contentful-paint-element']),
    unusedCss: extractAudit(audits['unused-css-rules']),
    unusedJs: extractAudit(audits['unused-javascript']),
    renderBlockingResources: extractAudit(audits['render-blocking-resources']),
    imageOptimization: extractImageOptimization(audits),
    diagnostics: extractDiagnostics(audits),
    lighthouseVersion: lighthouse.lighthouseVersion ?? null,
  };
}

export function parsePageSpeedResult(url, mobileData, desktopData) {
  return {
    url,
    mobile: parseStrategyResult(mobileData, 'mobile'),
    desktop: parseStrategyResult(desktopData, 'desktop'),
  };
}

export function flattenPageSpeedResult(result) {
  const rows = [];

  for (const strategy of ['mobile', 'desktop']) {
    const data = result[strategy];
    if (!data || data.error) {
      rows.push({
        url: result.url,
        strategy,
        error: data?.error ?? 'Missing strategy data',
      });
      continue;
    }

    rows.push({
      url: result.url,
      strategy,
      performanceScore: data.performanceScore,
      accessibilityScore: data.accessibilityScore,
      bestPracticesScore: data.bestPracticesScore,
      seoScore: data.seoScore,
      firstContentfulPaint: data.fcp?.displayValue ?? null,
      largestContentfulPaint: data.lcp?.displayValue ?? null,
      interactionToNextPaint: data.inp?.displayValue ?? null,
      cumulativeLayoutShift: data.cls?.displayValue ?? null,
      speedIndex: data.speedIndex?.displayValue ?? null,
      totalBlockingTime: data.totalBlockingTime?.displayValue ?? null,
      timeToInteractive: data.timeToInteractive?.displayValue ?? null,
      fetchedAt: data.fetchedAt,
      error: null,
    });
  }

  return rows;
}

export default parsePageSpeedResult;
