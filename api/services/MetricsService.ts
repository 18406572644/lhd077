import { MetricRepo, LogRepo } from '../data/repositories.js';
import type {
  Metric,
  QAResult,
  MetricResult,
  EvaluationMetrics,
  BuiltInMetric,
} from '../../shared/types.js';

const ALLOWED_SCRIPT_PATTERNS = /^(?!.*(require|import|process|fs|child_process|eval|Function|__dirname|__filename|global|window|document|fetch|XMLHttpRequest|WebSocket|setTimeout|setInterval|setImmediate)).*$/s;
const MAX_SCRIPT_EXECUTION_TIME = 1000;

function validateScriptSecurity(script: string): void {
  if (!script || typeof script !== 'string') {
    throw new Error('脚本不能为空');
  }
  if (script.length > 10000) {
    throw new Error('脚本长度不能超过 10000 个字符');
  }
  if (!ALLOWED_SCRIPT_PATTERNS.test(script)) {
    throw new Error('脚本包含不安全的关键字，不允许导入模块、访问系统资源或使用异步操作');
  }
  const dangerousPatterns = [
    /\brequire\s*\(/,
    /\bimport\s+[\s\S]*?\bfrom\b/,
    /\bprocess\./,
    /\bfs\./,
    /\bchild_process/,
    /\beval\s*\(/,
    /\bnew\s+Function\s*\(/,
    /\b__dirname\b/,
    /\b__filename\b/,
    /\bglobal\b/,
    /\bwindow\b/,
    /\bdocument\b/,
    /\bfetch\s*\(/,
    /\bXMLHttpRequest\b/,
    /\bWebSocket\b/,
    /\bsetTimeout\s*\(/,
    /\bsetInterval\s*\(/,
    /\bsetImmediate\s*\(/,
    /\bPromise\s*\(/,
    /\basync\s+/,
    /\bawait\s+/,
  ];
  for (const pattern of dangerousPatterns) {
    if (pattern.test(script)) {
      throw new Error(`脚本包含不安全的模式: ${pattern.toString()}`);
    }
  }
}

function runCustomScript(script: string, results: QAResult[]): number {
  validateScriptSecurity(script);

  const startTime = Date.now();

  try {
    const safeResults = Object.freeze(
      results.map((r) =>
        Object.freeze({
          id: r.id,
          question: r.question,
          answer: r.answer,
          standardAnswer: r.standardAnswer,
          confidence: r.confidence,
          humanJudgment: r.humanJudgment,
          createdAt: r.createdAt,
        }),
      ),
    );

    const wrappedScript = `
      "use strict";
      var results = arguments[0];
      ${script}
    `;

    const fn = new Function(wrappedScript);
    const value = fn(safeResults);

    const elapsed = Date.now() - startTime;
    if (elapsed > MAX_SCRIPT_EXECUTION_TIME) {
      throw new Error(`脚本执行时间过长 (${elapsed}ms)，超过 ${MAX_SCRIPT_EXECUTION_TIME}ms 限制`);
    }

    if (typeof value !== 'number') {
      throw new Error('脚本必须返回一个数字');
    }
    if (isNaN(value)) {
      throw new Error('脚本返回值不能是 NaN');
    }
    if (!isFinite(value)) {
      throw new Error('脚本返回值必须是有限数字');
    }
    if (value < 0 || value > 1) {
      throw new Error('脚本返回值必须在 0-1 之间');
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
