# Website Performance Auditor

Production-ready Node.js application for auditing website performance. It crawls pages with Playwright, analyzes them via Google PageSpeed Insights, and exports results to Excel and CSV.

## Requirements

- Node.js 22+
- npm

## Tech Stack

| Package | Purpose |
|---------|---------|
| Express | HTTP API server |
| dotenv | Environment configuration |
| axios | PageSpeed Insights API client |
| Playwright | Headless browser crawling |
| Cheerio | HTML parsing and link extraction |
| ExcelJS | Excel report generation |
| csv-writer | CSV report generation |
| cli-progress | CLI progress bars |
| p-limit | Concurrent PageSpeed request limiting |
| Winston | Structured logging |

## Project Structure

```
website-performance-auditor/
├── src/
│   ├── crawler/          # Playwright crawling + Cheerio link extraction
│   ├── pagespeed/        # PageSpeed Insights API integration
│   ├── reports/          # Excel and CSV report generators
│   ├── services/         # Audit orchestration
│   ├── utils/            # Logger, URL helpers, errors
│   ├── config/           # Environment configuration
│   ├── routes/           # Express route handlers
│   ├── app.js            # Express application setup
│   ├── server.js         # Server entry point
│   └── cli.js            # Command-line interface
├── reports/              # Generated audit reports
├── logs/                 # Application logs
├── package.json
├── .env
└── README.md
```

## Setup

1. Install dependencies:

```bash
npm install
```

2. Install Playwright browsers:

```bash
npx playwright install chromium
```

3. Copy and configure environment variables:

```bash
cp .env.example .env
```

Optional: set `PAGESPEED_API_KEY` for higher Google API quotas. Get a key from [Google Cloud Console](https://console.cloud.google.com/).

## Usage

### Start the API server

```bash
npm start
```

Development mode with auto-reload:

```bash
npm run dev
```

### Run a CLI audit

```bash
npm run audit -- https://example.com
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/audits` | List all audits |
| POST | `/api/audits` | Start a new audit |
| GET | `/api/audits/:id` | Get audit status and results |

#### Start an audit

```bash
curl -X POST http://localhost:3000/api/audits \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "maxPages": 5,
    "maxDepth": 1,
    "strategy": "mobile"
  }'
```

#### Check audit status

```bash
curl http://localhost:3000/api/audits/<audit-id>
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `PAGESPEED_API_KEY` | — | Google PageSpeed API key |
| `CRAWL_MAX_PAGES` | `10` | Max pages to crawl |
| `CRAWL_MAX_DEPTH` | `2` | Max crawl depth |
| `CRAWL_TIMEOUT_MS` | `30000` | Page load timeout |
| `PAGESPEED_STRATEGY` | `mobile` | `mobile` or `desktop` |
| `PAGESPEED_CONCURRENCY` | `3` | Parallel PageSpeed requests |
| `REPORTS_DIR` | `reports` | Report output directory |
| `LOGS_DIR` | `logs` | Log file directory |

## Architecture

The app follows a service-oriented layout:

- **CrawlerService** — discovers pages using Playwright and extracts links with Cheerio
- **PageSpeedService** — runs Lighthouse metrics via the PageSpeed Insights API with concurrency control
- **ReportService** — generates Excel (multi-sheet) and CSV exports
- **AuditService** — orchestrates the full audit pipeline and tracks job state

## Output

Completed audits produce:

- **Excel** — Summary, crawl results, and PageSpeed metrics
- **CSV** — PageSpeed metrics for easy import into other tools

Reports are saved to the `reports/` directory.

## License

MIT
