import { Router } from 'express';
import { ScheduledEvaluationService } from '../services/ScheduledEvaluationService.js';
import { describeSchedule, validateCron } from '../services/SchedulerService.js';
import { NotificationService } from '../services/NotificationService.js';
import { parseTestCases } from '../utils/documentParser.js';
import multer from 'multer';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/tasks', (_req, res) => {
  const tasks = ScheduledEvaluationService.listTasks();
  res.json(tasks.map((t) => ({ ...t, scheduleDescription: describeSchedule(t.schedule) })));
});

router.get('/tasks/:id', (req, res) => {
  const task = ScheduledEvaluationService.getTask(req.params.id);
  if (!task) {
    res.status(404).json({ code: 'NOT_FOUND', message: '定时任务不存在' });
    return;
  }
  res.json({ ...task, scheduleDescription: describeSchedule(task.schedule) });
});

router.post('/tasks', upload.single('testSet'), async (req, res) => {
  try {
    const name = (req.body.name as string)?.trim();
    if (!name) {
      res.status(400).json({ code: 'INVALID_NAME', message: '任务名称不能为空' });
      return;
    }

    const versionId = req.body.versionId as string;
    if (!versionId) {
      res.status(400).json({ code: 'MISSING_VERSION', message: '需要选择知识库版本' });
      return;
    }

    let testSet;
    if (req.file) {
      const content = req.file.buffer.toString('utf-8');
      testSet = parseTestCases(content);
    } else if (req.body.testSet) {
      testSet = typeof req.body.testSet === 'string' ? JSON.parse(req.body.testSet) : req.body.testSet;
    }

    if (!testSet || !Array.isArray(testSet) || testSet.length === 0) {
      res.status(400).json({ code: 'INVALID_TESTSET', message: '测试集格式错误或为空' });
      return;
    }

    const retrievalParams = req.body.retrievalParams
      ? JSON.parse(req.body.retrievalParams as string)
      : undefined;
    const modelConfig = req.body.modelConfig
      ? JSON.parse(req.body.modelConfig as string)
      : undefined;
    const schedule = req.body.schedule
      ? typeof req.body.schedule === 'string'
        ? JSON.parse(req.body.schedule)
        : req.body.schedule
      : undefined;
    const notification = req.body.notification
      ? typeof req.body.notification === 'string'
        ? JSON.parse(req.body.notification)
        : req.body.notification
      : undefined;
    const alertThresholds = req.body.alertThresholds
      ? typeof req.body.alertThresholds === 'string'
        ? JSON.parse(req.body.alertThresholds)
        : req.body.alertThresholds
      : undefined;
    const metricIds = req.body.metricIds
      ? typeof req.body.metricIds === 'string'
        ? JSON.parse(req.body.metricIds)
        : req.body.metricIds
      : undefined;

    if (!schedule) {
      res.status(400).json({ code: 'MISSING_SCHEDULE', message: '需要配置调度频率' });
      return;
    }

    const task = ScheduledEvaluationService.createTask({
      name,
      description: req.body.description as string | undefined,
      baseEvaluationTaskId: req.body.baseEvaluationTaskId as string | undefined,
      testSet,
      versionId,
      retrievalParams,
      modelConfig,
      metricIds,
      schedule,
      notification: notification ?? { enabled: false, types: [] },
      alertThresholds: alertThresholds ?? {},
    });

    res.json({ ...task, scheduleDescription: describeSchedule(task.schedule) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ code: 'CREATE_FAILED', message: msg });
  }
});

router.put('/tasks/:id', (req, res) => {
  try {
    const updated = ScheduledEvaluationService.updateTask(req.params.id, req.body);
    if (!updated) {
      res.status(404).json({ code: 'NOT_FOUND', message: '定时任务不存在' });
      return;
    }
    res.json({ ...updated, scheduleDescription: describeSchedule(updated.schedule) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(400).json({ code: 'UPDATE_FAILED', message: msg });
  }
});

router.delete('/tasks/:id', (req, res) => {
  const success = ScheduledEvaluationService.deleteTask(req.params.id);
  if (!success) {
    res.status(404).json({ code: 'NOT_FOUND', message: '定时任务不存在' });
    return;
  }
  res.json({ success: true });
});

router.post('/tasks/:id/pause', (req, res) => {
  const task = ScheduledEvaluationService.pauseTask(req.params.id);
  if (!task) {
    res.status(404).json({ code: 'NOT_FOUND', message: '定时任务不存在' });
    return;
  }
  res.json({ ...task, scheduleDescription: describeSchedule(task.schedule) });
});

router.post('/tasks/:id/resume', (req, res) => {
  const task = ScheduledEvaluationService.resumeTask(req.params.id);
  if (!task) {
    res.status(404).json({ code: 'NOT_FOUND', message: '定时任务不存在' });
    return;
  }
  res.json({ ...task, scheduleDescription: describeSchedule(task.schedule) });
});

router.post('/tasks/:id/run', async (req, res) => {
  try {
    const execution = await ScheduledEvaluationService.executeTask(req.params.id);
    if (!execution) {
      res.status(404).json({ code: 'NOT_FOUND', message: '定时任务不存在' });
      return;
    }
    res.json(execution);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ code: 'RUN_FAILED', message: msg });
  }
});

router.get('/tasks/:id/executions', (req, res) => {
  const executions = ScheduledEvaluationService.listExecutions(req.params.id);
  res.json(executions);
});

router.get('/tasks/:id/trend', (req, res) => {
  const days = parseInt(req.query.days as string, 10) || 30;
  const report = ScheduledEvaluationService.getTrendReport(req.params.id, days);
  if (!report) {
    res.status(404).json({ code: 'NOT_FOUND', message: '定时任务不存在' });
    return;
  }
  res.json(report);
});

router.get('/alerts', (req, res) => {
  const scheduledTaskId = req.query.scheduledTaskId as string | undefined;
  const onlyUnacknowledged = req.query.onlyUnacknowledged === 'true';
  const alerts = ScheduledEvaluationService.listAlerts(scheduledTaskId, onlyUnacknowledged);
  res.json(alerts);
});

router.post('/alerts/:id/acknowledge', (req, res) => {
  const alert = ScheduledEvaluationService.acknowledgeAlert(req.params.id);
  if (!alert) {
    res.status(404).json({ code: 'NOT_FOUND', message: '告警不存在' });
    return;
  }
  res.json(alert);
});

router.post('/tasks/:id/alerts/acknowledge-all', (req, res) => {
  const count = ScheduledEvaluationService.acknowledgeAllAlerts(req.params.id);
  res.json({ success: true, acknowledged: count });
});

router.post('/validate-cron', (req, res) => {
  const { cronExpression } = req.body as { cronExpression?: string };
  if (!cronExpression) {
    res.status(400).json({ valid: false, message: '请输入 Cron 表达式' });
    return;
  }
  const valid = validateCron(cronExpression);
  res.json({ valid, message: valid ? 'Cron 表达式有效' : 'Cron 表达式无效' });
});

router.post('/validate-notification', (req, res) => {
  const result = NotificationService.validateConfig(req.body);
  res.json(result);
});

router.get('/tasks/:id/notifications', (req, res) => {
  const notifications = NotificationService.listByTask(req.params.id);
  res.json(notifications);
});

export default router;
