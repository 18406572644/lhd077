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

router.post('/ask/ab', (req, res) => {
  const {
    question,
    versionId,
    paramsA,
    paramsB,
    modelConfig,
    standardAnswer,
  } = req.body as {
    question: string;
    versionId: string;
    paramsA?: Partial<RetrievalParams>;
    paramsB?: Partial<RetrievalParams>;
    modelConfig?: ModelConfig;
    standardAnswer?: string;
  };
  if (!question || !versionId) {
    res.status(400).json({ code: 'BAD_REQUEST', message: 'question 和 versionId 必填' });
    return;
  }
  const { result, error } = QAService.askAB(
    question,
    versionId,
    paramsA ?? {},
    paramsB ?? {},
    modelConfig,
    standardAnswer,
  );
  if (error) {
    res.status(400).json(error);
    return;
  }
  res.json(result);
});

router.get('/recommendation/params', (req, res) => {
  const versionId = req.query.versionId as string | undefined;
  if (!versionId) {
    res.status(400).json({ code: 'BAD_REQUEST', message: 'versionId 必填' });
    return;
  }
  const rec = QAService.getParamsRecommendation(versionId);
  if (!rec) {
    res.status(404).json({ code: 'NO_DATA', message: '该版本暂无历史数据' });
    return;
  }
  res.json(rec);
});

export default router;
