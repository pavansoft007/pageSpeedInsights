const form = document.getElementById('audit-form');
const urlInput = document.getElementById('url');
const submitBtn = document.getElementById('submit-btn');
const statusPanel = document.getElementById('status-panel');
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

let pollTimer = null;
let currentAuditId = null;

function showPanel() {
  statusPanel.classList.remove('hidden');
}

function setLoading(loading) {
  submitBtn.disabled = loading;
  submitBtn.textContent = loading ? 'Running...' : 'Start Audit';
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

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const url = urlInput.value.trim();
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

  try {
    const response = await fetch('/api/audits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
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
