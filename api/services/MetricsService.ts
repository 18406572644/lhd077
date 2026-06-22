import { MetricRepo, LogRepo } from '../data/repositories.js';
import type {
  Metric,
  QAResult,
  MetricResult,
  EvaluationMetrics,
  BuiltInMetric,
} from '../../shared/types.js';

function runCustomScript(script: string, results: QAResult[]): number {
  try {
    const fn = new Function('results', `
      "use strict";
      ${script}
    `);
    const value = fn(results);
    if (typeof value !== 'number' || isNaN(value)) {
      throw new Error('脚本必须返回一个数字');
    }
    return value;
  } catch (e) {
    throw new Error(`自定义脚本执行失败: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function computeBuiltInMetric(
  type: BuiltInMetric,
  baseMetrics: EvaluationMetrics,
): number {
  switch (type) {
    case 'accuracy':
      return baseMetrics.accuracy;
    case 'partialRate':
      return baseMetrics.partialRate;
    case 'wrongRate':
      return baseMetrics.wrongRate;
    case 'avgConfidence':
      return baseMetrics.avgConfidence;
    default:
      return 0;
  }
}

export function computeMetricResults(
  metrics: Metric[],
  baseMetrics: EvaluationMetrics,
  results: QAResult[],
): { metricResults: MetricResult[]; weightedTotalScore: number } {
  const metricResults: MetricResult[] = [];
  let weightedSum = 0;
  let totalWeight = 0;

  for (const metric of metrics) {
    let value: number;
    if (metric.computeType === 'built-in' && metric.builtInType) {
      value = computeBuiltInMetric(metric.builtInType, baseMetrics);
    } else if (metric.computeType === 'custom' && metric.customScript) {
      value = runCustomScript(metric.customScript, results);
    } else {
      value = 0;
    }

    const weightedScore = value * metric.weight;
    metricResults.push({
      metricId: metric.id,
      metricName: metric.name,
      value,
      weight: metric.weight,
      higherIsBetter: metric.higherIsBetter,
      weightedScore,
    });

    weightedSum += weightedScore;
    totalWeight += metric.weight;
  }

  const weightedTotalScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
  return { metricResults, weightedTotalScore };
}

export const MetricsService = {
  listMetrics(): Metric[] {
    return MetricRepo.list().sort((a, b) => b.createdAt - a.createdAt);
  },

  getMetric(id: string): Metric | undefined {
    return MetricRepo.getById(id);
  },

  createMetric(data: {
    name: string;
    description: string;
    computeType: Metric['computeType'];
    builtInType?: BuiltInMetric;
    customScript?: string;
    weight: number;
    higherIsBetter: boolean;
  }): Metric {
    if (!data.name.trim()) {
      throw new Error('指标名称不能为空');
    }
    if (data.computeType === 'built-in' && !data.builtInType) {
      throw new Error('内置指标需要指定类型');
    }
    if (data.computeType === 'custom' && !data.customScript?.trim()) {
      throw new Error('自定义指标需要提供脚本');
    }
    if (data.weight < 0) {
      throw new Error('权重不能为负数');
    }

    const metric = MetricRepo.create({
      name: data.name.trim(),
      description: data.description.trim(),
      computeType: data.computeType,
      builtInType: data.builtInType,
      customScript: data.customScript,
      weight: data.weight,
      higherIsBetter: data.higherIsBetter,
    });

    LogRepo.create({
      level: 'info',
      category: 'evaluation',
      message: `创建评测指标：${metric.name}`,
      affectedScope: `指标 ${metric.id}`,
    });

    return metric;
  },

  updateMetric(
    id: string,
    data: Partial<{
      name: string;
      description: string;
      computeType: Metric['computeType'];
      builtInType?: BuiltInMetric;
      customScript?: string;
      weight: number;
      higherIsBetter: boolean;
    }>,
  ): Metric | undefined {
    const existing = MetricRepo.getById(id);
    if (!existing) return undefined;

    const updateData: Partial<Metric> = {};
    if (data.name !== undefined) {
      if (!data.name.trim()) throw new Error('指标名称不能为空');
      updateData.name = data.name.trim();
    }
    if (data.description !== undefined) {
      updateData.description = data.description.trim();
    }
    if (data.computeType !== undefined) {
      updateData.computeType = data.computeType;
    }
    if (data.builtInType !== undefined) {
      updateData.builtInType = data.builtInType;
    }
    if (data.customScript !== undefined) {
      updateData.customScript = data.customScript;
    }
    if (data.weight !== undefined) {
      if (data.weight < 0) throw new Error('权重不能为负数');
      updateData.weight = data.weight;
    }
    if (data.higherIsBetter !== undefined) {
      updateData.higherIsBetter = data.higherIsBetter;
    }

    const updated = MetricRepo.update(id, updateData);
    if (updated) {
      LogRepo.create({
        level: 'info',
        category: 'evaluation',
        message: `更新评测指标：${updated.name}`,
        affectedScope: `指标 ${id}`,
      });
    }
    return updated;
  },

  deleteMetric(id: string): boolean {
    const metric = MetricRepo.getById(id);
    if (!metric) return false;
    const success = MetricRepo.delete(id);
    if (success) {
      LogRepo.create({
        level: 'info',
        category: 'evaluation',
        message: `删除评测指标：${metric.name}`,
        affectedScope: `指标 ${id}`,
      });
    }
    return success;
  },

  testCustomScript(script: string, sampleResults?: QAResult[]): { success: boolean; value?: number; error?: string } {
    try {
      const testResults = sampleResults || [
        {
          id: 'test_1',
          versionId: 'test',
          question: '测试问题',
          answer: '测试回答',
          standardAnswer: '标准答案',
          confidence: 0.85,
          retrievedChunks: [],
          createdAt: Date.now(),
          paramsSnapshot: {
            topK: 5,
            minScore: 0.1,
            chunkSize: 300,
            chunkOverlap: 50,
            useBM25: true,
          },
          humanJudgment: 'correct',
        } as QAResult,
      ];
      const value = runCustomScript(script, testResults);
      return { success: true, value };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
};
