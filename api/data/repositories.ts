import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import {
  KnowledgeDocument,
  KnowledgeVersion,
  Chunk,
  QAResult,
  EvaluationTask,
  LogEntry,
  Metric,
} from '../../shared/types.js';
import {
  PATHS,
  ensureAllDirs,
  readJsonFile,
  writeJsonFile,
  appendJsonFile,
  deleteFile,
} from './storage.js';

ensureAllDirs();

const VERSIONS_FILE = path.join(PATHS.data, 'versions.json');
const DOCUMENTS_FILE = path.join(PATHS.data, 'documents.json');
const CHUNKS_FILE = path.join(PATHS.data, 'chunks.json');
const QA_FILE = path.join(PATHS.data, 'qa.json');
const EVAL_FILE = path.join(PATHS.data, 'evaluations.json');
const LOG_FILE = path.join(PATHS.data, 'logs.json');
const METRICS_FILE = PATHS.metrics;

function generateId(prefix: string): string {
  return `${prefix}_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
}

export const DocumentRepo = {
  list(): KnowledgeDocument[] {
    return readJsonFile<KnowledgeDocument[]>(DOCUMENTS_FILE, []);
  },
  getById(id: string): KnowledgeDocument | undefined {
    return this.list().find((d) => d.id === id);
  },
  getByHash(hash: string): KnowledgeDocument | undefined {
    return this.list().find((d) => d.hash === hash);
  },
  listByVersion(versionId: string): KnowledgeDocument[] {
    return this.list().filter((d) => d.versionId === versionId);
  },
  create(doc: Omit<KnowledgeDocument, 'id' | 'createdAt'>): KnowledgeDocument {
    const full: KnowledgeDocument = {
      ...doc,
      id: generateId('doc'),
      createdAt: Date.now(),
    };
    appendJsonFile<KnowledgeDocument>(DOCUMENTS_FILE, full);
    return full;
  },
  bulkCreate(
    docs: Array<Omit<KnowledgeDocument, 'id' | 'createdAt'>>,
  ): KnowledgeDocument[] {
    const existing = this.list();
    const created = docs.map((d) => ({
      ...d,
      id: generateId('doc'),
      createdAt: Date.now(),
    }));
    writeJsonFile(DOCUMENTS_FILE, [...existing, ...created]);
    return created;
  },
  update(
    id: string,
    patch: Partial<KnowledgeDocument>,
  ): KnowledgeDocument | undefined {
    const all = this.list();
    const idx = all.findIndex((d) => d.id === id);
    if (idx === -1) return undefined;
    all[idx] = { ...all[idx], ...patch };
    writeJsonFile(DOCUMENTS_FILE, all);
    return all[idx];
  },
  delete(id: string): boolean {
    const all = this.list();
    const filtered = all.filter((d) => d.id !== id);
    if (filtered.length === all.length) return false;
    writeJsonFile(DOCUMENTS_FILE, filtered);
    return true;
  },
};

export const ChunkRepo = {
  list(): Chunk[] {
    return readJsonFile<Chunk[]>(CHUNKS_FILE, []);
  },
  listByDocument(documentId: string): Chunk[] {
    return this.list().filter((c) => c.documentId === documentId);
  },
  listByDocuments(documentIds: string[]): Chunk[] {
    const set = new Set(documentIds);
    return this.list().filter((c) => set.has(c.documentId));
  },
  getById(id: string): Chunk | undefined {
    return this.list().find((c) => c.id === id);
  },
  bulkCreate(chunks: Array<Omit<Chunk, 'id'>>): Chunk[] {
    const existing = this.list();
    const created = chunks.map((c) => ({ ...c, id: generateId('chk') }));
    writeJsonFile(CHUNKS_FILE, [...existing, ...created]);
    return created;
  },
  deleteByDocument(documentId: string): number {
    const all = this.list();
    const filtered = all.filter((c) => c.documentId !== documentId);
    const removed = all.length - filtered.length;
    writeJsonFile(CHUNKS_FILE, filtered);
    return removed;
  },
};

export const VersionRepo = {
  list(): KnowledgeVersion[] {
    return readJsonFile<KnowledgeVersion[]>(VERSIONS_FILE, []);
  },
  getById(id: string): KnowledgeVersion | undefined {
    return this.list().find((v) => v.id === id);
  },
  create(
    v: Omit<KnowledgeVersion, 'id' | 'createdAt' | 'indexStatus'> & {
      indexStatus?: KnowledgeVersion['indexStatus'];
    },
  ): KnowledgeVersion {
    const full: KnowledgeVersion = {
      ...v,
      id: generateId('ver'),
      createdAt: Date.now(),
      indexStatus: v.indexStatus ?? 'building',
    };
    appendJsonFile<KnowledgeVersion>(VERSIONS_FILE, full);
    return full;
  },
  update(
    id: string,
    patch: Partial<KnowledgeVersion>,
  ): KnowledgeVersion | undefined {
    const all = this.list();
    const idx = all.findIndex((v) => v.id === id);
    if (idx === -1) return undefined;
    all[idx] = { ...all[idx], ...patch };
    writeJsonFile(VERSIONS_FILE, all);
    return all[idx];
  },
  delete(id: string): boolean {
    const all = this.list();
    const filtered = all.filter((v) => v.id !== id);
    if (filtered.length === all.length) return false;
    writeJsonFile(VERSIONS_FILE, filtered);
    return true;
  },
};

export const QARepo = {
  list(): QAResult[] {
    return readJsonFile<QAResult[]>(QA_FILE, []);
  },
  getById(id: string): QAResult | undefined {
    return this.list().find((r) => r.id === id);
  },
  listByVersion(versionId: string): QAResult[] {
    return this.list().filter((r) => r.versionId === versionId);
  },
  listByTask(taskId: string): QAResult[] {
    return this.list().filter((r) => r.taskId === taskId);
  },
  create(r: Omit<QAResult, 'id' | 'createdAt'>): QAResult {
    const full: QAResult = {
      ...r,
      id: generateId('qa'),
      createdAt: Date.now(),
    };
    appendJsonFile<QAResult>(QA_FILE, full);
    return full;
  },
  bulkCreate(results: Array<Omit<QAResult, 'id' | 'createdAt'>>): QAResult[] {
    const existing = this.list();
    const created = results.map((r) => ({
      ...r,
      id: generateId('qa'),
      createdAt: Date.now(),
    }));
    writeJsonFile(QA_FILE, [...existing, ...created]);
    return created;
  },
  update(id: string, patch: Partial<QAResult>): QAResult | undefined {
    const all = this.list();
    const idx = all.findIndex((r) => r.id === id);
    if (idx === -1) return undefined;
    all[idx] = { ...all[idx], ...patch };
    writeJsonFile(QA_FILE, all);
    return all[idx];
  },
};

export const EvaluationRepo = {
  list(): EvaluationTask[] {
    return readJsonFile<EvaluationTask[]>(EVAL_FILE, []);
  },
  getById(id: string): EvaluationTask | undefined {
    return this.list().find((t) => t.id === id);
  },
  create(
    t: Omit<EvaluationTask, 'id' | 'createdAt' | 'status' | 'resultIds'> & {
      status?: EvaluationTask['status'];
    },
  ): EvaluationTask {
    const full: EvaluationTask = {
      ...t,
      id: generateId('eval'),
      createdAt: Date.now(),
      status: t.status ?? 'pending',
      resultIds: [],
    };
    appendJsonFile<EvaluationTask>(EVAL_FILE, full);
    return full;
  },
  update(
    id: string,
    patch: Partial<EvaluationTask>,
  ): EvaluationTask | undefined {
    const all = this.list();
    const idx = all.findIndex((t) => t.id === id);
    if (idx === -1) return undefined;
    all[idx] = { ...all[idx], ...patch };
    writeJsonFile(EVAL_FILE, all);
    return all[idx];
  },
};

export const LogRepo = {
  list(): LogEntry[] {
    return readJsonFile<LogEntry[]>(LOG_FILE, []);
  },
  listByCategory(category: LogEntry['category']): LogEntry[] {
    return this.list().filter((l) => l.category === category);
  },
  listByLevel(level: LogEntry['level']): LogEntry[] {
    return this.list().filter((l) => l.level === level);
  },
  create(entry: Omit<LogEntry, 'id' | 'timestamp'>): LogEntry {
    const full: LogEntry = {
      ...entry,
      id: generateId('log'),
      timestamp: Date.now(),
    };
    appendJsonFile<LogEntry>(LOG_FILE, full);
    return full;
  },
  clear(): void {
    writeJsonFile(LOG_FILE, []);
  },
};

export const MetricRepo = {
  list(): Metric[] {
    return readJsonFile<Metric[]>(METRICS_FILE, []);
  },
  getById(id: string): Metric | undefined {
    return this.list().find((m) => m.id === id);
  },
  getByIds(ids: string[]): Metric[] {
    const set = new Set(ids);
    return this.list().filter((m) => set.has(m.id));
  },
  create(m: Omit<Metric, 'id' | 'createdAt' | 'updatedAt'>): Metric {
    const now = Date.now();
    const full: Metric = {
      ...m,
      id: generateId('mtc'),
      createdAt: now,
      updatedAt: now,
    };
    appendJsonFile<Metric>(METRICS_FILE, full);
    return full;
  },
  update(id: string, patch: Partial<Metric>): Metric | undefined {
    const all = this.list();
    const idx = all.findIndex((m) => m.id === id);
    if (idx === -1) return undefined;
    all[idx] = { ...all[idx], ...patch, updatedAt: Date.now() };
    writeJsonFile(METRICS_FILE, all);
    return all[idx];
  },
  delete(id: string): boolean {
    const all = this.list();
    const filtered = all.filter((m) => m.id !== id);
    if (filtered.length === all.length) return false;
    writeJsonFile(METRICS_FILE, filtered);
    return true;
  },
};
