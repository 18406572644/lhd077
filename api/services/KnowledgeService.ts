import { computeChecksum } from '../data/storage.js';
import { DocumentRepo, ChunkRepo, VersionRepo, LogRepo } from '../data/repositories.js';
import { parseMarkdown, parseFAQ, parseHistory, ParsedDocument } from '../utils/documentParser.js';
import { splitDocument } from '../utils/chunkSplitter.js';
import { buildIndex, saveIndex, loadIndex, validateIndex } from '../utils/indexManager.js';
import { validateDocumentContent, sanitizeRetrievalParams } from '../utils/validators.js';
import {
  createImportTask,
  updateProgress,
  setPhase,
  isCancelled,
  setTaskResult,
  setTaskError,
  setTaskCancelled,
  setVersionId,
  addCreatedDocId,
  addCreatedChunkIds,
  getImportTask,
  requestCancel,
} from '../utils/importTaskManager.js';
import type { KnowledgeSource, RetrievalParams, ImportResult, ImportProgress } from '../../shared/types.js';

export const KnowledgeService = {
  importFiles(
    files: Array<{ filename: string; content: string }>,
    options?: { versionName?: string; retrievalParams?: Partial<RetrievalParams> },
  ): ImportResult {
    const params = sanitizeRetrievalParams(options?.retrievalParams ?? {});
    const versionName = options?.versionName ?? `导入版本 ${new Date().toLocaleString('zh-CN')}`;
    let success = 0;
    let skipped = 0;
    let duplicates = 0;
    const errors: Array<{ filename: string; message: string }> = [];
    const docInputs: Array<{
      title: string;
      content: string;
      source: KnowledgeSource;
    }> = [];
    for (const file of files) {
      const lower = file.filename.toLowerCase();
      let parsed: ParsedDocument[] = [];
      if (lower.endsWith('.md') || lower.endsWith('.markdown')) {
        const valErr = validateDocumentContent(file.filename, file.content);
        if (valErr) {
          errors.push({ filename: file.filename, message: valErr.message });
          skipped++;
          continue;
        }
        parsed = [parseMarkdown(file.filename, file.content)];
      } else if (lower.endsWith('.csv') || lower.endsWith('.tsv') || lower.endsWith('.txt')) {
        const valErr = validateDocumentContent(file.filename, file.content);
        if (valErr) {
          errors.push({ filename: file.filename, message: valErr.message });
          skipped++;
          continue;
        }
        parsed = parseFAQ(file.filename, file.content);
      } else if (lower.endsWith('.json')) {
        const valErr = validateDocumentContent(file.filename, file.content);
        if (valErr) {
          errors.push({ filename: file.filename, message: valErr.message });
          skipped++;
          continue;
        }
        parsed = parseHistory(file.filename, file.content);
      } else {
        errors.push({ filename: file.filename, message: '不支持的文件格式' });
        LogRepo.create({
          level: 'warn',
          category: 'import',
          message: `不支持的文件格式：${file.filename}`,
          affectedScope: `文件 ${file.filename}`,
          recoverable: true,
        });
        skipped++;
        continue;
      }
      for (const p of parsed) {
        if (!p.content.trim()) {
          skipped++;
          continue;
        }
        docInputs.push(p);
      }
    }
    const version = VersionRepo.create({
      name: versionName,
      description: `导入 ${docInputs.length} 条文档`,
      documentIds: [],
    });
    const existingDocs = DocumentRepo.list();
    const existingHashes = new Map(existingDocs.map((d) => [d.hash, d.id]));
    const newDocs: Array<Omit<(typeof existingDocs)[number], 'id' | 'createdAt'>> = [];
    const allChunkInputs: Array<Omit<import('../../shared/types.js').Chunk, 'id'>> = [];
    for (const input of docInputs) {
      const hash = computeChecksum({ t: input.title, c: input.content, s: input.source });
      if (existingHashes.has(hash)) {
        duplicates++;
        newDocs.push({
          versionId: version.id,
          title: input.title,
          source: input.source,
          content: input.content,
          hash,
          isDuplicate: true,
          duplicateOf: existingHashes.get(hash),
          chunkCount: 0,
        });
        continue;
      }
      const chunks = splitDocument('__temp__', input.content, {
        chunkSize: params.chunkSize,
        chunkOverlap: params.chunkOverlap,
      });
      existingHashes.set(hash, '__pending__');
      newDocs.push({
        versionId: version.id,
        title: input.title,
        source: input.source,
        content: input.content,
        hash,
        isDuplicate: false,
        chunkCount: chunks.length,
      });
      for (const c of chunks) {
        allChunkInputs.push({ ...c, documentId: '__temp__' });
      }
      success++;
    }
    const createdDocs = DocumentRepo.bulkCreate(newDocs);
    const docIdMap = new Map<string, string>();
    createdDocs.forEach((d, i) => docIdMap.set(String(i), d.id));
    let chunkCursor = 0;
    const finalChunks: Array<Omit<import('../../shared/types.js').Chunk, 'id'>> = [];
    for (let i = 0; i < newDocs.length; i++) {
      const doc = newDocs[i];
      const docId = createdDocs[i].id;
      if (doc.isDuplicate) continue;
      for (let j = 0; j < doc.chunkCount; j++) {
        const chunk = allChunkInputs[chunkCursor + j];
        finalChunks.push({ ...chunk, documentId: docId });
      }
      chunkCursor += doc.chunkCount;
    }
    ChunkRepo.bulkCreate(finalChunks);
    VersionRepo.update(version.id, { documentIds: createdDocs.map((d) => d.id) });
    const versionChunks = ChunkRepo.listByDocuments(createdDocs.filter((d) => !d.isDuplicate).map((d) => d.id));
    const index = buildIndex(version.id, versionChunks);
    saveIndex(version.id, index);
    VersionRepo.update(version.id, {
      indexStatus: 'ready',
      indexChecksum: index.checksum,
    });
    LogRepo.create({
      level: 'info',
      category: 'import',
      message: `导入完成：成功${success}条，重复${duplicates}条，跳过${skipped}条，错误${errors.length}条`,
      affectedScope: `版本 ${version.id}`,
    });
    return {
      success,
      skipped,
      duplicates,
      errors,
      versionId: version.id,
    };
  },

  listVersions() {
    return VersionRepo.list().sort((a, b) => b.createdAt - a.createdAt);
  },

  getVersion(id: string) {
    return VersionRepo.getById(id);
  },

  listDocuments(versionId?: string) {
    const docs = versionId ? DocumentRepo.listByVersion(versionId) : DocumentRepo.list();
    return docs.sort((a, b) => b.createdAt - a.createdAt);
  },

  getDocument(id: string) {
    return DocumentRepo.getById(id);
  },

  deleteDocument(id: string) {
    const doc = DocumentRepo.getById(id);
    if (!doc) return false;
    ChunkRepo.deleteByDocument(id);
    const deleted = DocumentRepo.delete(id);
    if (deleted) {
      const v = VersionRepo.getById(doc.versionId);
      if (v) {
        VersionRepo.update(v.id, {
          documentIds: v.documentIds.filter((d) => d !== id),
        });
      }
      LogRepo.create({
        level: 'info',
        category: 'import',
        message: `删除文档：${doc.title}`,
        affectedScope: `文档 ${id}，所属版本 ${doc.versionId}`,
      });
    }
    return deleted;
  },

  rebuildIndex(versionId: string): { ok: boolean; message?: string } {
    const v = VersionRepo.getById(versionId);
    if (!v) return { ok: false, message: '版本不存在' };
    VersionRepo.update(versionId, { indexStatus: 'building' });
    try {
      const docs = DocumentRepo.listByVersion(versionId).filter((d) => !d.isDuplicate);
      const chunks = ChunkRepo.listByDocuments(docs.map((d) => d.id));
      const index = buildIndex(versionId, chunks);
      saveIndex(versionId, index);
      VersionRepo.update(versionId, {
        indexStatus: 'ready',
        indexChecksum: index.checksum,
      });
      LogRepo.create({
        level: 'info',
        category: 'index',
        message: `版本 ${v.name} 索引重建成功`,
        affectedScope: `版本 ${versionId}`,
      });
      return { ok: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      VersionRepo.update(versionId, { indexStatus: 'corrupted' });
      LogRepo.create({
        level: 'error',
        category: 'index',
        message: `索引重建失败：${msg}`,
        details: { error: msg },
        affectedScope: `版本 ${versionId}，问答功能暂不可用`,
        recoverable: true,
      });
      return { ok: false, message: msg };
    }
  },

  getIndexStatus(versionId: string) {
    const v = VersionRepo.getById(versionId);
    if (!v) return null;
    const idx = loadIndex(versionId);
    const valid = validateIndex(versionId, idx);
    return {
      versionId,
      status: v.indexStatus,
      checksumValid: valid,
      totalChunks: idx?.totalChunks ?? 0,
      builtAt: idx?.builtAt,
      checksum: idx?.checksum,
    };
  },

  getDocumentChunks(documentId: string) {
    return ChunkRepo.listByDocument(documentId);
  },

  startImportAsync(
    files: Array<{ filename: string; content: string }>,
    options?: { versionName?: string; retrievalParams?: Partial<RetrievalParams> },
  ): { taskId: string } {
    const task = createImportTask(files.length);
    setImmediate(() => {
      this._runImportAsync(task.id, files, options).catch((e) => {
        const msg = e instanceof Error ? e.message : String(e);
        setTaskError(task.id, msg);
        LogRepo.create({
          level: 'error',
          category: 'import',
          message: `异步导入失败：${msg}`,
          details: { error: msg, taskId: task.id },
        });
      });
    });
    return { taskId: task.id };
  },

  getImportProgress(taskId: string): ImportProgress | null {
    const task = getImportTask(taskId);
    return task ? task.progress : null;
  },

  cancelImport(taskId: string, rollback: boolean): { success: boolean; message?: string } {
    const task = getImportTask(taskId);
    if (!task) return { success: false, message: '任务不存在' };
    const ok = requestCancel(taskId, rollback);
    if (!ok) return { success: false, message: '任务已结束，无法取消' };
    return { success: true };
  },

  async _runImportAsync(
    taskId: string,
    files: Array<{ filename: string; content: string }>,
    options?: { versionName?: string; retrievalParams?: Partial<RetrievalParams> },
  ): Promise<void> {
    const params = sanitizeRetrievalParams(options?.retrievalParams ?? {});
    const versionName = options?.versionName ?? `导入版本 ${new Date().toLocaleString('zh-CN')}`;
    let success = 0;
    let skipped = 0;
    let duplicates = 0;
    const errors: Array<{ filename: string; message: string }> = [];
    const docInputs: Array<{
      title: string;
      content: string;
      source: KnowledgeSource;
    }> = [];

    setPhase(taskId, 'parsing', '正在解析文件...');
    for (let i = 0; i < files.length; i++) {
      if (isCancelled(taskId)) {
        await this._handleCancellation(taskId);
        return;
      }
      const file = files[i];
      updateProgress(taskId, {
        currentFile: file.filename,
        processedFiles: i,
        message: `正在解析：${file.filename}`,
      });
      await new Promise((r) => setImmediate(r));

      const lower = file.filename.toLowerCase();
      let parsed: ParsedDocument[] = [];
      if (lower.endsWith('.md') || lower.endsWith('.markdown')) {
        const valErr = validateDocumentContent(file.filename, file.content);
        if (valErr) {
          errors.push({ filename: file.filename, message: valErr.message });
          skipped++;
          continue;
        }
        parsed = [parseMarkdown(file.filename, file.content)];
      } else if (lower.endsWith('.csv') || lower.endsWith('.tsv') || lower.endsWith('.txt')) {
        const valErr = validateDocumentContent(file.filename, file.content);
        if (valErr) {
          errors.push({ filename: file.filename, message: valErr.message });
          skipped++;
          continue;
        }
        parsed = parseFAQ(file.filename, file.content);
      } else if (lower.endsWith('.json')) {
        const valErr = validateDocumentContent(file.filename, file.content);
        if (valErr) {
          errors.push({ filename: file.filename, message: valErr.message });
          skipped++;
          continue;
        }
        parsed = parseHistory(file.filename, file.content);
      } else {
        errors.push({ filename: file.filename, message: '不支持的文件格式' });
        LogRepo.create({
          level: 'warn',
          category: 'import',
          message: `不支持的文件格式：${file.filename}`,
          affectedScope: `文件 ${file.filename}`,
          recoverable: true,
        });
        skipped++;
        continue;
      }
      for (const p of parsed) {
        if (!p.content.trim()) {
          skipped++;
          continue;
        }
        docInputs.push(p);
      }
    }
    updateProgress(taskId, {
      processedFiles: files.length,
      currentFile: null,
      totalDocuments: docInputs.length,
    });

    if (isCancelled(taskId)) {
      await this._handleCancellation(taskId);
      return;
    }

    const version = VersionRepo.create({
      name: versionName,
      description: `导入 ${docInputs.length} 条文档`,
      documentIds: [],
    });
    setVersionId(taskId, version.id);

    setPhase(taskId, 'dedup', '正在检测重复文档...');
    const existingDocs = DocumentRepo.list();
    const existingHashes = new Map(existingDocs.map((d) => [d.hash, d.id]));
    const newDocs: Array<Omit<(typeof existingDocs)[number], 'id' | 'createdAt'>> = [];
    const allChunkInputs: Array<Omit<import('../../shared/types.js').Chunk, 'id'>> = [];

    for (let i = 0; i < docInputs.length; i++) {
      if (isCancelled(taskId)) {
        VersionRepo.delete(version.id);
        await this._handleCancellation(taskId);
        return;
      }
      const input = docInputs[i];
      updateProgress(taskId, {
        processedDocuments: i,
        message: `检测重复：${input.title.slice(0, 40)}${input.title.length > 40 ? '...' : ''}`,
      });
      if (i % 20 === 0) await new Promise((r) => setImmediate(r));

      const hash = computeChecksum({ t: input.title, c: input.content, s: input.source });
      if (existingHashes.has(hash)) {
        duplicates++;
        newDocs.push({
          versionId: version.id,
          title: input.title,
          source: input.source,
          content: input.content,
          hash,
          isDuplicate: true,
          duplicateOf: existingHashes.get(hash),
          chunkCount: 0,
        });
        continue;
      }
      existingHashes.set(hash, '__pending__');
      newDocs.push({
        versionId: version.id,
        title: input.title,
        source: input.source,
        content: input.content,
        hash,
        isDuplicate: false,
        chunkCount: 0,
      });
    }
    updateProgress(taskId, { processedDocuments: docInputs.length });

    if (isCancelled(taskId)) {
      VersionRepo.delete(version.id);
      await this._handleCancellation(taskId);
      return;
    }

    setPhase(taskId, 'splitting', '正在切分文档...');
    let totalChunks = 0;
    for (let i = 0; i < newDocs.length; i++) {
      if (isCancelled(taskId)) {
        VersionRepo.delete(version.id);
        await this._handleCancellation(taskId);
        return;
      }
      const doc = newDocs[i];
      if (doc.isDuplicate) continue;
      updateProgress(taskId, {
        processedDocuments: i,
        message: `切分文档：${doc.title.slice(0, 40)}${doc.title.length > 40 ? '...' : ''}`,
      });
      if (i % 10 === 0) await new Promise((r) => setImmediate(r));

      const chunks = splitDocument('__temp__', doc.content, {
        chunkSize: params.chunkSize,
        chunkOverlap: params.chunkOverlap,
      });
      doc.chunkCount = chunks.length;
      totalChunks += chunks.length;
      for (const c of chunks) {
        allChunkInputs.push({ ...c, documentId: '__temp__' });
      }
      success++;
    }
    updateProgress(taskId, {
      processedDocuments: newDocs.length,
      totalChunks,
      processedChunks: 0,
    });

    if (isCancelled(taskId)) {
      VersionRepo.delete(version.id);
      await this._handleCancellation(taskId);
      return;
    }

    const createdDocs = DocumentRepo.bulkCreate(newDocs);
    createdDocs.forEach((d) => addCreatedDocId(taskId, d.id));
    const docIdMap = new Map<string, string>();
    createdDocs.forEach((d, i) => docIdMap.set(String(i), d.id));
    let chunkCursor = 0;
    const finalChunks: Array<Omit<import('../../shared/types.js').Chunk, 'id'>> = [];
    for (let i = 0; i < newDocs.length; i++) {
      const doc = newDocs[i];
      const docId = createdDocs[i].id;
      if (doc.isDuplicate) continue;
      for (let j = 0; j < doc.chunkCount; j++) {
        const chunk = allChunkInputs[chunkCursor + j];
        finalChunks.push({ ...chunk, documentId: docId });
      }
      chunkCursor += doc.chunkCount;
    }
    const createdChunks = ChunkRepo.bulkCreate(finalChunks);
    addCreatedChunkIds(taskId, createdChunks.map((c) => c.id));
    VersionRepo.update(version.id, { documentIds: createdDocs.map((d) => d.id) });

    setPhase(taskId, 'indexing', '正在构建索引...');
    const versionChunks = ChunkRepo.listByDocuments(createdDocs.filter((d) => !d.isDuplicate).map((d) => d.id));
    const index = buildIndex(version.id, versionChunks);
    saveIndex(version.id, index);
    VersionRepo.update(version.id, {
      indexStatus: 'ready',
      indexChecksum: index.checksum,
    });

    updateProgress(taskId, { processedChunks: totalChunks });

    const result: ImportResult = {
      success,
      skipped,
      duplicates,
      errors,
      versionId: version.id,
    };
    setTaskResult(taskId, result);
    LogRepo.create({
      level: 'info',
      category: 'import',
      message: `导入完成：成功${success}条，重复${duplicates}条，跳过${skipped}条，错误${errors.length}条`,
      affectedScope: `版本 ${version.id}`,
    });
  },

  async _handleCancellation(taskId: string): Promise<void> {
    const task = getImportTask(taskId);
    if (!task) return;

    if (task.progress.rollbackOnCancel) {
      if (task.versionId) {
        try {
          VersionRepo.delete(task.versionId);
        } catch {
          // ignore
        }
      }
      for (const docId of task.createdDocIds) {
        try {
          ChunkRepo.deleteByDocument(docId);
        } catch {
          // ignore
        }
        try {
          DocumentRepo.delete(docId);
        } catch {
          // ignore
        }
      }
    }

    setTaskCancelled(taskId);
    LogRepo.create({
      level: 'warn',
      category: 'import',
      message: `导入任务被取消${task.progress.rollbackOnCancel ? '，数据已回滚' : '，部分数据已保留'}`,
      affectedScope: `任务 ${taskId}${task.versionId ? `，版本 ${task.versionId}` : ''}`,
      recoverable: true,
    });
  },
};
