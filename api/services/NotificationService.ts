import { NotificationRepo, LogRepo } from '../data/repositories.js';
import type {
  NotificationType,
  NotificationConfig,
  NotificationMessage,
  ScheduledEvaluationTask,
  EvaluationMetrics,
  ScheduledAlert,
} from '../../shared/types.js';

export const NotificationService = {
  async sendNotification(
    type: NotificationType,
    subject: string,
    body: string,
    options?: {
      scheduledTaskId?: string;
      executionId?: string;
      emailAddresses?: string[];
    },
  ): Promise<NotificationMessage> {
    let success = true;
    let errorMessage: string | undefined;

    try {
      if (type === 'desktop') {
        LogRepo.create({
          level: 'info',
          category: 'system',
          message: `[桌面通知] ${subject}`,
          details: { body },
          affectedScope: options?.scheduledTaskId ? `定时任务 ${options.scheduledTaskId}` : undefined,
        });
      } else if (type === 'email') {
        LogRepo.create({
          level: 'info',
          category: 'system',
          message: `[邮件通知] ${subject}`,
          details: { body, recipients: options?.emailAddresses || [] },
          affectedScope: options?.scheduledTaskId ? `定时任务 ${options.scheduledTaskId}` : undefined,
        });
      }
    } catch (e) {
      success = false;
      errorMessage = e instanceof Error ? e.message : String(e);
    }

    const record = NotificationRepo.create({
      type,
      subject,
      body,
      scheduledTaskId: options?.scheduledTaskId,
      executionId: options?.executionId,
      success,
      errorMessage,
    });

    return record;
  },

  async sendEvaluationComplete(
    task: ScheduledEvaluationTask,
    metrics: EvaluationMetrics,
    executionId: string,
  ): Promise<void> {
    if (!task.notification.enabled) return;
    if (!task.notification.onSuccess) return;

    const subject = `[评测完成] ${task.name}`;
    const body = [
      `定时评测任务 "${task.name}" 已完成。`,
      ``,
      `评测结果：`,
      `  - 准确率: ${(metrics.accuracy * 100).toFixed(1)}%`,
      `  - 部分正确率: ${(metrics.partialRate * 100).toFixed(1)}%`,
      `  - 错误率: ${(metrics.wrongRate * 100).toFixed(1)}%`,
      `  - 平均置信度: ${(metrics.avgConfidence * 100).toFixed(1)}%`,
      metrics.weightedTotalScore !== undefined
        ? `  - 加权总分: ${(metrics.weightedTotalScore * 100).toFixed(1)}%`
        : '',
      ``,
      `执行时间: ${new Date().toLocaleString('zh-CN')}`,
    ]
      .filter(Boolean)
      .join('\n');

    for (const type of task.notification.types) {
      await this.sendNotification(type, subject, body, {
        scheduledTaskId: task.id,
        executionId,
        emailAddresses: task.notification.emailAddresses,
      });
    }
  },

  async sendEvaluationFailed(
    task: ScheduledEvaluationTask,
    error: string,
    executionId: string,
  ): Promise<void> {
    if (!task.notification.enabled) return;
    if (!task.notification.onFailure) return;

    const subject = `[评测失败] ${task.name}`;
    const body = [
      `定时评测任务 "${task.name}" 执行失败。`,
      ``,
      `错误信息: ${error}`,
      ``,
      `时间: ${new Date().toLocaleString('zh-CN')}`,
    ].join('\n');

    for (const type of task.notification.types) {
      await this.sendNotification(type, subject, body, {
        scheduledTaskId: task.id,
        executionId,
        emailAddresses: task.notification.emailAddresses,
      });
    }
  },

  async sendAlerts(
    task: ScheduledEvaluationTask,
    alerts: ScheduledAlert[],
    executionId: string,
  ): Promise<void> {
    if (!task.notification.enabled) return;
    if (!task.notification.onAlert || alerts.length === 0) return;

    const criticalCount = alerts.filter((a) => a.severity === 'critical').length;
    const warningCount = alerts.filter((a) => a.severity === 'warning').length;

    const subject = `[告警] ${task.name} - ${criticalCount > 0 ? '严重' : '警告'}`;
    const bodyLines = [
      `定时评测任务 "${task.name}" 触发告警。`,
      ``,
      `告警统计:`,
      `  - 严重告警: ${criticalCount}`,
      `  - 警告: ${warningCount}`,
      ``,
      `告警详情:`,
    ];

    for (const alert of alerts.slice(0, 10)) {
      const severityLabel = alert.severity === 'critical' ? '严重' : '警告';
      bodyLines.push(`  [${severityLabel}] ${alert.message}`);
      if (alert.metricName && alert.expectedValue !== undefined && alert.actualValue !== undefined) {
        bodyLines.push(
          `    ${alert.metricName}: 阈值 ${(alert.expectedValue * 100).toFixed(1)}%, 实际 ${(alert.actualValue * 100).toFixed(1)}%`,
        );
      }
    }

    if (alerts.length > 10) {
      bodyLines.push(`  ... (还有 ${alerts.length - 10} 条告警)`);
    }

    bodyLines.push('', `时间: ${new Date().toLocaleString('zh-CN')}`);

    const body = bodyLines.join('\n');

    for (const type of task.notification.types) {
      await this.sendNotification(type, subject, body, {
        scheduledTaskId: task.id,
        executionId,
        emailAddresses: task.notification.emailAddresses,
      });
    }
  },

  listByTask(scheduledTaskId: string): NotificationMessage[] {
    return NotificationRepo.listByScheduledTask(scheduledTaskId);
  },

  validateConfig(config: NotificationConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!config.types || config.types.length === 0) {
      errors.push('请至少选择一种通知方式');
    }
    if (config.types.includes('email')) {
      if (!config.emailAddresses || config.emailAddresses.length === 0) {
        errors.push('邮件通知需要配置收件邮箱');
      } else {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        for (const email of config.emailAddresses) {
          if (!emailRegex.test(email)) {
            errors.push(`无效的邮箱地址: ${email}`);
          }
        }
      }
    }
    return { valid: errors.length === 0, errors };
  },
};
