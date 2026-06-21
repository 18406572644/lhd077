import { Router } from 'express';
import multer from 'multer';
import { EvaluationService } from '../services/EvaluationService.js';
import { parseTestCases } from '../utils/documentParser.js';
import fs from 'node:fs';
import path from 'node:path';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/tasks', (_req, res) => {
  res.json(EvaluationService.listTasks());
});

router.post('/tasks', upload.single('testSet'), async (req, res) => {
  try {
    const name = (req.body.name as string) || '未命名评测';
    const versionId = req.body.versionId as string;
    const retrievalParams = req.body.retrievalParams
      ? JSON.parse(req.body.retrievalParams as string)
      : undefined;
    const modelConfig = req.body.modelConfig ? JSON.parse(req.body.modelConfig as string) : undefined;
    let testSet;
    if (req.file) {
      const content = req.file.buffer.toString('utf-8');
      testSet = parseTestCases(content);
    } else if (req.body.testSet) {
      testSet = JSON.parse(req.body.testSet as string);
    }
    if (!testSet || !Array.isArray(testSet)) {
      res.status(400).json({ code: 'INVALID_TESTSET', message: '测试集格式错误' });
      return;
    }
    if (!versionId) {
      res.status(400).json({ code: 'MISSING_VERSION', message: '需要 versionId' });
      return;
    }
    const task = EvaluationService.createTask(name, testSet, versionId, retrievalParams, modelConfig);
    res.json(task);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ code: 'CREATE_FAILED', message: msg });
  }
});

router.get('/tasks/:id', (req, res) => {
  const t = EvaluationService.getTask(req.params.id);
  if (!t) res.status(404).json({ code: 'NOT_FOUND' });
  else res.json(t);
});

router.post('/tasks/:id/run', async (req, res) => {
  const task = await EvaluationService.runTask(req.params.id);
  if (!task) {
    res.status(404).json({ code: 'NOT_FOUND' });
    return;
  }
  res.json(task);
});

router.get('/tasks/:id/results', (req, res) => {
  const data = EvaluationService.getTaskResults(req.params.id);
  if (!data) res.status(404).json({ code: 'NOT_FOUND' });
  else res.json(data);
});

router.get('/tasks/:id/export', (req, res) => {
  const filePath = EvaluationService.exportTask(req.params.id);
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
