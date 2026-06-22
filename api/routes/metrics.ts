import { Router } from 'express';
import { MetricsService } from '../services/MetricsService.js';
import type { BuiltInMetric, MetricComputeType } from '../../shared/types.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json(MetricsService.listMetrics());
});

router.get('/:id', (req, res) => {
  const m = MetricsService.getMetric(req.params.id);
  if (!m) {
    res.status(404).json({ code: 'NOT_FOUND', message: '指标不存在' });
    return;
  }
  res.json(m);
});

router.post('/', (req, res) => {
  try {
    const {
      name,
      description,
      computeType,
      builtInType,
      customScript,
      weight,
      higherIsBetter,
    } = req.body;
    const metric = MetricsService.createMetric({
      name: String(name || ''),
      description: String(description || ''),
      computeType: computeType as MetricComputeType,
      builtInType: builtInType as BuiltInMetric | undefined,
      customScript: customScript ? String(customScript) : undefined,
      weight: Number(weight) || 1,
      higherIsBetter: higherIsBetter !== false,
    });
    res.json(metric);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(400).json({ code: 'CREATE_FAILED', message: msg });
  }
});

router.put('/:id', (req, res) => {
  try {
    const updated = MetricsService.updateMetric(req.params.id, req.body);
    if (!updated) {
      res.status(404).json({ code: 'NOT_FOUND', message: '指标不存在' });
      return;
    }
    res.json(updated);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(400).json({ code: 'UPDATE_FAILED', message: msg });
  }
});

router.delete('/:id', (req, res) => {
  const success = MetricsService.deleteMetric(req.params.id);
  if (!success) {
    res.status(404).json({ code: 'NOT_FOUND', message: '指标不存在' });
    return;
  }
  res.json({ success: true });
});

router.post('/test-script', (req, res) => {
  const { script } = req.body;
  if (!script) {
    res.status(400).json({ code: 'MISSING_SCRIPT', message: '请提供脚本内容' });
    return;
  }
  const result = MetricsService.testCustomScript(String(script));
  res.json(result);
});

export default router;
