import { Router } from 'express';
import multer from 'multer';
import { KnowledgeService } from '../services/KnowledgeService.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post('/import', upload.array('files', 50), (req, res) => {
  try {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    const versionName = req.body.versionName as string | undefined;
    const retrievalParams = req.body.retrievalParams
      ? JSON.parse(req.body.retrievalParams as string)
      : undefined;
    const parsed = files.map((f) => ({
      filename: f.originalname,
      content: f.buffer.toString('utf-8'),
    }));
    const result = KnowledgeService.importFiles(parsed, { versionName, retrievalParams });
    res.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ code: 'IMPORT_FAILED', message: msg });
  }
});

router.get('/versions', (_req, res) => {
  res.json(KnowledgeService.listVersions());
});

router.get('/versions/:id', (req, res) => {
  const v = KnowledgeService.getVersion(req.params.id);
  if (!v) res.status(404).json({ code: 'NOT_FOUND', message: '版本不存在' });
  else res.json(v);
});

router.get('/documents', (req, res) => {
  const versionId = req.query.versionId as string | undefined;
  res.json(KnowledgeService.listDocuments(versionId));
});

router.get('/documents/:id', (req, res) => {
  const doc = KnowledgeService.getDocument(req.params.id);
  if (!doc) res.status(404).json({ code: 'NOT_FOUND', message: '文档不存在' });
  else res.json(doc);
});

router.get('/documents/:id/chunks', (req, res) => {
  res.json(KnowledgeService.getDocumentChunks(req.params.id));
});

router.delete('/documents/:id', (req, res) => {
  const ok = KnowledgeService.deleteDocument(req.params.id);
  if (!ok) res.status(404).json({ code: 'NOT_FOUND', message: '文档不存在' });
  else res.json({ success: true });
});

router.get('/index/status', (req, res) => {
  const versionId = req.query.versionId as string;
  if (!versionId) {
    res.status(400).json({ code: 'MISSING_VERSION', message: '需要 versionId' });
    return;
  }
  res.json(KnowledgeService.getIndexStatus(versionId));
});

router.post('/index/rebuild', (req, res) => {
  const { versionId } = req.body as { versionId: string };
  if (!versionId) {
    res.status(400).json({ code: 'MISSING_VERSION', message: '需要 versionId' });
    return;
  }
  const result = KnowledgeService.rebuildIndex(versionId);
  if (result.ok) res.json({ success: true });
  else res.status(500).json({ code: 'REBUILD_FAILED', message: result.message });
});

export default router;
