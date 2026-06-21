import { Router } from 'express';
import { QAService } from '../services/QAService.js';
import type { RetrievalParams, ModelConfig, HumanJudgment } from '../../shared/types.js';

const router = Router();

router.post('/ask', (req, res) => {
  const { question, versionId, retrievalParams, modelConfig, standardAnswer } = req.body as {
    question: string;
    versionId: string;
    retrievalParams?: Partial<RetrievalParams>;
    modelConfig?: ModelConfig;
    standardAnswer?: string;
  };
  const { result, error } = QAService.ask(question, versionId, retrievalParams ?? {}, modelConfig, standardAnswer);
  if (error) {
    res.status(400).json(error);
    return;
  }
  res.json(result);
});

router.post('/annotate', (req, res) => {
  const { resultId, judgment, note, standardAnswer } = req.body as {
    resultId: string;
    judgment: HumanJudgment;
    note?: string;
    standardAnswer?: string;
  };
  const updated = QAService.annotate(resultId, judgment, note, standardAnswer);
  if (!updated) {
    res.status(404).json({ code: 'NOT_FOUND', message: '结果不存在' });
    return;
  }
  res.json(updated);
});

router.get('/results', (req, res) => {
  const versionId = req.query.versionId as string | undefined;
  const taskId = req.query.taskId as string | undefined;
  res.json(QAService.listResults(versionId, taskId));
});

router.get('/results/:id', (req, res) => {
  const r = QAService.getResult(req.params.id);
  if (!r) res.status(404).json({ code: 'NOT_FOUND' });
  else res.json(r);
});

export default router;
