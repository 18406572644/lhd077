import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const DATA_DIR = path.join(PROJECT_ROOT, 'data');
const EXPORTS_DIR = path.join(PROJECT_ROOT, 'exports');
const BACKUPS_DIR = path.join(PROJECT_ROOT, 'backups');

export const PATHS = {
  root: PROJECT_ROOT,
  data: DATA_DIR,
  exports: EXPORTS_DIR,
  backups: BACKUPS_DIR,
  versions: path.join(DATA_DIR, 'versions'),
  documents: path.join(DATA_DIR, 'documents'),
  chunks: path.join(DATA_DIR, 'chunks'),
  indexes: path.join(DATA_DIR, 'indexes'),
  qa: path.join(DATA_DIR, 'qa'),
  evaluations: path.join(DATA_DIR, 'evaluations'),
  logs: path.join(DATA_DIR, 'logs'),
  metrics: path.join(DATA_DIR, 'metrics.json'),
  tags: path.join(DATA_DIR, 'tags.json'),
  tagRelations: path.join(DATA_DIR, 'tag_relations.json'),
  scheduledTasks: path.join(DATA_DIR, 'scheduled_tasks.json'),
  scheduledExecutions: path.join(DATA_DIR, 'scheduled_executions.json'),
  scheduledAlerts: path.join(DATA_DIR, 'scheduled_alerts.json'),
  notifications: path.join(DATA_DIR, 'notifications.json'),
} as const;

const DIR_PATHS = new Set([
  PATHS.root,
  PATHS.data,
  PATHS.exports,
  PATHS.backups,
  PATHS.versions,
  PATHS.documents,
  PATHS.chunks,
  PATHS.indexes,
  PATHS.qa,
  PATHS.evaluations,
  PATHS.logs,
]);

const FILE_PATHS = new Set([
  PATHS.metrics,
]);

const ALLOWED_BASE_DIRS = new Set([
  PROJECT_ROOT,
  DATA_DIR,
  EXPORTS_DIR,
  BACKUPS_DIR,
]);

