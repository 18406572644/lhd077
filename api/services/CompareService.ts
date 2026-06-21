import { EvaluationRepo, QARepo, LogRepo } from '../data/repositories.js';
import { exportCompareReport } from '../utils/exporter.js';
import type { CompareResult, HumanJudgment } from '../../shared/types.js';

export const CompareService = {
  compare(taskIdA: string, taskIdB: string): CompareResult | null {
    const taskA = EvaluationRepo.getById(taskIdA);
    const taskB = EvaluationRepo.getById(taskIdB);
    if (!taskA || !taskB) return null;
    const resultsA = QARepo.listByTask(taskIdA);
    const resultsB = QARepo.listByTask(taskIdB);
    const metricDiffs: Record<string, number> = {};
    const metricKeys = ['accuracy', 'partialRate', 'wrongRate', 'avgConfidence', 'total'] as const;
    for (const k of metricKeys) {
      const a = taskA.metrics?.[k] ?? 0;
      const b = taskB.metrics?.[k] ?? 0;
      metricDiffs[k] = b - a;
    }
    const qToA = new Map(resultsA.map((r) => [r.question, r]));
    const perQuestionDiff: CompareResult['perQuestionDiff'] = [];
    for (const rb of resultsB) {
      const ra = qToA.get(rb.question);
      perQuestionDiff.push({
        question: rb.question,
        judgmentA: ra?.humanJudgment as HumanJudgment | undefined,
        judgmentB: rb.humanJudgment,
        confidenceA: ra?.confidence ?? 0,
        confidenceB: rb.confidence,
      });
    }
    for (const ra of resultsA) {
      if (!perQuestionDiff.some((d) => d.question === ra.question)) {
        perQuestionDiff.push({
          question: ra.question,
          judgmentA: ra.humanJudgment,
          confidenceA: ra.confidence,
          confidenceB: 0,
        });
      }
    }
    LogRepo.create({
      level: 'info',
      category: 'evaluation',
      message: `版本对比：${taskA.name} vs ${taskB.name}`,
      affectedScope: `评测任务 ${taskIdA}, ${taskIdB}`,
    });
    return {
      taskA,
      taskB,
      metricDiffs,
      perQuestionDiff,
    };
  },

  exportCompare(taskIdA: string, taskIdB: string): string | null {
    const r = this.compare(taskIdA, taskIdB);
    if (!r) return null;
    return exportCompareReport(r);
  },
};
