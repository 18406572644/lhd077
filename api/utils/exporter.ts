import path from 'node:path';
import { PATHS, ensureDir, writeJsonFile } from '../data/storage.js';
import type { EvaluationTask, QAResult, CompareResult } from '../../shared/types.js';

export function exportEvaluationReport(task: EvaluationTask, results: QAResult[]): string {
  ensureDir(PATHS.exports);
  const filename = `evaluation_${task.id}_${Date.now()}.json`;
  const filePath = path.join(PATHS.exports, filename);
  const report = {
    exportType: 'evaluation',
    exportedAt: Date.now(),
    task: {
      id: task.id,
      name: task.name,
      versionId: task.versionId,
      retrievalParams: task.retrievalParams,
      modelConfig: task.modelConfig,
      metricIds: task.metricIds,
      status: task.status,
      metrics: task.metrics,
      createdAt: task.createdAt,
      startedAt: task.startedAt,
      finishedAt: task.finishedAt,
    },
    testSet: task.testSet,
    results: results.map((r) => ({
      id: r.id,
      question: r.question,
      answer: r.answer,
      standardAnswer: r.standardAnswer,
      confidence: r.confidence,
      humanJudgment: r.humanJudgment,
      humanNote: r.humanNote,
      retrievedChunks: r.retrievedChunks,
      paramsSnapshot: r.paramsSnapshot,
      createdAt: r.createdAt,
    })),
  };
  writeJsonFile(filePath, report);
  return filePath;
}

export function exportCompareReport(compare: CompareResult): string {
  ensureDir(PATHS.exports);
  const filename = `compare_${compare.taskA.id}_vs_${compare.taskB.id}_${Date.now()}.json`;
  const filePath = path.join(PATHS.exports, filename);
  writeJsonFile(filePath, {
    exportType: 'compare',
    exportedAt: Date.now(),
    ...compare,
  });
  return filePath;
}

export function exportLogsCSV(logs: Array<{ timestamp: number; level: string; category: string; message: string }>): string {
  ensureDir(PATHS.exports);
  const filename = `logs_${Date.now()}.csv`;
  const filePath = path.join(PATHS.exports, filename);
  const header = 'timestamp,level,category,message\n';
  const rows = logs.map((l) => {
    const msg = `"${String(l.message).replace(/"/g, '""')}"`;
    return `${l.timestamp},${l.level},${l.category},${msg}`;
  });
  const fs = require('node:fs') as typeof import('node:fs');
  fs.writeFileSync(filePath, header + rows.join('\n'), 'utf-8');
  return filePath;
}
