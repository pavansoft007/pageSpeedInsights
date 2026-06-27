import { Router } from 'express';
import path from 'node:path';
import { webAuditService } from '../services/webAuditService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json({ audits: webAuditService.listJobs() });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { url, maxUrls, concurrency, auditMode, mode } = req.body ?? {};
    const audit = webAuditService.startAudit(url, {
      maxUrls,
      concurrency,
      auditMode: auditMode ?? mode,
    });

    res.status(202).json({
      message: 'Audit started',
      audit,
    });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const audit = webAuditService.getJobStatus(req.params.id);
    res.json({ audit });
  })
);

router.get(
  '/:id/download/excel',
  asyncHandler(async (req, res) => {
    const filepath = webAuditService.getReportPath(req.params.id, 'excel');
    res.download(filepath, path.basename(filepath));
  })
);

router.get(
  '/:id/download/csv',
  asyncHandler(async (req, res) => {
    const filepath = webAuditService.getReportPath(req.params.id, 'csv');
    res.download(filepath, path.basename(filepath));
  })
);

export default router;
