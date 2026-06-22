import {
  ScheduledTaskRepo,
  ScheduledExecutionRepo,
  ScheduledAlertRepo,
  LogRepo,
} from '../data/repositories.js';
import { EvaluationService } from './EvaluationService.js';
import { NotificationService } from './NotificationService.js';
import { scheduleToNextRun, describeSchedule, validateCron } from './SchedulerService.js';
import type {
  ScheduledEvaluationTask,
  ScheduledExecutionRecord,
  ScheduledAlert,
  AlertThresholdConfig,
  ScheduleConfig,
  NotificationConfig,
  TestCase,
  RetrievalParams,
  ModelConfig,
  EvaluationMetrics,
  TrendReport,
  TrendDataPoint,
} from '../../shared/types.js';

function checkThresholds(
  metrics: EvaluationMetrics,
  thresholds: AlertThresholdConfig,
): ScheduledAlert[] {
  const alerts: ScheduledAlert[] = [];
  const pending = (): Omit<ScheduledAlert, 'id' | 'triggeredAt' | 'acknowledged'>[] => [];

  if (
    thresholds.accuracyThreshold !== undefined &&
    metrics.accuracy < thresholds.accuracyThreshold
  ) {
    alerts.push({
      scheduledTaskId: '',
      executionId: '',
      severity: metrics.accuracy < thresholds.accuracyThreshold * 0.8 ? 'critical' : 'warning',
      type: 'threshold_breached',
      message: `准确率 ${(metrics.accuracy * 100).toFixed(1)}% 低于阈值 ${(thresholds.accuracyThreshold * 100).toFixed(1)}%`,
      metricName: '准确率',
      expectedValue: thresholds.accuracyThreshold,
      actualValue: metrics.accuracy,
    } as unknown as ScheduledAlert);
  }

  if (
    thresholds.wrongRateThreshold !== undefined &&
    metrics.wrongRate > thresholds.wrongRateThreshold
  ) {
    alerts.push({
      scheduledTaskId: '',
      executionId: '',
      severity: metrics.wrongRate > thresholds.wrongRateThreshold * 1.2 ? 'critical' : 'warning',
      type: 'threshold_breached',
      message: `错误率 ${(metrics.wrongRate * 100).toFixed(1)}% 超过阈值 ${(thresholds.wrongRateThreshold * 100).toFixed(1)}%`,
      metricName: '错误率',
      expectedValue: thresholds.wrongRateThreshold,
      actualValue: metrics.wrongRate,
    } as unknown as ScheduledAlert);
  }

  if (
    thresholds.weightedScoreThreshold !== undefined &&
    metrics.weightedTotalScore !== undefined &&
    metrics.weightedTotalScore < thresholds.weightedScoreThreshold
  ) {
    alerts.push({
      scheduledTaskId: '',
      executionId: '',
      severity:
        metrics.weightedTotalScore < thresholds.weightedScoreThreshold * 0.8
          ? 'critical'
          : 'warning',
      type: 'threshold_breached',
      message: `加权总分 ${(metrics.weightedTotalScore * 100).toFixed(1)}% 低于阈值 ${(thresholds.weightedScoreThreshold * 100).toFixed(1)}%`,
      metricName: '加权总分',
      expectedValue: thresholds.weightedScoreThreshold,
      actualValue: metrics.weightedTotalScore,
    } as unknown as ScheduledAlert);
  }

  void pending;
  return alerts;
}

