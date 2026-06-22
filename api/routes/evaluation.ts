import { Router } from 'express';
import multer from 'multer';
import { EvaluationService } from '../services/EvaluationService.js';
import { parseTestCases } from '../utils/documentParser.js';
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
    const metricIds = req.body.metricIds
      ? JSON.parse(req.body.metricIds as string)
      : undefined;
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
    const task = EvaluationService.createTask(name, testSet, versionId, retrievalParams, modelConfig, metricIds);
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

router.get('/weights', (_req, res) => {
  res.json(EvaluationService.getEvaluationWeights());
});

router.put('/weights', (req, res) => {
  try {
    const weights = EvaluationService.setEvaluationWeights(req.body);
    res.json(weights);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(400).json({ code: 'INVALID_WEIGHTS', message: msg });
  }
});

router.post('/weights/reset', (_req, res) => {
  res.json(EvaluationService.resetEvaluationWeights());
});

router.post('/evaluate', (req, res) => {
  try {
    const { answer, standardAnswer, weights } = req.body;
    if (!answer || !standardAnswer) {
      res.status(400).json({ code: 'MISSING_PARAMS', message: '需要 answer 和 standardAnswer' });
      return;
    }
    const result = EvaluationService.evaluateSingleAnswer(answer, standardAnswer, weights);
    res.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ code: 'EVALUATION_FAILED', message: msg });
  }
});

router.post('/tasks/:id/re-evaluate', async (req, res) => {
  try {
    const task = await EvaluationService.reEvaluateTask(req.params.id, req.body.weights);
    if (!task) {
      res.status(404).json({ code: 'NOT_FOUND' });
      return;
    }
    res.json(task);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ code: 'REEVALUATION_FAILED', message: msg });
  }
});

router.post('/results/:id/apply-judgment', (req, res) => {
  const result = EvaluationService.applyAutoJudgment(req.params.id);
  if (!result) {
    res.status(404).json({ code: 'NOT_FOUND' });
    return;
  }
  res.json(result);
});

router.post('/tasks/:id/apply-judgments', (req, res) => {
  const result = EvaluationService.batchApplyAutoJudgment(req.params.id);
  res.json(result);
});

export default router;
