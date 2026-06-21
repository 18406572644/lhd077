import { Router } from 'express';
import { CompareService } from '../services/CompareService.js';
import path from 'node:path';

const router = Router();

router.post('/', (req, res) => {
  const { taskIds } = req.body as { taskIds: [string, string] };
  if (!taskIds || taskIds.length !== 2) {
    res.status(400).json({ code: 'INVALID_REQUEST', message: '需要两个任务ID' });
    return;
  }
  const result = CompareService.compare(taskIds[0], taskIds[1]);
  if (!result) {
    res.status(404).json({ code: 'NOT_FOUND', message: '任务不存在' });
    return;
  }
  res.json(result);
});

router.post('/export', (req, res) => {
  const { taskIds } = req.body as { taskIds: [string, string] };
  if (!taskIds || taskIds.length !== 2) {
    res.status(400).json({ code: 'INVALID_REQUEST' });
    return;
  }
  const filePath = CompareService.exportCompare(taskIds[0], taskIds[1]);
  if (!filePath) {
    res.status(404).json({ code: 'NOT_FOUND' });
    return;
  }
  const filename = path.basename(filePath);
  res.download(filePath, filename, (err) => {
    if (err) res.status(500).json({ code: 'EXPORT_FAILED' });
  });
});

export default router;
