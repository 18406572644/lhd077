import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const DATA_DIR = path.join(PROJECT_ROOT, 'data');
const EXPORTS_DIR = path.join(PROJECT_ROOT, 'exports');

export const PATHS = {
  root: PROJECT_ROOT,
  data: DATA_DIR,
  exports: EXPORTS_DIR,
  versions: path.join(DATA_DIR, 'versions'),
  documents: path.join(DATA_DIR, 'documents'),
  chunks: path.join(DATA_DIR, 'chunks'),
  indexes: path.join(DATA_DIR, 'indexes'),
  qa: path.join(DATA_DIR, 'qa'),
  evaluations: path.join(DATA_DIR, 'evaluations'),
  logs: path.join(DATA_DIR, 'logs'),
  metrics: path.join(DATA_DIR, 'metrics.json'),
};

export function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function ensureAllDirs(): void {
  Object.values(PATHS).forEach((p) => ensureDir(p));
}

export function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) {
      return fallback;
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJsonFile(filePath: string, data: unknown): void {
  ensureDir(path.dirname(filePath));
  const json = JSON.stringify(data, null, 2);
  fs.writeFileSync(filePath, json, 'utf-8');
}

export function appendJsonFile<T>(filePath: string, item: T): void {
  const existing = readJsonFile<T[]>(filePath, []);
  existing.push(item);
  writeJsonFile(filePath, existing);
}

export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

export function deleteFile(filePath: string): boolean {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function listFiles(dir: string, ext?: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir);
  if (ext) {
    return files.filter((f) => f.endsWith(ext));
  }
  return files;
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
  try {
    return fs.readFileSync(filePath);
  } catch {
    return null;
  }
}

export function writeBinaryFile(filePath: string, data: Buffer): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, data);
}
