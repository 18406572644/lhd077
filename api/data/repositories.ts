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
  ScheduledEvaluationTask,
  ScheduledExecutionRecord,
  ScheduledAlert,
  NotificationMessage,
  Tag,
  TagRelation,
  TaggableType,
} from '../../shared/types.js';
import {
  PATHS,
  ensureAllDirs,
  readJsonFile,
  writeJsonFile,
  appendJsonFile,
} from './storage.js';

ensureAllDirs();

const VERSIONS_FILE = path.join(PATHS.data, 'versions.json');
const DOCUMENTS_FILE = path.join(PATHS.data, 'documents.json');
const CHUNKS_FILE = path.join(PATHS.data, 'chunks.json');
const QA_FILE = path.join(PATHS.data, 'qa.json');
const EVAL_FILE = path.join(PATHS.data, 'evaluations.json');
const LOG_FILE = path.join(PATHS.data, 'logs.json');
const METRICS_FILE = PATHS.metrics;
const SCHEDULED_TASKS_FILE = PATHS.scheduledTasks;
const SCHEDULED_EXECUTIONS_FILE = PATHS.scheduledExecutions;
const SCHEDULED_ALERTS_FILE = PATHS.scheduledAlerts;
const NOTIFICATIONS_FILE = PATHS.notifications;

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
  create(doc: Omit<KnowledgeDocument, 'id' | 'createdAt'> & { tagIds?: string[] }): KnowledgeDocument {
    const full: KnowledgeDocument = {
      tagIds: [],
      ...doc,
      id: generateId('doc'),
      createdAt: Date.now(),
    };
    appendJsonFile<KnowledgeDocument>(DOCUMENTS_FILE, full);
    return full;
  },
  bulkCreate(
    docs: Array<Omit<KnowledgeDocument, 'id' | 'createdAt'> & { tagIds?: string[] }>,
  ): KnowledgeDocument[] {
    const existing = this.list();
    const created = docs.map((d) => ({
      tagIds: [],
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
  create(r: Omit<QAResult, 'id' | 'createdAt'> & { tagIds?: string[] }): QAResult {
    const full: QAResult = {
      tagIds: [],
      ...r,
      id: generateId('qa'),
      createdAt: Date.now(),
    };
    appendJsonFile<QAResult>(QA_FILE, full);
    return full;
  },
  bulkCreate(results: Array<Omit<QAResult, 'id' | 'createdAt'> & { tagIds?: string[] }>): QAResult[] {
    const existing = this.list();
    const created = results.map((r) => ({
      tagIds: [],
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
    t: Omit<EvaluationTask, 'id' | 'createdAt' | 'status' | 'resultIds' | 'tagIds'> & {
      status?: EvaluationTask['status'];
      tagIds?: string[];
    },
  ): EvaluationTask {
    const full: EvaluationTask = {
      tagIds: [],
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

const MAX_SCRIPT_LENGTH = 10000;
const MAX_METRICS_COUNT = 100;

function validateMetricData(data: Partial<Metric>): void {
  if (data.name !== undefined) {
    if (typeof data.name !== 'string') {
      throw new Error('指标名称必须是字符串');
    }
    if (data.name.length === 0 || data.name.length > 100) {
      throw new Error('指标名称长度必须在 1-100 个字符之间');
    }
  }
  if (data.description !== undefined) {
    if (typeof data.description !== 'string') {
      throw new Error('指标描述必须是字符串');
    }
    if (data.description.length > 500) {
      throw new Error('指标描述不能超过 500 个字符');
    }
  }
  if (data.computeType !== undefined) {
    if (!['built-in', 'custom'].includes(data.computeType)) {
      throw new Error('无效的计算方式');
    }
  }
  if (data.builtInType !== undefined && data.builtInType !== null) {
    if (!['accuracy', 'partialRate', 'wrongRate', 'avgConfidence'].includes(data.builtInType)) {
      throw new Error('无效的内置指标类型');
    }
  }
  if (data.customScript !== undefined && data.customScript !== null) {
    if (typeof data.customScript !== 'string') {
      throw new Error('自定义脚本必须是字符串');
    }
    if (data.customScript.length > MAX_SCRIPT_LENGTH) {
      throw new Error(`自定义脚本长度不能超过 ${MAX_SCRIPT_LENGTH} 个字符`);
    }
    if (data.customScript.includes('require(') || data.customScript.includes('import ')) {
      throw new Error('自定义脚本不允许导入模块');
    }
    if (data.customScript.includes('process.') || data.customScript.includes('fs.') || data.customScript.includes('child_process')) {
      throw new Error('自定义脚本不允许访问系统资源');
    }
  }
  if (data.weight !== undefined) {
    if (typeof data.weight !== 'number' || isNaN(data.weight)) {
      throw new Error('权重必须是数字');
    }
    if (data.weight < 0 || data.weight > 100) {
      throw new Error('权重必须在 0-100 之间');
    }
  }
  if (data.higherIsBetter !== undefined) {
    if (typeof data.higherIsBetter !== 'boolean') {
      throw new Error('higherIsBetter 必须是布尔值');
    }
  }
}

export const MetricRepo = {
  list(): Metric[] {
    try {
      return readJsonFile<Metric[]>(METRICS_FILE, []);
    } catch (e) {
      console.error('读取指标列表失败:', e);
      return [];
    }
  },
  getById(id: string): Metric | undefined {
    if (!id || typeof id !== 'string') return undefined;
    return this.list().find((m) => m.id === id);
  },
  getByIds(ids: string[]): Metric[] {
    if (!Array.isArray(ids)) return [];
    const set = new Set(ids.filter((id) => id && typeof id === 'string'));
    return this.list().filter((m) => set.has(m.id));
  },
  create(m: Omit<Metric, 'id' | 'createdAt' | 'updatedAt'>): Metric {
    validateMetricData(m);

    if (m.computeType === 'built-in' && !m.builtInType) {
      throw new Error('内置指标需要指定类型');
    }
    if (m.computeType === 'custom' && !m.customScript?.trim()) {
      throw new Error('自定义指标需要提供脚本');
    }

    const existing = this.list();
    if (existing.length >= MAX_METRICS_COUNT) {
      throw new Error(`最多只能创建 ${MAX_METRICS_COUNT} 个指标`);
    }

    const duplicate = existing.find(
      (item) => item.name.toLowerCase() === m.name.toLowerCase(),
    );
    if (duplicate) {
      throw new Error('已存在同名指标');
    }

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
    if (!id || typeof id !== 'string') return undefined;

    const all = this.list();
    const idx = all.findIndex((m) => m.id === id);
    if (idx === -1) return undefined;

    validateMetricData(patch);

    if (patch.name !== undefined) {
      const duplicate = all.find(
        (item, i) =>
          i !== idx && item.name.toLowerCase() === patch.name!.toLowerCase(),
      );
      if (duplicate) {
        throw new Error('已存在同名指标');
      }
    }

    const updated = { ...all[idx], ...patch, updatedAt: Date.now() };

    if (updated.computeType === 'built-in' && !updated.builtInType) {
      throw new Error('内置指标需要指定类型');
    }
    if (updated.computeType === 'custom' && !updated.customScript?.trim()) {
      throw new Error('自定义指标需要提供脚本');
    }

    all[idx] = updated;
    writeJsonFile(METRICS_FILE, all);
    return all[idx];
  },
  delete(id: string): boolean {
    if (!id || typeof id !== 'string') return false;

    const all = this.list();
    const filtered = all.filter((m) => m.id !== id);
    if (filtered.length === all.length) return false;

    writeJsonFile(METRICS_FILE, filtered);
    return true;
  },
};

export const ScheduledTaskRepo = {
  list(): ScheduledEvaluationTask[] {
    return readJsonFile<ScheduledEvaluationTask[]>(SCHEDULED_TASKS_FILE, []);
  },
  getById(id: string): ScheduledEvaluationTask | undefined {
    return this.list().find((t) => t.id === id);
  },
  listActive(): ScheduledEvaluationTask[] {
    return this.list().filter((t) => t.status === 'active');
  },
  create(
    t: Omit<ScheduledEvaluationTask, 'id' | 'createdAt' | 'updatedAt' | 'consecutiveAlertCount' | 'status'> & {
      status?: ScheduledEvaluationTask['status'];
    },
  ): ScheduledEvaluationTask {
    const now = Date.now();
    const full: ScheduledEvaluationTask = {
      ...t,
      id: generateId('sch'),
      status: t.status ?? 'active',
      consecutiveAlertCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    appendJsonFile<ScheduledEvaluationTask>(SCHEDULED_TASKS_FILE, full);
    return full;
  },
  update(
    id: string,
    patch: Partial<ScheduledEvaluationTask>,
  ): ScheduledEvaluationTask | undefined {
    const all = this.list();
    const idx = all.findIndex((t) => t.id === id);
    if (idx === -1) return undefined;
    all[idx] = { ...all[idx], ...patch, updatedAt: Date.now() };
    writeJsonFile(SCHEDULED_TASKS_FILE, all);
    return all[idx];
  },
  delete(id: string): boolean {
    const all = this.list();
    const filtered = all.filter((t) => t.id !== id);
    if (filtered.length === all.length) return false;
    writeJsonFile(SCHEDULED_TASKS_FILE, filtered);
    return true;
  },
};

export const ScheduledExecutionRepo = {
  list(): ScheduledExecutionRecord[] {
    return readJsonFile<ScheduledExecutionRecord[]>(SCHEDULED_EXECUTIONS_FILE, []);
  },
  getById(id: string): ScheduledExecutionRecord | undefined {
    return this.list().find((r) => r.id === id);
  },
  listByScheduledTask(scheduledTaskId: string): ScheduledExecutionRecord[] {
    return this.list()
      .filter((r) => r.scheduledTaskId === scheduledTaskId)
      .sort((a, b) => b.triggeredAt - a.triggeredAt);
  },
  create(r: Omit<ScheduledExecutionRecord, 'id'>): ScheduledExecutionRecord {
    const full: ScheduledExecutionRecord = {
      ...r,
      id: generateId('sex'),
    };
    appendJsonFile<ScheduledExecutionRecord>(SCHEDULED_EXECUTIONS_FILE, full);
    return full;
  },
  update(
    id: string,
    patch: Partial<ScheduledExecutionRecord>,
  ): ScheduledExecutionRecord | undefined {
    const all = this.list();
    const idx = all.findIndex((r) => r.id === id);
    if (idx === -1) return undefined;
    all[idx] = { ...all[idx], ...patch };
    writeJsonFile(SCHEDULED_EXECUTIONS_FILE, all);
    return all[idx];
  },
};

export const ScheduledAlertRepo = {
  list(): ScheduledAlert[] {
    return readJsonFile<ScheduledAlert[]>(SCHEDULED_ALERTS_FILE, []);
  },
  getById(id: string): ScheduledAlert | undefined {
    return this.list().find((a) => a.id === id);
  },
  listByScheduledTask(scheduledTaskId: string): ScheduledAlert[] {
    return this.list()
      .filter((a) => a.scheduledTaskId === scheduledTaskId)
      .sort((a, b) => b.triggeredAt - a.triggeredAt);
  },
  listByExecution(executionId: string): ScheduledAlert[] {
    return this.list().filter((a) => a.executionId === executionId);
  },
  listUnacknowledged(): ScheduledAlert[] {
    return this.list()
      .filter((a) => !a.acknowledged)
      .sort((a, b) => b.triggeredAt - a.triggeredAt);
  },
  create(a: Omit<ScheduledAlert, 'id' | 'triggeredAt' | 'acknowledged'>): ScheduledAlert {
    const full: ScheduledAlert = {
      ...a,
      id: generateId('alt'),
      triggeredAt: Date.now(),
      acknowledged: false,
    };
    appendJsonFile<ScheduledAlert>(SCHEDULED_ALERTS_FILE, full);
    return full;
  },
  acknowledge(id: string): ScheduledAlert | undefined {
    const all = this.list();
    const idx = all.findIndex((a) => a.id === id);
    if (idx === -1) return undefined;
    all[idx] = { ...all[idx], acknowledged: true };
    writeJsonFile(SCHEDULED_ALERTS_FILE, all);
    return all[idx];
  },
  acknowledgeByTask(scheduledTaskId: string): number {
    const all = this.list();
    let updated = 0;
    for (let i = 0; i < all.length; i++) {
      if (all[i].scheduledTaskId === scheduledTaskId && !all[i].acknowledged) {
        all[i] = { ...all[i], acknowledged: true };
        updated++;
      }
    }
    if (updated > 0) writeJsonFile(SCHEDULED_ALERTS_FILE, all);
    return updated;
  },
};

export const NotificationRepo = {
  list(): NotificationMessage[] {
    return readJsonFile<NotificationMessage[]>(NOTIFICATIONS_FILE, []);
  },
  listByScheduledTask(scheduledTaskId: string): NotificationMessage[] {
    return this.list()
      .filter((n) => n.scheduledTaskId === scheduledTaskId)
      .sort((a, b) => b.sentAt - a.sentAt);
  },
  create(n: Omit<NotificationMessage, 'id' | 'sentAt'>): NotificationMessage {
    const full: NotificationMessage = {
      ...n,
      id: generateId('ntf'),
      sentAt: Date.now(),
    };
    appendJsonFile<NotificationMessage>(NOTIFICATIONS_FILE, full);
    return full;
  },
};

const TAGS_FILE = PATHS.tags;
const TAG_RELATIONS_FILE = PATHS.tagRelations;

function validateTagData(data: Partial<Tag>): void {
  if (data.name !== undefined) {
    if (typeof data.name !== 'string') {
      throw new Error('标签名称必须是字符串');
    }
    if (data.name.length === 0 || data.name.length > 50) {
      throw new Error('标签名称长度必须在 1-50 个字符之间');
    }
  }
  if (data.color !== undefined) {
    if (typeof data.color !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(data.color)) {
      throw new Error('标签颜色必须是有效的十六进制颜色值');
    }
  }
  if (data.description !== undefined && data.description !== null) {
    if (typeof data.description !== 'string') {
      throw new Error('标签描述必须是字符串');
    }
    if (data.description.length > 200) {
      throw new Error('标签描述不能超过 200 个字符');
    }
  }
  if (data.parentId !== undefined && data.parentId !== null) {
    if (typeof data.parentId !== 'string') {
      throw new Error('父标签ID必须是字符串');
    }
  }
}

export const TagRepo = {
  list(): Tag[] {
    return readJsonFile<Tag[]>(TAGS_FILE, []);
  },
  getById(id: string): Tag | undefined {
    return this.list().find((t) => t.id === id);
  },
  getByIds(ids: string[]): Tag[] {
    const set = new Set(ids.filter((id) => id && typeof id === 'string'));
    return this.list().filter((t) => set.has(t.id));
  },
  listByParent(parentId: string | null): Tag[] {
    return this.list().filter((t) => t.parentId === parentId);
  },
  getRootTags(): Tag[] {
    return this.list().filter((t) => t.parentId === null);
  },
  getChildren(parentId: string): Tag[] {
    return this.list().filter((t) => t.parentId === parentId);
  },
  getAllDescendants(parentId: string): Tag[] {
    const all = this.list();
    const result: Tag[] = [];
    const stack = [parentId];
    while (stack.length > 0) {
      const currentId = stack.pop()!;
      const children = all.filter((t) => t.parentId === currentId);
      result.push(...children);
      children.forEach((c) => stack.push(c.id));
    }
    return result;
  },
  getAncestors(tagId: string): Tag[] {
    const all = this.list();
    const result: Tag[] = [];
    let current = all.find((t) => t.id === tagId);
    while (current && current.parentId) {
      const parent = all.find((t) => t.id === current!.parentId);
      if (parent) {
        result.unshift(parent);
        current = parent;
      } else {
        break;
      }
    }
    return result;
  },
  create(t: Omit<Tag, 'id' | 'createdAt' | 'updatedAt'>): Tag {
    validateTagData(t);

    if (t.parentId) {
      const parent = this.getById(t.parentId);
      if (!parent) {
        throw new Error('父标签不存在');
      }
    }

    const existing = this.list();
    const duplicate = existing.find(
      (item) =>
        item.name.toLowerCase() === t.name.toLowerCase() &&
        item.parentId === t.parentId,
    );
    if (duplicate) {
      throw new Error('同级标签中已存在同名标签');
    }

    const now = Date.now();
    const full: Tag = {
      ...t,
      id: generateId('tag'),
      createdAt: now,
      updatedAt: now,
    };
    appendJsonFile<Tag>(TAGS_FILE, full);
    return full;
  },
  update(id: string, patch: Partial<Tag>): Tag | undefined {
    const all = this.list();
    const idx = all.findIndex((t) => t.id === id);
    if (idx === -1) return undefined;

    validateTagData(patch);

    if (patch.parentId !== undefined && patch.parentId !== null) {
      const parent = this.getById(patch.parentId);
      if (!parent) {
        throw new Error('父标签不存在');
      }
      if (patch.parentId === id) {
        throw new Error('不能将标签设为自己的子标签');
      }
      const descendants = this.getAllDescendants(id);
      if (descendants.some((d) => d.id === patch.parentId)) {
        throw new Error('不能将标签设为其后代标签的子标签');
      }
    }

    if (patch.name !== undefined) {
      const targetParentId =
        patch.parentId !== undefined ? patch.parentId : all[idx].parentId;
      const duplicate = all.find(
        (item, i) =>
          i !== idx &&
          item.name.toLowerCase() === patch.name!.toLowerCase() &&
          item.parentId === targetParentId,
      );
      if (duplicate) {
        throw new Error('同级标签中已存在同名标签');
      }
    }

    const updated = { ...all[idx], ...patch, updatedAt: Date.now() };
    all[idx] = updated;
    writeJsonFile(TAGS_FILE, all);
    return all[idx];
  },
  delete(id: string): { success: boolean; deletedCount: number } {
    const all = this.list();
    const tag = all.find((t) => t.id === id);
    if (!tag) return { success: false, deletedCount: 0 };

    const descendants = this.getAllDescendants(id);
    const toDeleteIds = new Set([id, ...descendants.map((d) => d.id)]);
    const deletedCount = toDeleteIds.size;

    const filtered = all.filter((t) => !toDeleteIds.has(t.id));
    writeJsonFile(TAGS_FILE, filtered);

    const relations = TagRelationRepo.list();
    const filteredRelations = relations.filter((r) => !toDeleteIds.has(r.tagId));
    writeJsonFile(TAG_RELATIONS_FILE, filteredRelations);

    return { success: true, deletedCount };
  },
};

export const TagRelationRepo = {
  list(): TagRelation[] {
    return readJsonFile<TagRelation[]>(TAG_RELATIONS_FILE, []);
  },
  getById(id: string): TagRelation | undefined {
    return this.list().find((r) => r.id === id);
  },
  listByTag(tagId: string): TagRelation[] {
    return this.list().filter((r) => r.tagId === tagId);
  },
  listByTarget(targetType: TaggableType, targetId: string): TagRelation[] {
    return this.list().filter(
      (r) => r.targetType === targetType && r.targetId === targetId,
    );
  },
  listByTags(tagIds: string[]): TagRelation[] {
    const set = new Set(tagIds.filter((id) => id && typeof id === 'string'));
    return this.list().filter((r) => set.has(r.tagId));
  },
  listByTagAndType(
    tagId: string,
    targetType: TaggableType,
  ): TagRelation[] {
    return this.list().filter(
      (r) => r.tagId === tagId && r.targetType === targetType,
    );
  },
  getTargetIdsByTags(
    tagIds: string[],
    targetType: TaggableType,
    matchAll: boolean = false,
  ): string[] {
    const relations = this.list().filter(
      (r) => r.targetType === targetType && tagIds.includes(r.tagId),
    );

    if (matchAll) {
      const targetTagMap = new Map<string, Set<string>>();
      relations.forEach((r) => {
        if (!targetTagMap.has(r.targetId)) {
          targetTagMap.set(r.targetId, new Set());
        }
        targetTagMap.get(r.targetId)!.add(r.tagId);
      });
      return Array.from(targetTagMap.entries())
        .filter(([, tags]) => tagIds.every((t) => tags.has(t)))
        .map(([targetId]) => targetId);
    }

    return Array.from(new Set(relations.map((r) => r.targetId)));
  },
  addTagToTarget(
    tagId: string,
    targetType: TaggableType,
    targetId: string,
  ): TagRelation {
    const existing = this.list();
    const exists = existing.find(
      (r) =>
        r.tagId === tagId &&
        r.targetType === targetType &&
        r.targetId === targetId,
    );
    if (exists) return exists;

    const full: TagRelation = {
      id: generateId('tgr'),
      tagId,
      targetType,
      targetId,
      createdAt: Date.now(),
    };
    appendJsonFile<TagRelation>(TAG_RELATIONS_FILE, full);

    this.syncTagIds(targetType, targetId);

    return full;
  },
  addTagsToTarget(
    tagIds: string[],
    targetType: TaggableType,
    targetId: string,
  ): TagRelation[] {
    const created: TagRelation[] = [];
    for (const tagId of tagIds) {
      const rel = this.addTagToTarget(tagId, targetType, targetId);
      created.push(rel);
    }
    return created;
  },
  removeTagFromTarget(
    tagId: string,
    targetType: TaggableType,
    targetId: string,
  ): boolean {
    const all = this.list();
    const filtered = all.filter(
      (r) =>
        !(
          r.tagId === tagId &&
          r.targetType === targetType &&
          r.targetId === targetId
        ),
    );
    if (filtered.length === all.length) return false;
    writeJsonFile(TAG_RELATIONS_FILE, filtered);

    this.syncTagIds(targetType, targetId);

    return true;
  },
  setTagsForTarget(
    tagIds: string[],
    targetType: TaggableType,
    targetId: string,
  ): void {
    const all = this.list();
    const filtered = all.filter(
      (r) => !(r.targetType === targetType && r.targetId === targetId),
    );
    const now = Date.now();
    const newRelations = tagIds.map((tagId) => ({
      id: generateId('tgr'),
      tagId,
      targetType,
      targetId,
      createdAt: now,
    }));
    writeJsonFile(TAG_RELATIONS_FILE, [...filtered, ...newRelations]);

    this.syncTagIds(targetType, targetId);
  },
  syncTagIds(targetType: TaggableType, targetId: string): void {
    const relations = this.listByTarget(targetType, targetId);
    const tagIds = relations.map((r) => r.tagId);

    try {
      if (targetType === 'document') {
        DocumentRepo.update(targetId, { tagIds } as Partial<KnowledgeDocument>);
      } else if (targetType === 'qa') {
        QARepo.update(targetId, { tagIds } as Partial<QAResult>);
      } else if (targetType === 'evaluation') {
        EvaluationRepo.update(targetId, { tagIds } as Partial<EvaluationTask>);
      }
    } catch {
      // 同步失败不影响标签关系本身的正确性
    }
  },
  removeByTarget(targetType: TaggableType, targetId: string): number {
    const all = this.list();
    const filtered = all.filter(
      (r) => !(r.targetType === targetType && r.targetId === targetId),
    );
    const removed = all.length - filtered.length;
    if (removed > 0) {
      writeJsonFile(TAG_RELATIONS_FILE, filtered);
    }
    return removed;
  },
};