export function isPathAllowed(filePath: string): boolean {
  try {
    const normalized = path.resolve(filePath);
    for (const baseDir of ALLOWED_BASE_DIRS) {
      const normalizedBase = path.resolve(baseDir);
      if (normalized === normalizedBase) return true;
      if (normalized.startsWith(normalizedBase + path.sep)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function isPathTraversal(filePath: string): boolean {
  try {
    const normalized = path.normalize(filePath);
    return normalized.includes('..' + path.sep) || normalized.startsWith('..' + path.sep);
  } catch {
    return true;
  }
}

export function validateFilePath(filePath: string): void {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('路径不能为空');
  }
  if (isPathTraversal(filePath)) {
    throw new Error(`非法路径操作：检测到路径穿越攻击 - ${filePath}`);
  }
  if (!isPathAllowed(filePath)) {
    throw new Error(`非法路径操作：超出允许的目录范围 - ${filePath}`);
  }
}

export function ensureDir(dir: string): void {
  validateFilePath(dir);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function ensureAllDirs(): void {
  for (const dirPath of DIR_PATHS) {
    try {
      ensureDir(dirPath);
    } catch (e) {
      console.warn(`目录创建失败 ${dirPath}:`, e);
    }
  }
  for (const filePath of FILE_PATHS) {
    try {
      ensureDir(path.dirname(filePath));
      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        fs.rmSync(filePath, { recursive: true, force: true });
      }
    } catch (e) {
      console.warn(`文件目录清理失败 ${filePath}:`, e);
    }
  }
}

export function readJsonFile<T>(filePath: string, fallback: T): T {
  validateFilePath(filePath);
  try {
    if (!fs.existsSync(filePath)) {
      return fallback;
    }
    const stats = fs.statSync(filePath);
    if (stats.isDirectory()) {
      console.warn(`路径 ${filePath} 是目录，预期为文件，正在清理...`);
      fs.rmSync(filePath, { recursive: true, force: true });
      return fallback;
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch (e) {
    console.warn(`读取文件失败 ${filePath}:`, e);
    return fallback;
  }
}

export function writeJsonFile(filePath: string, data: unknown): void {
  validateFilePath(filePath);
  const dirPath = path.dirname(filePath);
  ensureDir(dirPath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    fs.rmSync(filePath, { recursive: true, force: true });
  }

  const json = JSON.stringify(data, null, 2);
  const tempPath = `${filePath}.tmp.${Date.now()}`;

  try {
    fs.writeFileSync(tempPath, json, 'utf-8');
    if (fs.existsSync(filePath)) {
      fs.copyFileSync(filePath, `${filePath}.bak`);
    }
    fs.renameSync(tempPath, filePath);
    try {
      const bakPath = `${filePath}.bak`;
      if (fs.existsSync(bakPath)) {
        fs.unlinkSync(bakPath);
      }
    } catch {
      // 忽略备份文件删除错误
    }
  } catch (e) {
    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
      const bakPath = `${filePath}.bak`;
      if (fs.existsSync(bakPath)) {
        fs.renameSync(bakPath, filePath);
      }
    } catch (cleanupError) {
      console.error('临时文件清理失败:', cleanupError);
    }
    throw new Error(`写入文件失败 ${filePath}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export function appendJsonFile<T>(filePath: string, item: T): void {
  validateFilePath(filePath);
  const existing = readJsonFile<T[]>(filePath, []);
  existing.push(item);
  writeJsonFile(filePath, existing);
}

export function fileExists(filePath: string): boolean {
  validateFilePath(filePath);
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

export function deleteFile(filePath: string): boolean {
  validateFilePath(filePath);
  try {
    if (fs.existsSync(filePath)) {
      if (fs.statSync(filePath).isDirectory()) {
        fs.rmSync(filePath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(filePath);
      }
      return true;
    }
    return false;
  } catch (e) {
    console.warn(`删除文件失败 ${filePath}:`, e);
    return false;
  }
}

export function listFiles(dir: string, ext?: string): string[] {
  validateFilePath(dir);
  try {
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
      return [];
    }
    const files = fs.readdirSync(dir);
    if (ext) {
      return files.filter((f) => f.endsWith(ext));
    }
    return files;
  } catch {
    return [];
  }
}

export function computeChecksum(data: unknown): string {
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export function readBinaryFile(filePath: string): Buffer | null {
  validateFilePath(filePath);
  try {
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      return null;
    }
    return fs.readFileSync(filePath);
  } catch {
    return null;
  }
}

export function writeBinaryFile(filePath: string, data: Buffer): void {
  validateFilePath(filePath);
  const dirPath = path.dirname(filePath);
  ensureDir(dirPath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    fs.rmSync(filePath, { recursive: true, force: true });
  }

  const tempPath = `${filePath}.tmp.${Date.now()}`;
  try {
    fs.writeFileSync(tempPath, data);
    fs.renameSync(tempPath, filePath);
  } catch (e) {
    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    } catch {
      // 忽略清理错误
    }
    throw new Error(`写入二进制文件失败 ${filePath}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export function cleanupTempFiles(dir: string, maxAgeMs: number = 3600000): void {
  validateFilePath(dir);
  try {
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
      return;
    }
    const files = fs.readdirSync(dir);
    const now = Date.now();
    for (const file of files) {
      if (file.startsWith('.') || file.endsWith('.tmp')) {
        const filePath = path.join(dir, file);
        try {
          const stats = fs.statSync(filePath);
          if (now - stats.mtimeMs > maxAgeMs) {
            if (stats.isDirectory()) {
              fs.rmSync(filePath, { recursive: true, force: true });
            } else {
              fs.unlinkSync(filePath);
            }
          }
        } catch {
          // 忽略单个文件清理错误
        }
      }
    }
  } catch (e) {
    console.warn('临时文件清理失败:', e);
  }
}
