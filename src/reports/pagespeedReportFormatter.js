function metricValue(metric) {
  return metric?.displayValue ?? null;
}

function countStrategyIssues(strategyData) {
  if (!strategyData || strategyData.error) {
    return strategyData?.error ? 1 : 0;
  }

  let count = strategyData.diagnostics?.length ?? 0;
  const audits = [
    strategyData.unusedCss,
    strategyData.unusedJs,
    strategyData.renderBlockingResources,
    ...(Object.values(strategyData.imageOptimization ?? {})),
  ];

  for (const audit of audits) {
    if (audit?.score != null && audit.score < 0.9) {
      count += 1;
    }
  }

  return count;
}

export function buildReportRow(result, statusCodeMap = {}) {
  const { url, mobile, desktop } = result;
  const hasError = Boolean(mobile?.error || desktop?.error);
  const statusCode = statusCodeMap[url] ?? (hasError ? 0 : 200);

  return {
    url,
    statusCode,
    mobilePerformance: mobile?.performanceScore ?? null,
    desktopPerformance: desktop?.performanceScore ?? null,
    mobileAccessibility: mobile?.accessibilityScore ?? null,
    desktopAccessibility: desktop?.accessibilityScore ?? null,
    mobileBestPractices: mobile?.bestPracticesScore ?? null,
    desktopBestPractices: desktop?.bestPracticesScore ?? null,
    mobileSeo: mobile?.seoScore ?? null,
    desktopSeo: desktop?.seoScore ?? null,
    fcpMobile: metricValue(mobile?.fcp),
    fcpDesktop: metricValue(desktop?.fcp),
    lcpMobile: metricValue(mobile?.lcp),
    lcpDesktop: metricValue(desktop?.lcp),
    inpMobile: metricValue(mobile?.inp),
    inpDesktop: metricValue(desktop?.inp),
    clsMobile: metricValue(mobile?.cls),
    clsDesktop: metricValue(desktop?.cls),
    speedIndexMobile: metricValue(mobile?.speedIndex),
    speedIndexDesktop: metricValue(desktop?.speedIndex),
    totalBlockingTimeMobile: metricValue(mobile?.totalBlockingTime),
    totalBlockingTimeDesktop: metricValue(desktop?.totalBlockingTime),
    timeToInteractiveMobile: metricValue(mobile?.timeToInteractive),
    timeToInteractiveDesktop: metricValue(desktop?.timeToInteractive),
    fieldLcpMobile: mobile?.fieldData?.lcp ?? null,
    fieldLcpDesktop: desktop?.fieldData?.lcp ?? null,
    fieldInpMobile: mobile?.fieldData?.inp ?? null,
    fieldInpDesktop: desktop?.fieldData?.inp ?? null,
    fieldClsMobile: mobile?.fieldData?.clsDisplay ?? null,
    fieldClsDesktop: desktop?.fieldData?.clsDisplay ?? null,
    fieldCwvMobile: mobile?.fieldData?.overallCategory ?? null,
    fieldCwvDesktop: desktop?.fieldData?.overallCategory ?? null,
    issuesCount: countStrategyIssues(mobile) + countStrategyIssues(desktop),
    date: (mobile?.fetchedAt ?? desktop?.fetchedAt ?? new Date().toISOString()).slice(0, 10),
  };
}

function average(values) {
  const numbers = values.filter((value) => typeof value === 'number' && !Number.isNaN(value));
  if (numbers.length === 0) {
    return null;
  }
  return Math.round(numbers.reduce((sum, value) => sum + value, 0) / numbers.length);
}

function pagePerformanceScores(row) {
  return [row.mobilePerformance, row.desktopPerformance].filter(
    (value) => typeof value === 'number'
  );
}

export function isFailedRow(row) {
  if (row.statusCode === 0) {
    return true;
  }

  const scores = pagePerformanceScores(row);
  if (scores.length === 0) {
    return true;
  }

  return scores.some((score) => score < 50);
}

export function isPassedRow(row) {
  if (isFailedRow(row)) {
    return false;
  }

  return (
    typeof row.mobilePerformance === 'number' &&
    typeof row.desktopPerformance === 'number' &&
    row.mobilePerformance >= 90 &&
    row.desktopPerformance >= 90
  );
}

export function buildSummaryStats(rows) {
  const performanceScores = rows.flatMap(pagePerformanceScores);
  const mobilePerformance = rows.map((row) => row.mobilePerformance);
  const desktopPerformance = rows.map((row) => row.desktopPerformance);
  const accessibilityScores = rows.flatMap((row) => [row.mobileAccessibility, row.desktopAccessibility]);
  const bestPracticesScores = rows.flatMap((row) => [row.mobileBestPractices, row.desktopBestPractices]);
  const seoScores = rows.flatMap((row) => [row.mobileSeo, row.desktopSeo]);

  return {
    totalPages: rows.length,
    failedPages: rows.filter(isFailedRow).length,
    passedPages: rows.filter(isPassedRow).length,
    averageScores: {
      performance: average(performanceScores),
      accessibility: average(accessibilityScores),
      bestPractices: average(bestPracticesScores),
      seo: average(seoScores),
      mobilePerformance: average(mobilePerformance),
      desktopPerformance: average(desktopPerformance),
    },
    highestScore: performanceScores.length ? Math.max(...performanceScores) : null,
    lowestScore: performanceScores.length ? Math.min(...performanceScores) : null,
    categoryAverages: [
      {
        category: 'Performance',
        mobile: average(mobilePerformance),
        desktop: average(desktopPerformance),
      },
      {
        category: 'Accessibility',
        mobile: average(rows.map((row) => row.mobileAccessibility)),
        desktop: average(rows.map((row) => row.desktopAccessibility)),
      },
      {
        category: 'Best Practices',
        mobile: average(rows.map((row) => row.mobileBestPractices)),
        desktop: average(rows.map((row) => row.desktopBestPractices)),
      },
      {
        category: 'SEO',
        mobile: average(rows.map((row) => row.mobileSeo)),
        desktop: average(rows.map((row) => row.desktopSeo)),
      },
    ],
    performanceByPage: rows.map((row) => ({
      url: row.url,
      mobile: row.mobilePerformance,
      desktop: row.desktopPerformance,
    })),
  };
}

export function buildStatusCodeMap(pages = []) {
  return Object.fromEntries(
    pages.map((page) => [page.finalUrl || page.url, page.statusCode ?? 0])
  );
}

export default buildReportRow;
