import { VersionRepo, DocumentRepo, ChunkRepo, QARepo, LogRepo } from '../data/repositories.js';
import { loadIndex, validateIndex, searchIndex, generateAnswer } from '../utils/indexManager.js';
import {
  validateQuestion,
  validateRetrievalParams,
  sanitizeRetrievalParams,
  MAX_QUESTION_LENGTH,
} from '../utils/validators.js';
import type { RetrievalParams, ModelConfig, HumanJudgment, QAResult } from '../../shared/types.js';

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
};
