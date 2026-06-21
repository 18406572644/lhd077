import { DocumentRepo, ChunkRepo, VersionRepo, QARepo, EvaluationRepo, LogRepo } from '../data/repositories.js';
import type { ConsistencyReport, ConsistencyIssue } from '../../shared/types.js';
import { loadIndex, validateIndex } from './indexManager.js';
import { PATHS, fileExists } from '../data/storage.js';
import path from 'node:path';

export function runConsistencyCheck(): ConsistencyReport {
  const issues: ConsistencyIssue[] = [];
  let passed = 0;
  let failed = 0;

  // 1. 版本引用的文档必须存在
  const versions = VersionRepo.list();
  const documents = DocumentRepo.list();
  const docIds = new Set(documents.map((d) => d.id));
  for (const v of versions) {
    const missing = v.documentIds.filter((id) => !docIds.has(id));
    if (missing.length > 0) {
      issues.push({
        type: 'version_missing_documents',
        description: `版本 ${v.name} 引用了 ${missing.length} 个不存在的文档`,
        affectedIds: [v.id, ...missing],
        fix: '删除无效引用或重新导入缺失文档',
      });
      failed++;
    } else {
      passed++;
    }
  }

  // 2. 文档引用的版本必须存在
  const versionIds = new Set(versions.map((v) => v.id));
  const orphanDocs = documents.filter((d) => !versionIds.has(d.versionId));
  if (orphanDocs.length > 0) {
    issues.push({
      type: 'orphan_documents',
      description: `${orphanDocs.length} 个文档不属于任何版本`,
      affectedIds: orphanDocs.map((d) => d.id),
      fix: '将文档分配到有效版本或删除',
    });
    failed++;
  } else {
    passed++;
  }

  // 3. 文档的 chunk 必须存在且 chunkCount 正确
  const chunks = ChunkRepo.list();
  const chunkDocMap = new Map<string, number>();
  for (const c of chunks) {
    chunkDocMap.set(c.documentId, (chunkDocMap.get(c.documentId) ?? 0) + 1);
  }
  for (const doc of documents) {
    const actual = chunkDocMap.get(doc.id) ?? 0;
    if (actual !== doc.chunkCount) {
      issues.push({
        type: 'document_chunk_mismatch',
        description: `文档 ${doc.title} 记录 chunkCount=${doc.chunkCount}，实际=${actual}`,
        affectedIds: [doc.id],
        fix: '重新切分该文档',
      });
      failed++;
    } else {
      passed++;
    }
  }

  // 4. QA 引用的版本必须存在
  const qaResults = QARepo.list();
  const orphanQA = qaResults.filter((r) => !versionIds.has(r.versionId));
  if (orphanQA.length > 0) {
    issues.push({
      type: 'orphan_qa',
      description: `${orphanQA.length} 条问答记录引用了不存在的版本`,
      affectedIds: orphanQA.map((r) => r.id),
    });
    failed++;
  } else {
    passed++;
  }

  // 5. 评测任务引用的版本必须存在，resultIds 必须有效
  const tasks = EvaluationRepo.list();
  const qaIds = new Set(qaResults.map((r) => r.id));
  for (const task of tasks) {
    if (!versionIds.has(task.versionId)) {
      issues.push({
        type: 'evaluation_missing_version',
        description: `评测任务 ${task.name} 引用了不存在的版本`,
        affectedIds: [task.id, task.versionId],
      });
      failed++;
    } else {
      passed++;
    }
    const missingResults = task.resultIds.filter((id) => !qaIds.has(id));
    if (missingResults.length > 0) {
      issues.push({
        type: 'evaluation_missing_results',
        description: `评测任务 ${task.name} 有 ${missingResults.length} 条结果不存在`,
        affectedIds: [task.id, ...missingResults],
      });
      failed++;
    } else {
      passed++;
    }
  }

  // 6. 索引文件存在且校验通过
  for (const v of versions) {
    const idxPath = path.join(PATHS.indexes, `${v.id}.json`);
    if (!fileExists(idxPath)) {
      if (v.indexStatus === 'ready') {
        issues.push({
          type: 'index_missing',
          description: `版本 ${v.name} 标记 ready 但索引文件不存在`,
          affectedIds: [v.id],
          fix: '重建索引',
        });
        failed++;
      } else {
        passed++;
      }
      continue;
    }
    const idx = loadIndex(v.id);
    const valid = validateIndex(v.id, idx);
    if (!valid && v.indexStatus === 'ready') {
      issues.push({
        type: 'index_corrupted',
        description: `版本 ${v.name} 的索引已损坏（校验和不匹配）`,
        affectedIds: [v.id],
        fix: '重建索引',
        recoverable: true,
      } as ConsistencyIssue & { recoverable?: boolean });
      failed++;
    } else {
      passed++;
    }
  }

  return {
    timestamp: Date.now(),
    issues,
    summary: {
      totalChecks: passed + failed,
      passed,
      failed,
    },
  };
}

export function fixCorruptedIndex(versionId: string): boolean {
  const v = VersionRepo.getById(versionId);
  if (!v) return false;
  VersionRepo.update(versionId, { indexStatus: 'corrupted' });
  LogRepo.create({
    level: 'warn',
    category: 'index',
    message: `版本 ${v.name} 的索引被标记为损坏`,
    affectedScope: `版本 ${versionId} 的问答功能将不可用，需重建索引`,
    recoverable: true,
  });
  return true;
}
