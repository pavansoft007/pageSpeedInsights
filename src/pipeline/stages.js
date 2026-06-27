export const PipelineStage = {
  INPUT: 'input',
  SITEMAP: 'sitemap',
  CRAWL: 'crawl',
  DEDUPE: 'dedupe',
  PAGESPEED: 'pagespeed',
  REPORTS: 'reports',
  SUMMARY: 'summary',
};

export const PipelineStageLabels = {
  [PipelineStage.INPUT]: 'Input URL',
  [PipelineStage.SITEMAP]: 'Check sitemap.xml',
  [PipelineStage.CRAWL]: 'Crawl website with Playwright',
  [PipelineStage.DEDUPE]: 'Remove duplicates and filter internal URLs',
  [PipelineStage.PAGESPEED]: 'Run Google PageSpeed Insights API',
  [PipelineStage.REPORTS]: 'Generate Excel and CSV reports',
  [PipelineStage.SUMMARY]: 'Summary dashboard, logs, and checkpoints',
};

export default PipelineStage;
