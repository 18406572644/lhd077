import { Router } from 'express';
import { LogService } from '../services/LogService.js';
import type { LogLevel, LogCategory } from '../../shared/types.js';
import path from 'node:path';

const router = Router();

router.get('/', (req, res) => {
  const level = req.query.level as LogLevel | undefined;
  const category = req.query.category as LogCategory | undefined;
  res.json(LogService.list(level, category));
});

router.get('/consistency', (_req, res) => {
  res.json(LogService.consistencyCheck());
});

router.get('/export', (req, res) => {
  const level = req.query.level as LogLevel | undefined;
  const category = req.query.category as LogCategory | undefined;
  const filePath = LogService.exportLogsCSV(level, category);
  const filename = path.basename(filePath);
  res.download(filePath, filename);
});

export default router;
