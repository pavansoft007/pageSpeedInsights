# Website Performance Auditor

Production-ready Node.js application for auditing website performance. It discovers URLs via sitemap or Playwright crawl, analyzes them with Google PageSpeed Insights, and exports results to Excel and CSV.

## Pipeline

```
Input URL
    │
    ▼
Check sitemap.xml
    │
    ├── If found → Extract all URLs
    │
    └── If not found → Crawl website with Playwright
                     │
                     ▼
Remove duplicates & filter internal URLs
                     │
                     ▼
Run Google PageSpeed Insights API
(Mobile + Desktop, with concurrent requests)
                     │
                     ▼
Generate Excel + CSV reports
                     │
                     ▼
Summary dashboard + logs + resume checkpoints
```

## Requirements

- Node.js 22+
- npm

## Setup

```bash
npm install
npx playwright install chromium
cp .env.example .env
```

Set `PAGESPEED_API_KEY` in `.env` for reliable API access.

## Usage

### Run a full audit

```bash
npm start https://example.com
```

Re-run the same URL to automatically resume from the last checkpoint.

### Start API server

```bash
npm start
npm run server
```

### Other commands

```bash
npm run audit -- https://example.com
npm run crawl -- https://example.com
npm run pagespeed -- https://example.com
npm run queue -- https://example.com
```

## Output

| Output | Location |
|--------|----------|
| Excel report | `reports/pagespeed-report.xlsx` |
| CSV report | `reports/pagespeed-report.csv` |
| Run log | `logs/run-YYYY-MM-DD.log` |
| Checkpoint | `reports/checkpoint/{jobId}.json` |

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `CRAWL_MAX_PAGES` | `10000` | Max URLs to discover |
| `CRAWL_PREFER_SITEMAP` | `true` | Try sitemap before crawling |
| `PAGESPEED_QUEUE_CONCURRENCY` | `5` | Concurrent PageSpeed workers |
| `PAGESPEED_API_KEY` | — | Google PageSpeed API key |
| `CHECKPOINT_DIR` | `reports/checkpoint` | Checkpoint JSON directory |

## Architecture

| Module | Role |
|--------|------|
| `pipeline/` | End-to-end audit orchestration |
| `crawler/` | Sitemap, robots.txt, Playwright crawl, URL dedup |
| `pagespeed/` | PageSpeed Insights API (mobile + desktop) |
| `queue/` | Concurrent job processing with retries |
| `checkpoint/` | JSON checkpoints with auto-resume |
| `reports/` | Excel + CSV report generation |

## License

MIT
