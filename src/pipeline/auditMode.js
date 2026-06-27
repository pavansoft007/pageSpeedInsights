export const AuditMode = {
  INTERNAL: 'internal',
  SINGLE: 'single',
};

export function normalizeAuditMode(value) {
  if (!value || typeof value !== 'string') {
    return AuditMode.INTERNAL;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === AuditMode.SINGLE || normalized === 'single-url' || normalized === 'one') {
    return AuditMode.SINGLE;
  }

  if (
    normalized === AuditMode.INTERNAL ||
    normalized === 'internal-links' ||
    normalized === 'crawl' ||
    normalized === 'full'
  ) {
    return AuditMode.INTERNAL;
  }

  return AuditMode.INTERNAL;
}

export function auditModeLabel(mode) {
  return mode === AuditMode.SINGLE ? 'Single URL' : 'Internal links';
}

export default AuditMode;
