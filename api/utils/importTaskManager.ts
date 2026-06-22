import type { ImportProgress, ImportPhase, ImportTask, ImportResult } from '../../shared/types.js';

const tasks = new Map<string, ImportTask>();

function generateId(): string {
  return `imp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createImportTask(totalFiles: number): ImportTask {
  const taskId = generateId();
  const now = Date.now();
  const task: ImportTask = {
    id: taskId,
    progress: {
      taskId,
      phase: 'parsing',
      totalFiles,
      processedFiles: 0,
      currentFile: null,
      totalDocuments: 0,
      processedDocuments: 0,
      totalChunks: 0,
      processedChunks: 0,
      message: '准备开始导入...',
      startedAt: now,
      updatedAt: now,
      cancelled: false,
    },
    cancelRequested: false,
    createdDocIds: [],
    createdChunkIds: [],
  };
  tasks.set(taskId, task);
  return task;
}

export function getImportTask(taskId: string): ImportTask | undefined {
  return tasks.get(taskId);
}

export function getImportProgress(taskId: string): ImportProgress | null {
  const task = tasks.get(taskId);
  return task ? task.progress : null;
}

export function updateProgress(
  taskId: string,
  updates: Partial<Omit<ImportProgress, 'taskId' | 'startedAt'>>,
): void {
  const task = tasks.get(taskId);
  if (!task) return;
  task.progress = {
    ...task.progress,
    ...updates,
    updatedAt: Date.now(),
  };
}

export function setPhase(taskId: string, phase: ImportPhase, message?: string): void {
  updateProgress(taskId, {
    phase,
    message: message ?? getDefaultPhaseMessage(phase),
  });
}

function getDefaultPhaseMessage(phase: ImportPhase): string {
  const messages: Record<ImportPhase, string> = {
    parsing: '正在解析文件...',
    dedup: '正在检测重复文档...',
    splitting: '正在切分文档...',
    indexing: '正在构建索引...',
    completed: '导入完成',
    cancelled: '导入已取消',
    failed: '导入失败',
  };
  return messages[phase];
}

export function isCancelled(taskId: string): boolean {
  const task = tasks.get(taskId);
  return task?.cancelRequested ?? false;
}

export function requestCancel(taskId: string, rollback: boolean): boolean {
  const task = tasks.get(taskId);
  if (!task) return false;
  if (task.progress.phase === 'completed' || task.progress.phase === 'cancelled' || task.progress.phase === 'failed') {
    return false;
  }
  task.cancelRequested = true;
  task.progress.rollbackOnCancel = rollback;
  return true;
}

export function setTaskResult(taskId: string, result: ImportResult): void {
  updateProgress(taskId, {
    phase: 'completed',
    message: `导入完成：成功${result.success}条，重复${result.duplicates}条`,
    result,
  });
}

export function setTaskError(taskId: string, error: string): void {
  updateProgress(taskId, {
    phase: 'failed',
    error,
    message: `导入失败：${error}`,
  });
}

export function setTaskCancelled(taskId: string): void {
  const task = tasks.get(taskId);
  if (!task) return;
  updateProgress(taskId, {
    phase: 'cancelled',
    cancelled: true,
    message: task.progress.rollbackOnCancel ? '导入已取消，数据已回滚' : '导入已取消，部分数据已保留',
  });
}

export function addCreatedDocId(taskId: string, docId: string): void {
  const task = tasks.get(taskId);
  if (task) task.createdDocIds.push(docId);
}

export function addCreatedChunkIds(taskId: string, chunkIds: string[]): void {
  const task = tasks.get(taskId);
  if (task) task.createdChunkIds.push(...chunkIds);
}

export function setVersionId(taskId: string, versionId: string): void {
  const task = tasks.get(taskId);
  if (task) task.versionId = versionId;
}

export function cleanupOldTasks(maxAgeMs = 30 * 60 * 1000): void {
  const now = Date.now();
  for (const [id, task] of tasks) {
    if (now - task.progress.updatedAt > maxAgeMs) {
      tasks.delete(id);
    }
  }
}

setInterval(cleanupOldTasks, 5 * 60 * 1000);
