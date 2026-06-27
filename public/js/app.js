const form = document.getElementById('audit-form');
const urlInput = document.getElementById('url');
const urlLabel = document.getElementById('url-label');
const auditModeInput = document.getElementById('auditMode');
const modeHint = document.getElementById('mode-hint');
const modeButtons = [...document.querySelectorAll('.mode-btn')];
const submitBtn = document.getElementById('submit-btn');
const statusPanel = document.getElementById('status-panel');
const modeBadge = document.getElementById('mode-badge');
const statusBadge = document.getElementById('status-badge');
const statusStage = document.getElementById('status-stage');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');
const progressPercent = document.getElementById('progress-percent');
const messagesEl = document.getElementById('messages');
const summaryEl = document.getElementById('summary');
const downloadsEl = document.getElementById('downloads');
const downloadExcel = document.getElementById('download-excel');
const downloadCsv = document.getElementById('download-csv');
const errorBox = document.getElementById('error-box');

const MODE_COPY = {
  internal: {
    label: 'Internal URLs',
    urlLabel: 'Website URL (start page)',
    placeholder: 'https://www.example.com',
    hint: 'Discovers sitemap / crawls internal links and runs PageSpeed on all pages found.',
  },
  single: {
    label: 'Single URL',
    urlLabel: 'Page URL',
    placeholder: 'https://www.example.com/about-us',
    hint: 'Runs PageSpeed on this one URL only. No sitemap or crawl.',
  },
};

let pollTimer = null;
let currentAuditId = null;

function getSelectedAuditMode() {
  return auditModeInput.value === 'single' ? 'single' : 'internal';
}

function setAuditMode(mode) {
  const nextMode = mode === 'single' ? 'single' : 'internal';
  const copy = MODE_COPY[nextMode];

  auditModeInput.value = nextMode;
  urlLabel.textContent = copy.urlLabel;
  urlInput.placeholder = copy.placeholder;
  modeHint.textContent = copy.hint;
  modeBadge.textContent = copy.label;

  modeButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.mode === nextMode);
  });
}

function setModeControlsDisabled(disabled) {
  modeButtons.forEach((button) => {
    button.disabled = disabled;
  });
}

function showPanel() {
  statusPanel.classList.remove('hidden');
}

function setLoading(loading) {
  submitBtn.disabled = loading;
  submitBtn.textContent = loading ? 'Running...' : 'Start Audit';
  setModeControlsDisabled(loading);
}

function renderMessages(messages = []) {
  messagesEl.innerHTML = messages
    .map(
      (entry) =>
        `<div class="message ${entry.type}">${escapeHtml(entry.message)}</div>`
    )
    .join('');
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function renderProgress(progress = {}) {
  const completed = progress.completed ?? 0;
  const total = progress.total ?? 0;
  const percentage = progress.percentage ?? 0;

  progressFill.style.width = `${percentage}%`;
  progressText.textContent = `${completed} / ${total}`;
  progressPercent.textContent = `${percentage}%`;
}

function renderSummary(summary) {
  if (!summary) {
    summaryEl.classList.add('hidden');
    return;
  }

  summaryEl.classList.remove('hidden');
  summaryEl.innerHTML = `
    <div class="summary-item"><span>Total URLs</span><strong>${summary.totalUrls}</strong></div>
    <div class="summary-item"><span>Success</span><strong>${summary.success}</strong></div>
    <div class="summary-item"><span>Failed</span><strong>${summary.failed}</strong></div>
    <div class="summary-item"><span>Avg Mobile</span><strong>${summary.averageMobile ?? 'N/A'}</strong></div>
    <div class="summary-item"><span>Avg Desktop</span><strong>${summary.averageDesktop ?? 'N/A'}</strong></div>
    <div class="summary-item"><span>Total Time</span><strong>${summary.totalTime ?? 'N/A'}</strong></div>
  `;
}

function renderAudit(audit) {
  statusBadge.textContent = audit.status;
  statusBadge.className = `badge ${audit.status}`;

  if (audit.auditModeLabel) {
    modeBadge.textContent = audit.auditModeLabel;
  } else if (audit.auditMode) {
    setAuditMode(audit.auditMode);
  }

  statusStage.textContent = audit.stage ?? '';
  renderProgress(audit.progress);
  renderMessages(audit.messages);
  renderSummary(audit.summary);

  if (audit.status === 'completed' && audit.reports) {
    downloadsEl.classList.remove('hidden');
    downloadExcel.href = `/api/audits/${audit.id}/download/excel`;
    downloadCsv.href = `/api/audits/${audit.id}/download/csv`;
  } else {
    downloadsEl.classList.add('hidden');
  }

  if (audit.error) {
    errorBox.textContent = audit.error;
    errorBox.classList.remove('hidden');
  } else {
    errorBox.classList.add('hidden');
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

async function pollAudit(id) {
  const response = await fetch(`/api/audits/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch audit status');
  }

  const { audit } = await response.json();
  renderAudit(audit);

  if (audit.status === 'completed' || audit.status === 'failed') {
    clearInterval(pollTimer);
    pollTimer = null;
    setLoading(false);
  }
}

function startPolling(id) {
  if (pollTimer) {
    clearInterval(pollTimer);
  }

  pollTimer = setInterval(() => {
    pollAudit(id).catch((error) => {
      clearInterval(pollTimer);
      pollTimer = null;
      setLoading(false);
      errorBox.textContent = error.message;
      errorBox.classList.remove('hidden');
    });
  }, 2000);

  pollAudit(id);
}

modeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    setAuditMode(button.dataset.mode);
  });
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const url = urlInput.value.trim();
  const auditMode = getSelectedAuditMode();
  if (!url) {
    return;
  }

  setLoading(true);
  showPanel();
  errorBox.classList.add('hidden');
  summaryEl.classList.add('hidden');
  downloadsEl.classList.add('hidden');
  messagesEl.innerHTML = '';
  renderProgress({ completed: 0, total: 0, percentage: 0 });
  modeBadge.textContent = MODE_COPY[auditMode].label;

  try {
    const response = await fetch('/api/audits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, auditMode }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message ?? 'Failed to start audit');
    }

    currentAuditId = data.audit.id;
    renderAudit(data.audit);
    startPolling(currentAuditId);
  } catch (error) {
    setLoading(false);
    errorBox.textContent = error.message;
    errorBox.classList.remove('hidden');
  }
});

setAuditMode('internal');
