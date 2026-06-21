import { computeChecksum } from '../data/storage.js';
import { DocumentRepo, ChunkRepo, VersionRepo, LogRepo } from '../data/repositories.js';
import { parseMarkdown, parseFAQ, parseHistory, ParsedDocument } from '../utils/documentParser.js';
import { splitDocument } from '../utils/chunkSplitter.js';
import { buildIndex, saveIndex, loadIndex, validateIndex } from '../utils/indexManager.js';
import { validateDocumentContent, sanitizeRetrievalParams } from '../utils/validators.js';
import type { KnowledgeSource, RetrievalParams, ImportResult } from '../../shared/types.js';

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
};
