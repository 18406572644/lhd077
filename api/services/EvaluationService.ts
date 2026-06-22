import { EvaluationRepo, LogRepo, QARepo, MetricRepo } from '../data/repositories.js';
import { QAService } from './QAService.js';
import { computeMetrics } from '../utils/metricsCalculator.js';
import { exportEvaluationReport } from '../utils/exporter.js';
import { computeMetricResults } from './MetricsService.js';
import {
  evaluateAnswer,
  batchEvaluateResults,
  getWeights,
  setWeights,
  resetWeights,
} from './AutoEvaluationService.js';
import type {
  EvaluationTask,
  TestCase,
  RetrievalParams,
  ModelConfig,
  QAResult,
  EvaluationWeights,
  AutoEvaluation,
} from '../../shared/types.js';

export const EvaluationService = {
  createTask(
    name: string,
    testSet: TestCase[],
    versionId: string,
    retrievalParams: Partial<RetrievalParams>,
    modelConfig?: ModelConfig,
    metricIds?: string[],
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
      metricIds: metricIds ?? [],
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

      const { results: evaluatedResults, stats } = batchEvaluateResults(results);
      for (const r of evaluatedResults) {
        QARepo.update(r.id, { autoEvaluation: r.autoEvaluation });
      }

      const baseMetrics = computeMetrics(evaluatedResults);
      const taskAfter = EvaluationRepo.getById(id);
      let metrics = { ...baseMetrics, autoEvalStats: stats };
      if (taskAfter && taskAfter.metricIds.length > 0) {
        const metricConfigs = MetricRepo.getByIds(taskAfter.metricIds);
        const { metricResults, weightedTotalScore } = computeMetricResults(
          metricConfigs,
          baseMetrics,
          evaluatedResults,
        );
        metrics = {
          ...metrics,
          weightedTotalScore,
          metricResults,
          metricConfigs,
        };
      }
      EvaluationRepo.update(id, {
        status: 'done',
        resultIds,
        metrics,
        finishedAt: Date.now(),
      });
      LogRepo.create({
        level: 'info',
        category: 'evaluation',
        message: `评测任务完成：${task.name}，准确率 ${(metrics.accuracy * 100).toFixed(1)}%，自动评估完成 ${stats.autoJudgmentCount} 条`,
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

  getEvaluationWeights(): EvaluationWeights {
    return getWeights();
  },

  setEvaluationWeights(weights: Partial<EvaluationWeights>): EvaluationWeights {
    return setWeights(weights);
  },

  resetEvaluationWeights(): EvaluationWeights {
    return resetWeights();
  },

  evaluateSingleAnswer(
    answer: string,
    standardAnswer: string,
    customWeights?: Partial<EvaluationWeights>,
  ): AutoEvaluation {
    return evaluateAnswer(answer, standardAnswer, customWeights);
  },

  async reEvaluateTask(id: string, customWeights?: Partial<EvaluationWeights>): Promise<EvaluationTask | undefined> {
    const task = EvaluationRepo.getById(id);
    if (!task) return undefined;

    const results = QARepo.listByTask(id);
    const { results: evaluatedResults, stats } = batchEvaluateResults(results, customWeights);

    for (const r of evaluatedResults) {
      QARepo.update(r.id, { autoEvaluation: r.autoEvaluation });
    }

    const baseMetrics = computeMetrics(evaluatedResults);
    let metrics = { ...baseMetrics, autoEvalStats: stats };

    if (task.metricIds.length > 0) {
      const metricConfigs = MetricRepo.getByIds(task.metricIds);
      const { metricResults, weightedTotalScore } = computeMetricResults(
        metricConfigs,
        baseMetrics,
        evaluatedResults,
      );
      metrics = {
        ...metrics,
        weightedTotalScore,
        metricResults,
        metricConfigs,
      };
    }

    EvaluationRepo.update(id, { metrics });

    LogRepo.create({
      level: 'info',
      category: 'evaluation',
      message: `重新评估任务：${task.name}，自动评估完成 ${stats.autoJudgmentCount} 条`,
      affectedScope: `评测任务 ${id}`,
    });

    return EvaluationRepo.getById(id);
  },

  applyAutoJudgment(resultId: string): QAResult | undefined {
    const result = QARepo.getById(resultId);
    if (!result || !result.autoEvaluation) return undefined;

    const updated = QARepo.update(resultId, {
      humanJudgment: result.autoEvaluation.suggestedJudgment,
    });

    LogRepo.create({
      level: 'info',
      category: 'evaluation',
      message: `应用自动判定结果：${result.autoEvaluation.suggestedJudgment}`,
      affectedScope: `评测结果 ${resultId}`,
    });

    return updated;
  },

  batchApplyAutoJudgment(taskId: string): { updated: number; total: number } {
    const results = QARepo.listByTask(taskId);
    let updated = 0;

    for (const r of results) {
      if (r.autoEvaluation && !r.humanJudgment) {
        QARepo.update(r.id, {
          humanJudgment: r.autoEvaluation.suggestedJudgment,
        });
        updated++;
      }
    }

    LogRepo.create({
      level: 'info',
      category: 'evaluation',
      message: `批量应用自动判定：任务 ${taskId}，更新 ${updated}/${results.length} 条`,
      affectedScope: `评测任务 ${taskId}`,
    });

    return { updated, total: results.length };
  },
};
