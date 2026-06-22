import fs from 'node:fs';
import path from 'node:path';
import * as archiver from 'archiver';
import AdmZip from 'adm-zip';
import { v4 as uuidv4 } from 'uuid';
import { PATHS, ensureDir, readJsonFile, writeJsonFile, computeChecksum } from '../data/storage.js';
import type { BackupInfo, BackupType, BackupListResult, RestoreResult } from '../../shared/types.js';

const BACKUPS_INDEX_FILE = path.join(PATHS.backups, '_index.json');
const DATA_FILES = [
  'documents.json',
  'chunks.json',
  'versions.json',
  'qa.json',
  'evaluations.json',
  'logs.json',
  'metrics.json',
];

function ensureBackupDir(): void {
  ensureDir(PATHS.backups);
  ensureDir(path.join(PATHS.backups, 'temp'));
}

function generateBackupId(): string {
  return `bak_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
}

function getDataFilePath(filename: string): string {
  return path.join(PATHS.data, filename);
}

function getIndexFilePath(): string {
  return BACKUPS_INDEX_FILE;
}

function readBackupIndex(): BackupInfo[] {
  return readJsonFile<BackupInfo[]>(getIndexFilePath(), []);
}

function writeBackupIndex(backups: BackupInfo[]): void {
  writeJsonFile(getIndexFilePath(), backups);
}

function getFileModifiedTime(filePath: string): number {
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch {
    return 0;
  }
}

function listIndexFiles(): string[] {
  const indexDir = path.join(PATHS.data, 'indexes');
  if (!fs.existsSync(indexDir)) return [];
  return fs.readdirSync(indexDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => path.join('indexes', f));
}

function getAllDataFiles(): string[] {
  const files: string[] = [...DATA_FILES];
  const indexFiles = listIndexFiles();
  files.push(...indexFiles);
  return files;
}

function getChangedFiles(sinceTime: number): string[] {
  const allFiles = getAllDataFiles();
  return allFiles.filter((file) => {
    const fullPath = getDataFilePath(file);
    const mtime = getFileModifiedTime(fullPath);
    return mtime > sinceTime;
  });
}

function createZipBackup(backupId: string, files: string[], type: BackupType, baseBackupId?: string): Promise<BackupInfo> {
  return new Promise((resolve, reject) => {
    ensureBackupDir();
    const zipPath = path.join(PATHS.backups, `${backupId}.zip`);
    const output = fs.createWriteStream(zipPath);
    const archive = new archiver.ZipArchive({ zlib: { level: 9 } });

    output.on('close', () => {
      const size = archive.pointer();
      const zipBuffer = fs.readFileSync(zipPath);
      const checksum = computeChecksum(zipBuffer.toString('base64'));

      const info: BackupInfo = {
        id: backupId,
        name: `${type === 'full' ? '全量备份' : '增量备份'}_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}`,
        type,
        createdAt: Date.now(),
        size,
        baseBackupId,
        dataFiles: files,
        checksum,
      };

      const index = readBackupIndex();
      index.unshift(info);
      writeBackupIndex(index);

      resolve(info);
    });

    archive.on('error', (err: Error) => {
      reject(err);
    });

    archive.pipe(output);

    files.forEach((file) => {
      const fullPath = getDataFilePath(file);
      if (fs.existsSync(fullPath)) {
        archive.file(fullPath, { name: file });
      }
    });

    const manifest = {
      backupId,
      type,
      createdAt: Date.now(),
      baseBackupId,
      files,
      version: '1.0',
    };
    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

    archive.finalize();
  });
}

export const BackupService = {
  listBackups(): BackupListResult {
    ensureBackupDir();
    const backups = readBackupIndex();
    const totalSize = backups.reduce((sum, b) => sum + b.size, 0);
    const lastBackupAt = backups.length > 0 ? backups[0].createdAt : undefined;
    return { backups, lastBackupAt, totalSize };
  },

  async createFullBackup(description?: string): Promise<BackupInfo> {
    const backupId = generateBackupId();
    const files = getAllDataFiles();
    const info = await createZipBackup(backupId, files, 'full');
    if (description) {
      info.description = description;
      const index = readBackupIndex();
      const idx = index.findIndex((b) => b.id === backupId);
      if (idx !== -1) {
        index[idx].description = description;
        writeBackupIndex(index);
      }
    }
    return info;
  },

  async createIncrementalBackup(description?: string): Promise<BackupInfo> {
    ensureBackupDir();
    const index = readBackupIndex();
    
    const lastFullBackup = index.find((b) => b.type === 'full');
    if (!lastFullBackup) {
      return this.createFullBackup(description || '首次全量备份（自动创建）');
    }

    const lastBackupTime = index.length > 0 ? index[0].createdAt : 0;
    const changedFiles = getChangedFiles(lastBackupTime);

    if (changedFiles.length === 0) {
      throw new Error('自上次备份以来没有数据变更，无需增量备份');
    }

    const backupId = generateBackupId();
    const info = await createZipBackup(backupId, changedFiles, 'incremental', lastFullBackup.id);
    if (description) {
      info.description = description;
      const idx = index.findIndex((b) => b.id === backupId);
      if (idx !== -1) {
        index[idx].description = description;
        writeBackupIndex(index);
      }
    }
    return info;
  },

  getBackupInfo(backupId: string): BackupInfo | undefined {
    const index = readBackupIndex();
    return index.find((b) => b.id === backupId);
  },

  getBackupPath(backupId: string): string {
    return path.join(PATHS.backups, `${backupId}.zip`);
  },

  async restoreBackup(backupId: string): Promise<RestoreResult> {
    const backupInfo = this.getBackupInfo(backupId);
    if (!backupInfo) {
      throw new Error(`备份 ${backupId} 不存在`);
    }

    const zipPath = this.getBackupPath(backupId);
    if (!fs.existsSync(zipPath)) {
      throw new Error('备份文件不存在');
    }

    let rollbackBackupId: string | undefined;
    try {
      const rollbackInfo = await this.createFullBackup('恢复前自动备份');
      rollbackBackupId = rollbackInfo.id;
    } catch (e) {
      throw new Error(`创建回滚备份失败: ${e instanceof Error ? e.message : String(e)}`);
    }

    try {
      const zip = new AdmZip(zipPath);
      const entries = zip.getEntries();
      
      const manifestEntry = entries.find((e) => e.entryName === 'manifest.json');
      if (!manifestEntry) {
        throw new Error('无效的备份文件：缺少 manifest.json');
      }

      const manifest = JSON.parse(zip.readAsText(manifestEntry));

      const dataFiles = manifest.files || [];
      dataFiles.forEach((file: string) => {
        const entry = entries.find((e) => e.entryName === file);
        if (entry) {
          const destPath = getDataFilePath(file);
          ensureDir(path.dirname(destPath));
          zip.extractEntryTo(entry, path.dirname(destPath), false, true);
        }
      });

      return {
        success: true,
        message: `成功恢复备份 ${backupId}`,
        rollbackBackupId,
        restoredAt: Date.now(),
      };
    } catch (e) {
      if (rollbackBackupId) {
        try {
          await this.deleteBackup(rollbackBackupId);
        } catch {
          // 清理失败不影响主流程错误抛出
        }
      }
      throw e;
    }
  },

  deleteBackup(backupId: string): boolean {
    const index = readBackupIndex();
    const backup = index.find((b) => b.id === backupId);
    if (!backup) return false;

    const zipPath = this.getBackupPath(backupId);
    try {
      if (fs.existsSync(zipPath)) {
        fs.unlinkSync(zipPath);
      }
    } catch {
      return false;
    }

    const newIndex = index.filter((b) => b.id !== backupId);
    writeBackupIndex(newIndex);
    return true;
  },

  rollback(rollbackBackupId: string): RestoreResult {
    const backupInfo = this.getBackupInfo(rollbackBackupId);
    if (!backupInfo) {
      throw new Error(`回滚备份 ${rollbackBackupId} 不存在`);
    }

    const zipPath = this.getBackupPath(rollbackBackupId);
    if (!fs.existsSync(zipPath)) {
      throw new Error('回滚备份文件不存在');
    }

    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries();

    const manifestEntry = entries.find((e) => e.entryName === 'manifest.json');
    if (!manifestEntry) {
      throw new Error('无效的回滚备份文件');
    }

    const manifest = JSON.parse(zip.readAsText(manifestEntry));
    const dataFiles = manifest.files || [];

    dataFiles.forEach((file: string) => {
      const entry = entries.find((e) => e.entryName === file);
      if (entry) {
        const destPath = getDataFilePath(file);
        ensureDir(path.dirname(destPath));
        zip.extractEntryTo(entry, path.dirname(destPath), false, true);
      }
    });

    return {
      success: true,
      message: `成功回滚到备份 ${rollbackBackupId}`,
      rollbackBackupId,
      restoredAt: Date.now(),
    };
  },
};
