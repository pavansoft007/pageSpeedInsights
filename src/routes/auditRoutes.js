import { Router } from 'express';
import { auditService } from '../services/auditService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json({ audits: auditService.listAudits() });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { url, maxPages, maxDepth, strategy, generateReports } = req.body ?? {};
    const audit = auditService.startAudit(url, {
      maxPages,
      maxDepth,
      strategy,
      generateReports,
    });

    res.status(202).json({
      message: 'Audit started',
      audit: {
        id: audit.id,
        startUrl: audit.startUrl,
        status: audit.status,
        startedAt: audit.startedAt,
      },
    });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const audit = auditService.getAudit(req.params.id);
    res.json({ audit });
  })
);

export default router;
