import { EvaluationRepo, LogRepo, QARepo } from '../data/repositories.js';
import { QAService } from './QAService.js';
import { computeMetrics } from '../utils/metricsCalculator.js';
import { exportEvaluationReport } from '../utils/exporter.js';
import type {
  EvaluationTask,
  TestCase,
  RetrievalParams,
  ModelConfig,
} from '../../shared/types.js';

export const EvaluationService = {
  createTask(
    name: string,
    testSet: TestCase[],
    versionId: string,
    retrievalParams: Partial<RetrievalParams>,
    modelConfig?: ModelConfig,
  ): EvaluationTask {
    const task = EvaluationRepo.create({
      name,
      testSet,
      versionId,
      retrievalParams: {
        topK: retrievalParams.topK ?? 5,
        minScore: retrievalParams.minScore ?? 0.1,
        chunkSize: retrievalParams.chunkSize ?? 300,
        chunkOverlap: retrievalParams.chunkOverlap ?? 50,
        useBM25: retrievalParams.useBM25 ?? true,
      },
      modelConfig,
    });
    LogRepo.create({
      level: 'info',
      category: 'evaluation',
      message: `创建评测任务：${name}（${testSet.length}条用例）`,
      affectedScope: `评测任务 ${task.id}`,
    });
    return task;
  },

  listTasks(): EvaluationTask[] {
    return EvaluationRepo.list().sort((a, b) => b.createdAt - a.createdAt);
  },

  getTask(id: string) {
    return EvaluationRepo.getById(id);
  },

  async runTask(id: string): Promise<EvaluationTask | undefined> {
    const task = EvaluationRepo.getById(id);
    if (!task) return undefined;
    if (task.status === 'running') return task;
    EvaluationRepo.update(id, { status: 'running', startedAt: Date.now() });
    LogRepo.create({
      level: 'info',
      category: 'evaluation',
      message: `开始执行评测任务：${task.name}`,
      affectedScope: `评测任务 ${id}`,
    });
    const resultIds: string[] = [];
    try {
      for (const tc of task.testSet) {
        const { result, error } = QAService.ask(
          tc.question,
          task.versionId,
          task.retrievalParams,
          task.modelConfig,
          tc.standardAnswer,
          id,
        );
        if (result) {
          resultIds.push(result.id);
        } else if (error) {
          LogRepo.create({
            level: 'error',
            category: 'evaluation',
            message: `评测用例失败：${error.message}`,
            details: { question: tc.question },
            affectedScope: `评测任务 ${id} 单条用例`,
            recoverable: true,
          });
        }
      }
      const results = QARepo.listByTask(id);
      const metrics = computeMetrics(results);
      EvaluationRepo.update(id, {
        status: 'done',
        resultIds,
        metrics,
        finishedAt: Date.now(),
      });
      LogRepo.create({
        level: 'info',
        category: 'evaluation',
        message: `评测任务完成：${task.name}，准确率 ${(metrics.accuracy * 100).toFixed(1)}%`,
        affectedScope: `评测任务 ${id}`,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      EvaluationRepo.update(id, {
        status: 'failed',
        resultIds,
        errorMessage: msg,
        finishedAt: Date.now(),
      });
      LogRepo.create({
        level: 'error',
        category: 'evaluation',
        message: `评测任务失败：${msg}`,
        affectedScope: `评测任务 ${id}`,
        recoverable: true,
      });
    }
    return EvaluationRepo.getById(id);
  },

  getTaskResults(id: string) {
    const task = EvaluationRepo.getById(id);
    if (!task) return null;
    const results = QARepo.listByTask(id);
    return { task, results };
  },

  exportTask(id: string): string | null {
    const data = this.getTaskResults(id);
    if (!data) return null;
    return exportEvaluationReport(data.task, data.results);
  },
};
