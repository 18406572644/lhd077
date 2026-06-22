import type { ScheduleConfig, ScheduleFrequency } from '../../shared/types.js';

const CRON_PARTS = 5;

function pad(n: number, len: number = 2): string {
  return n.toString().padStart(len, '0');
}

export function formatDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function cronToNextRun(cronExpression: string, from: Date = new Date()): Date | undefined {
  try {
    const parts = cronExpression.trim().split(/\s+/);
    if (parts.length !== CRON_PARTS) return undefined;

    const [minuteExpr, hourExpr, dayOfMonthExpr, monthExpr, dayOfWeekExpr] = parts;

    const parsePart = (expr: string, min: number, max: number): Set<number> => {
      const values = new Set<number>();
      const segments = expr.split(',');
      for (const seg of segments) {
        if (seg === '*') {
          for (let i = min; i <= max; i++) values.add(i);
        } else if (seg.startsWith('*/')) {
          const step = parseInt(seg.slice(2), 10);
          if (isNaN(step) || step <= 0) continue;
          for (let i = min; i <= max; i += step) values.add(i);
        } else if (seg.includes('-')) {
          const [startStr, endStr] = seg.split('-');
          const start = parseInt(startStr, 10);
          const end = parseInt(endStr, 10);
          if (isNaN(start) || isNaN(end)) continue;
          const s = Math.max(min, start);
          const e = Math.min(max, end);
          for (let i = s; i <= e; i++) values.add(i);
        } else {
          const n = parseInt(seg, 10);
          if (!isNaN(n) && n >= min && n <= max) values.add(n);
        }
      }
      return values;
    };

    const minutes = parsePart(minuteExpr, 0, 59);
    const hours = parsePart(hourExpr, 0, 23);
    const daysOfMonth = parsePart(dayOfMonthExpr, 1, 31);
    const months = parsePart(monthExpr, 1, 12);
    const daysOfWeek = parsePart(dayOfWeekExpr, 0, 6);

    if (minutes.size === 0 || hours.size === 0 || daysOfMonth.size === 0 || months.size === 0 || daysOfWeek.size === 0) {
      return undefined;
    }

    const next = new Date(from.getTime() + 60 * 1000);
    next.setSeconds(0, 0);

    const MAX_ITERATIONS = 366 * 24 * 60;
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      if (
        months.has(next.getMonth() + 1) &&
        daysOfMonth.has(next.getDate()) &&
        daysOfWeek.has(next.getDay()) &&
        hours.has(next.getHours()) &&
        minutes.has(next.getMinutes())
      ) {
        return next;
      }
      next.setMinutes(next.getMinutes() + 1);
    }

    return undefined;
  } catch {
    return undefined;
  }
}

export function scheduleToNextRun(config: ScheduleConfig, from: Date = new Date()): Date | undefined {
  const { frequency, cronExpression, timeOfDay, dayOfWeek, dayOfMonth } = config;
  const base = new Date(from);
  base.setSeconds(0, 0);

  switch (frequency as ScheduleFrequency) {
    case 'daily': {
      const [hour = 0, minute = 0] = (timeOfDay || '00:00').split(':').map(Number);
      const next = new Date(base);
      next.setHours(hour, minute, 0, 0);
      if (next.getTime() <= base.getTime()) {
        next.setDate(next.getDate() + 1);
      }
      return next;
    }
    case 'weekly': {
      const [hour = 0, minute = 0] = (timeOfDay || '00:00').split(':').map(Number);
      const targetDay = dayOfWeek ?? 1;
      const next = new Date(base);
      next.setHours(hour, minute, 0, 0);
      let diff = targetDay - next.getDay();
      if (diff < 0 || (diff === 0 && next.getTime() <= base.getTime())) {
        diff += 7;
      }
      next.setDate(next.getDate() + diff);
      return next;
    }
    case 'monthly': {
      const [hour = 0, minute = 0] = (timeOfDay || '00:00').split(':').map(Number);
      const targetDay = dayOfMonth ?? 1;
      const next = new Date(base);
      next.setDate(targetDay);
      next.setHours(hour, minute, 0, 0);
      if (next.getTime() <= base.getTime()) {
        next.setMonth(next.getMonth() + 1);
      }
      return next;
    }
    case 'cron': {
      if (!cronExpression) return undefined;
      return cronToNextRun(cronExpression, base);
    }
    default:
      return undefined;
  }
}

export function describeSchedule(config: ScheduleConfig): string {
  const { frequency, cronExpression, timeOfDay, dayOfWeek, dayOfMonth } = config;
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  switch (frequency as ScheduleFrequency) {
    case 'daily':
      return `每天 ${timeOfDay || '00:00'} 执行`;
    case 'weekly':
      return `每${weekDays[dayOfWeek ?? 1]} ${timeOfDay || '00:00'} 执行`;
    case 'monthly':
      return `每月${dayOfMonth ?? 1}日 ${timeOfDay || '00:00'} 执行`;
    case 'cron':
      return `Cron: ${cronExpression || '未配置'}`;
    default:
      return '未配置调度';
  }
}

export function validateCron(cronExpression: string): boolean {
  return cronToNextRun(cronExpression) !== undefined;
}