export const ScheduledEvaluationService = {
  listTasks(): ScheduledEvaluationTask[] {
    return ScheduledTaskRepo.list().sort((a, b) => b.createdAt - a.createdAt);
  },

  getTask(id: string): ScheduledEvaluationTask | undefined {
    return ScheduledTaskRepo.getById(id);
  },

  createTask(params: {
    name: string;
    description?: string;
    baseEvaluationTaskId?: string;
    testSet: TestCase[];
    versionId: string;
    retrievalParams: Partial<RetrievalParams>;
    modelConfig?: ModelConfig;
    metricIds?: string[];
    schedule: ScheduleConfig;
    notification: NotificationConfig;
    alertThresholds: AlertThresholdConfig;
  }): ScheduledEvaluationTask {
    if (params.schedule.frequency === 'cron' && params.schedule.cronExpression) {
      if (!validateCron(params.schedule.cronExpression)) {
        throw new Error('Cron 表达式格式无效');
      }
    }

    const validation = NotificationService.validateConfig(params.notification);
    if (params.notification.enabled && !validation.valid) {
      throw new Error(`通知配置无效: ${validation.errors.join(', ')}`);
    }

    const task = ScheduledTaskRepo.create({
      name: params.name,
      description: params.description,
      baseEvaluationTaskId: params.baseEvaluationTaskId,
      testSet: params.testSet,
      versionId: params.versionId,
      retrievalParams: {
        topK: params.retrievalParams.topK ?? 5,
        minScore: params.retrievalParams.minScore ?? 0.1,
        chunkSize: params.retrievalParams.chunkSize ?? 300,
        chunkOverlap: params.retrievalParams.chunkOverlap ?? 50,
        useBM25: params.retrievalParams.useBM25 ?? true,
      },
      modelConfig: params.modelConfig,
      metricIds: params.metricIds ?? [],
      schedule: params.schedule,
      notification: params.notification,
      alertThresholds: params.alertThresholds,
    });

    const nextRun = scheduleToNextRun(task.schedule);
    if (nextRun) {
      ScheduledTaskRepo.update(task.id, { nextRunAt: nextRun.getTime() });
    }

    LogRepo.create({
      level: 'info',
      category: 'evaluation',
      message: `创建定时评测任务：${params.name}`,
      details: { schedule: describeSchedule(task.schedule) },
      affectedScope: `定时任务 ${task.id}`,
    });

    return ScheduledTaskRepo.getById(task.id)!;
  },

  updateTask(
    id: string,
    patch: Partial<{
      name: string;
      description: string;
      schedule: ScheduleConfig;
      notification: NotificationConfig;
      alertThresholds: AlertThresholdConfig;
      status: ScheduledEvaluationTask['status'];
    }>,
  ): ScheduledEvaluationTask | undefined {
    const existing = ScheduledTaskRepo.getById(id);
    if (!existing) return undefined;

    if (patch.schedule) {
      if (patch.schedule.frequency === 'cron' && patch.schedule.cronExpression) {
        if (!validateCron(patch.schedule.cronExpression)) {
          throw new Error('Cron 表达式格式无效');
        }
      }
    }

    if (patch.notification) {
      const validation = NotificationService.validateConfig(patch.notification);
      if (patch.notification.enabled && !validation.valid) {
        throw new Error(`通知配置无效: ${validation.errors.join(', ')}`);
      }
    }

    const updated = ScheduledTaskRepo.update(id, patch);
    if (updated && patch.schedule) {
      const nextRun = scheduleToNextRun(updated.schedule);
      ScheduledTaskRepo.update(id, { nextRunAt: nextRun?.getTime() });
    }

    return ScheduledTaskRepo.getById(id);
  },

  deleteTask(id: string): boolean {
    const task = ScheduledTaskRepo.getById(id);
    if (!task) return false;
    const success = ScheduledTaskRepo.delete(id);
    if (success) {
      LogRepo.create({
        level: 'info',
        category: 'evaluation',
        message: `删除定时评测任务：${task.name}`,
        affectedScope: `定时任务 ${id}`,
      });
    }
    return success;
  },

  pauseTask(id: string): ScheduledEvaluationTask | undefined {
    const updated = ScheduledTaskRepo.update(id, { status: 'paused', nextRunAt: undefined });
    if (updated) {
      LogRepo.create({
        level: 'info',
        category: 'evaluation',
        message: `暂停定时评测任务：${updated.name}`,
        affectedScope: `定时任务 ${id}`,
      });
    }
    return updated;
  },

  resumeTask(id: string): ScheduledEvaluationTask | undefined {
    const task = ScheduledTaskRepo.getById(id);
    if (!task) return undefined;
    const nextRun = scheduleToNextRun(task.schedule);
    const updated = ScheduledTaskRepo.update(id, {
      status: 'active',
      nextRunAt: nextRun?.getTime(),
    });
    if (updated) {
      LogRepo.create({
        level: 'info',
        category: 'evaluation',
        message: `恢复定时评测任务：${updated.name}`,
        affectedScope: `定时任务 ${id}`,
      });
    }
    return updated;
  },

  async executeTask(id: string): Promise<ScheduledExecutionRecord | undefined> {
    const task = ScheduledTaskRepo.getById(id);
    if (!task) return undefined;

    const triggeredAt = Date.now();

    const evalTask = EvaluationService.createTask(
      `${task.name} - ${new Date(triggeredAt).toLocaleString('zh-CN')}`,
      task.testSet,
      task.versionId,
      task.retrievalParams,
      task.modelConfig,
      task.metricIds,
    );

    const execution = ScheduledExecutionRepo.create({
      scheduledTaskId: task.id,
      evaluationTaskId: evalTask.id,
      triggeredAt,
      startedAt: triggeredAt,
      status: 'running',
    });

    try {
      const runResult = await EvaluationService.runTask(evalTask.id);
      if (!runResult) {
        throw new Error('评测任务执行失败');
      }

      const metrics = runResult.metrics;
      const finishedAt = Date.now();

      ScheduledExecutionRepo.update(execution.id, {
        status: 'done',
        finishedAt,
        metrics,
      });

      const triggeredAlerts: ScheduledAlert[] = [];
      if (metrics) {
        const thresholdAlerts = checkThresholds(metrics, task.alertThresholds);
        for (const alert of thresholdAlerts) {
          const created = ScheduledAlertRepo.create({
            ...alert,
            scheduledTaskId: task.id,
            executionId: execution.id,
          });
          triggeredAlerts.push(created);
        }

        if (triggeredAlerts.length > 0) {
          const newCount = task.consecutiveAlertCount + 1;
          ScheduledTaskRepo.update(task.id, { consecutiveAlertCount: newCount });

          if (
            task.alertThresholds.consecutiveFailures !== undefined &&
            newCount >= task.alertThresholds.consecutiveFailures
          ) {
            const consecutiveAlert = ScheduledAlertRepo.create({
              scheduledTaskId: task.id,
              executionId: execution.id,
              severity: 'critical',
              type: 'consecutive_failures',
              message: `连续 ${newCount} 次触发告警阈值，已达 ${task.alertThresholds.consecutiveFailures} 次阈值`,
            });
            triggeredAlerts.push(consecutiveAlert);
          }
        } else {
          ScheduledTaskRepo.update(task.id, { consecutiveAlertCount: 0 });
        }
      }

      ScheduledTaskRepo.update(task.id, {
        lastRunAt: finishedAt,
        lastRunResultId: evalTask.id,
        lastRunMetrics: metrics,
        nextRunAt: scheduleToNextRun(task.schedule, new Date(finishedAt))?.getTime(),
      });

      if (metrics) {
        if (triggeredAlerts.length > 0) {
          ScheduledExecutionRepo.update(execution.id, { alerts: triggeredAlerts });
          await NotificationService.sendAlerts(task, triggeredAlerts, execution.id);
        } else {
          await NotificationService.sendEvaluationComplete(task, metrics, execution.id);
        }
      }

      LogRepo.create({
        level: 'info',
        category: 'evaluation',
        message: `定时评测任务执行完成：${task.name}`,
        details: {
          accuracy: metrics?.accuracy,
          alertsCount: triggeredAlerts.length,
        },
        affectedScope: `定时任务 ${task.id}`,
      });
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      ScheduledExecutionRepo.update(execution.id, {
        status: 'failed',
        finishedAt: Date.now(),
        errorMessage: errorMsg,
      });

      const alert = ScheduledAlertRepo.create({
        scheduledTaskId: task.id,
        executionId: execution.id,
        severity: 'critical',
        type: 'execution_failed',
        message: `定时评测任务执行失败: ${errorMsg}`,
      });
      ScheduledExecutionRepo.update(execution.id, { alerts: [alert] });

      await NotificationService.sendEvaluationFailed(task, errorMsg, execution.id);

      LogRepo.create({
        level: 'error',
        category: 'evaluation',
        message: `定时评测任务执行失败：${task.name} - ${errorMsg}`,
        affectedScope: `定时任务 ${task.id}`,
        recoverable: true,
      });
    }

    return ScheduledExecutionRepo.getById(execution.id);
  },

  listExecutions(scheduledTaskId: string): ScheduledExecutionRecord[] {
    return ScheduledExecutionRepo.listByScheduledTask(scheduledTaskId);
  },

  listAlerts(scheduledTaskId?: string, onlyUnacknowledged: boolean = false): ScheduledAlert[] {
    if (onlyUnacknowledged) {
      const alerts = ScheduledAlertRepo.listUnacknowledged();
      if (scheduledTaskId) {
        return alerts.filter((a) => a.scheduledTaskId === scheduledTaskId);
      }
      return alerts;
    }
    if (scheduledTaskId) {
      return ScheduledAlertRepo.listByScheduledTask(scheduledTaskId);
    }
    return ScheduledAlertRepo.list().sort((a, b) => b.triggeredAt - a.triggeredAt);
  },

  acknowledgeAlert(id: string): ScheduledAlert | undefined {
    return ScheduledAlertRepo.acknowledge(id);
  },

  acknowledgeAllAlerts(scheduledTaskId: string): number {
    return ScheduledAlertRepo.acknowledgeByTask(scheduledTaskId);
  },

  getTrendReport(scheduledTaskId: string, days: number = 30): TrendReport | undefined {
    const task = ScheduledTaskRepo.getById(scheduledTaskId);
    if (!task) return undefined;

    const now = Date.now();
    const startDate = now - days * 24 * 60 * 60 * 1000;

    const executions = ScheduledExecutionRepo.listByScheduledTask(scheduledTaskId).filter(
      (e) => e.status === 'done' && e.metrics && e.triggeredAt >= startDate,
    );

    const dataPoints: TrendDataPoint[] = executions.map((e) => ({
      timestamp: e.triggeredAt,
      date: new Date(e.triggeredAt).toLocaleDateString('zh-CN'),
      taskId: e.evaluationTaskId,
      taskName: task.name,
      metrics: e.metrics!,
    }));

    const alerts = ScheduledAlertRepo.listByScheduledTask(scheduledTaskId).filter(
      (a) => a.triggeredAt >= startDate,
    );

    const accuracyValues = dataPoints
      .map((d) => d.metrics.accuracy)
      .filter((v) => v !== undefined && !isNaN(v));

    const avgAccuracy =
      accuracyValues.length > 0
        ? accuracyValues.reduce((sum, v) => sum + v, 0) / accuracyValues.length
        : 0;
    const minAccuracy = accuracyValues.length > 0 ? Math.min(...accuracyValues) : 0;
    const maxAccuracy = accuracyValues.length > 0 ? Math.max(...accuracyValues) : 0;

    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (dataPoints.length >= 3) {
      const recent = accuracyValues.slice(-3);
      const earlier = accuracyValues.slice(0, 3);
      const recentAvg = recent.reduce((s, v) => s + v, 0) / recent.length;
      const earlierAvg = earlier.reduce((s, v) => s + v, 0) / earlier.length;
      const diff = recentAvg - earlierAvg;
      if (Math.abs(diff) >= 0.02) {
        trend = diff > 0 ? 'improving' : 'declining';
      }
    }

    return {
      scheduledTaskId,
      scheduledTaskName: task.name,
      dataPoints,
      startDate,
      endDate: now,
      overallStats: {
        avgAccuracy,
        minAccuracy,
        maxAccuracy,
        trend,
        totalRuns: dataPoints.length,
        alertCount: alerts.length,
      },
    };
  },

  tick(): void {
    const now = Date.now();
    const activeTasks = ScheduledTaskRepo.listActive();

    for (const task of activeTasks) {
      if (task.nextRunAt && now >= task.nextRunAt) {
        void this.executeTask(task.id);
      } else if (!task.nextRunAt) {
        const nextRun = scheduleToNextRun(task.schedule);
        if (nextRun) {
          ScheduledTaskRepo.update(task.id, { nextRunAt: nextRun.getTime() });
        }
      }
    }
  },
};
