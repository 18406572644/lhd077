import { VersionRepo, DocumentRepo, ChunkRepo, QARepo, LogRepo } from '../data/repositories.js';
import { loadIndex, validateIndex, searchIndex, generateAnswer } from '../utils/indexManager.js';
import {
  validateQuestion,
  validateRetrievalParams,
  sanitizeRetrievalParams,
  MAX_QUESTION_LENGTH,
} from '../utils/validators.js';
import type {
  RetrievalParams,
  ModelConfig,
  HumanJudgment,
  QAResult,
  ABCompareResult,
  ParamsStats,
  ParamsRecommendation,
} from '../../shared/types.js';

export const QAService = {
  ask(
    question: string,
    versionId: string,
    retrievalParams: Partial<RetrievalParams>,
    modelConfig?: ModelConfig,
    standardAnswer?: string,
    taskId?: string,
  ): { result?: QAResult; error?: { code: string; message: string; affectedScope: string; recoverable: boolean } } {
    const qErr = validateQuestion(question);
    let processedQuestion = question;
    if (qErr?.code === 'QUESTION_TOO_LONG') {
      processedQuestion = question.slice(0, MAX_QUESTION_LENGTH);
    } else if (qErr) {
      return { error: qErr };
    }
    const pErr = validateRetrievalParams(retrievalParams);
    const params = sanitizeRetrievalParams(retrievalParams);
    const v = VersionRepo.getById(versionId);
    if (!v) {
      return {
        error: {
          code: 'VERSION_NOT_FOUND',
          message: '知识库版本不存在',
          affectedScope: '当前请求',
          recoverable: true,
        },
      };
    }
    if (v.indexStatus === 'corrupted' || v.indexStatus === 'building') {
      return {
        error: {
          code: 'INDEX_NOT_READY',
          message: `索引状态：${v.indexStatus}，请等待或重建`,
          affectedScope: `版本 ${versionId}`,
          recoverable: true,
        },
      };
    }
    const idx = loadIndex(versionId);
    if (!validateIndex(versionId, idx)) {
      VersionRepo.update(versionId, { indexStatus: 'corrupted' });
      LogRepo.create({
        level: 'error',
        category: 'index',
        message: `索引校验失败，已标记为 corrupted`,
        affectedScope: `版本 ${versionId}`,
        recoverable: true,
      });
      return {
        error: {
          code: 'INDEX_CORRUPTED',
          message: '索引已损坏，已自动标记，请重建后重试',
          affectedScope: `版本 ${versionId}`,
          recoverable: true,
        },
      };
    }
    const docs = DocumentRepo.listByVersion(versionId).filter((d) => !d.isDuplicate);
    const chunks = ChunkRepo.listByDocuments(docs.map((d) => d.id));
    const chunkWithTitle = chunks.map((c) => {
      const doc = docs.find((d) => d.id === c.documentId);
      return { ...c, documentTitle: doc?.title ?? '未知文档' };
    });
    const retrieved = searchIndex(idx!, processedQuestion, chunkWithTitle, params);
    const { answer, confidence } = generateAnswer(processedQuestion, retrieved, standardAnswer);
    const result = QARepo.create({
      versionId,
      taskId,
      question: processedQuestion,
      retrievedChunks: retrieved,
      answer,
      standardAnswer,
      confidence,
      paramsSnapshot: { ...params, modelConfig },
    });
    if (pErr) {
      LogRepo.create({
        level: 'warn',
        category: 'qa',
        message: `参数非法已修正：${pErr.message}`,
        affectedScope: pErr.affectedScope,
        recoverable: true,
      });
    }
    return { result };
  },

  annotate(
    resultId: string,
    judgment: HumanJudgment,
    note?: string,
    standardAnswer?: string,
  ): QAResult | undefined {
    const existing = QARepo.getById(resultId);
    if (!existing) return undefined;
    const updated = QARepo.update(resultId, {
      humanJudgment: judgment,
      humanNote: note,
      standardAnswer: standardAnswer ?? existing.standardAnswer,
    });
    LogRepo.create({
      level: 'info',
      category: 'qa',
      message: `人工标注结果：${judgment}`,
      details: { resultId, judgment, note },
      affectedScope: `问答结果 ${resultId}`,
    });
    return updated;
  },

  listResults(versionId?: string, taskId?: string) {
    if (taskId) return QARepo.listByTask(taskId);
    if (versionId) return QARepo.listByVersion(versionId);
    return QARepo.list().sort((a, b) => b.createdAt - a.createdAt);
  },

  getResult(id: string) {
    return QARepo.getById(id);
  },

  askAB(
    question: string,
    versionId: string,
    paramsA: Partial<RetrievalParams>,
    paramsB: Partial<RetrievalParams>,
    modelConfig?: ModelConfig,
    standardAnswer?: string,
  ): { result?: ABCompareResult; error?: { code: string; message: string; affectedScope: string; recoverable: boolean } } {
    const resA = this.ask(question, versionId, paramsA, modelConfig, standardAnswer);
    if (resA.error || !resA.result) {
      return { error: resA.error };
    }
    const resB = this.ask(question, versionId, paramsB, modelConfig, standardAnswer);
    if (resB.error || !resB.result) {
      return { error: resB.error };
    }
    const chunksA = new Set(resA.result.retrievedChunks.map((c) => c.chunkId));
    const chunksB = new Set(resB.result.retrievedChunks.map((c) => c.chunkId));
    let overlap = 0;
    chunksA.forEach((id) => {
      if (chunksB.has(id)) overlap++;
    });
    const chunksOnlyA = resA.result.retrievedChunks.filter((c) => !chunksB.has(c.chunkId)).map((c) => c.chunkId);
    const chunksOnlyB = resB.result.retrievedChunks.filter((c) => !chunksA.has(c.chunkId)).map((c) => c.chunkId);
    LogRepo.create({
      level: 'info',
      category: 'qa',
      message: `A/B 参数对比检索：${question.slice(0, 30)}...`,
      affectedScope: `版本 ${versionId}`,
    });
    return {
      result: {
        question,
        versionId,
        resultA: resA.result,
        resultB: resB.result,
        diff: {
          confidenceDiff: resB.result.confidence - resA.result.confidence,
          chunksOverlap: overlap,
          chunksOnlyA,
          chunksOnlyB,
          answerDiff: resA.result.answer !== resB.result.answer,
        },
      },
    };
  },

  getParamsRecommendation(versionId: string): ParamsRecommendation | null {
    const results = QARepo.listByVersion(versionId);
    if (results.length === 0) return null;
    const grouped = new Map<string, QAResult[]>();
    for (const r of results) {
      const key = JSON.stringify({
        topK: r.paramsSnapshot.topK,
        minScore: r.paramsSnapshot.minScore,
        chunkSize: r.paramsSnapshot.chunkSize,
        chunkOverlap: r.paramsSnapshot.chunkOverlap,
        useBM25: r.paramsSnapshot.useBM25,
      });
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(r);
    }
    const statsList: ParamsStats[] = [];
    for (const [key, list] of grouped.entries()) {
      const params = JSON.parse(key) as RetrievalParams;
      let correct = 0, partial = 0, wrong = 0, unlabeled = 0;
      let confSum = 0;
      for (const r of list) {
        confSum += r.confidence;
        if (r.humanJudgment === 'correct') correct++;
        else if (r.humanJudgment === 'partial') partial++;
        else if (r.humanJudgment === 'wrong') wrong++;
        else unlabeled++;
      }
      const labeled = correct + partial + wrong;
      const accuracy = labeled > 0 ? (correct + partial * 0.5) / labeled : 0;
      const weightedScore = accuracy * 0.6 + (confSum / Math.max(list.length, 1)) * 0.4;
      statsList.push({
        params,
        totalCount: list.length,
        correctCount: correct,
        partialCount: partial,
        wrongCount: wrong,
        unlabeledCount: unlabeled,
        accuracy,
        avgConfidence: confSum / Math.max(list.length, 1),
        weightedScore,
      });
    }
    const minSamples = 3;
    const qualified = statsList.filter((s) => s.totalCount >= minSamples);
    const pool = qualified.length > 0 ? qualified : statsList;
    pool.sort((a, b) => b.weightedScore - a.weightedScore);
    const best = pool[0];
    if (!best) return null;
    LogRepo.create({
      level: 'info',
      category: 'qa',
      message: `生成参数推荐：基于 ${results.length} 条历史数据`,
      affectedScope: `版本 ${versionId}`,
    });
    return {
      versionId,
      recommendations: statsList.sort((a, b) => b.weightedScore - a.weightedScore),
      bestParams: best.params,
      bestStats: best,
      sampleSize: results.length,
      generatedAt: Date.now(),
    };
  },
};
