import { Router, type Request, type Response } from 'express';
import { BackupService } from '../services/BackupService.js';
import path from 'node:path';
import fs from 'node:fs';
import multer from 'multer';
import AdmZip from 'adm-zip';
import { PATHS, writeJsonFile } from '../data/storage.js';

const router = Router();

const upload = multer({ dest: path.join('backups', 'temp') });

router.get('/', (_req: Request, res: Response) => {
  try {
    const result = BackupService.listBackups();
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取备份列表失败',
    });
  }
});

router.post('/full', async (req: Request, res: Response) => {
  try {
    const { description } = req.body;
    const backup = await BackupService.createFullBackup(description);
    res.json({ success: true, backup });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '创建全量备份失败',
    });
  }
});

router.post('/incremental', async (req: Request, res: Response) => {
  try {
    const { description } = req.body;
    const backup = await BackupService.createIncrementalBackup(description);
    res.json({ success: true, backup });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '创建增量备份失败',
    });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const backup = BackupService.getBackupInfo(id);
    if (!backup) {
      res.status(404).json({ success: false, error: '备份不存在' });
      return;
    }
    res.json({ success: true, backup });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取备份信息失败',
    });
  }
});

router.get('/:id/download', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const backup = BackupService.getBackupInfo(id);
    if (!backup) {
      res.status(404).json({ success: false, error: '备份不存在' });
      return;
    }
    const zipPath = BackupService.getBackupPath(id);
    if (!fs.existsSync(zipPath)) {
      res.status(404).json({ success: false, error: '备份文件不存在' });
      return;
    }
    const filename = `${backup.name}.zip`;
    res.download(zipPath, filename);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '下载备份失败',
    });
  }
});

router.post('/:id/restore', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await BackupService.restoreBackup(id);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '恢复备份失败',
    });
  }
});

router.post('/:id/rollback', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = BackupService.rollback(id);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '回滚失败',
    });
  }
});

router.delete('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = BackupService.deleteBackup(id);
    if (!deleted) {
      res.status(404).json({ success: false, error: '备份不存在' });
      return;
    }
    res.json({ success: true, message: '备份已删除' });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '删除备份失败',
    });
  }
});

router.post('/import', upload.single('file'), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: '请上传备份文件' });
      return;
    }

    const tempPath = req.file.path;
    const backupId = `bak_import_${Date.now()}`;
    const destPath = BackupService.getBackupPath(backupId);

    fs.renameSync(tempPath, destPath);

    const admZip = new AdmZip(destPath);
    const manifestEntry = admZip.getEntry('manifest.json');
    
    if (!manifestEntry) {
      fs.unlinkSync(destPath);
      res.status(400).json({ success: false, error: '无效的备份文件：缺少 manifest.json' });
      return;
    }

    const manifest = JSON.parse(admZip.readAsText(manifestEntry));
    const stats = fs.statSync(destPath);

    const backupInfo = {
      id: backupId,
      name: `导入_${req.file.originalname.replace(/\.zip$/, '')}`,
      type: manifest.type || 'full',
      createdAt: manifest.createdAt || Date.now(),
      size: stats.size,
      dataFiles: manifest.files || [],
      checksum: '',
      description: '从外部导入的备份',
    };

    const backups = BackupService.listBackups().backups;
    backups.unshift(backupInfo);
    writeJsonFile(path.join(PATHS.backups, '_index.json'), backups);

    res.json({ success: true, backup: backupInfo });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '导入备份失败',
    });
  }
});

export default router;
