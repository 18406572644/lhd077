import { LogRepo } from '../data/repositories.js';
import { runConsistencyCheck } from '../utils/consistencyChecker.js';
import { exportLogsCSV } from '../utils/exporter.js';
import type { LogLevel, LogCategory } from '../../shared/types.js';

export const LogService = {
  list(level?: LogLevel, category?: LogCategory) {
    let logs = LogRepo.list();
    if (level) logs = logs.filter((l) => l.level === level);
    if (category) logs = logs.filter((l) => l.category === category);
    return logs.sort((a, b) => b.timestamp - a.timestamp);
  },

  add(
    level: LogLevel,
    category: LogCategory,
    message: string,
    details?: Record<string, unknown>,
    affectedScope?: string,
    recoverable?: boolean,
  ) {
    return LogRepo.create({ level, category, message, details, affectedScope, recoverable });
  },

  consistencyCheck() {
    const report = runConsistencyCheck();
    LogRepo.create({
      level: report.summary.failed === 0 ? 'info' : 'warn',
      category: 'system',
      message: `一致性校验完成：${report.summary.passed}/${report.summary.totalChecks} 通过`,
      affectedScope: '全局数据',
    });
    return report;
  },

  exportLogsCSV(level?: LogLevel, category?: LogCategory) {
    const logs = this.list(level, category).map((l) => ({
      timestamp: l.timestamp,
      level: l.level,
      category: l.category,
      message: l.message,
    }));
    return exportLogsCSV(logs);
  },
};
