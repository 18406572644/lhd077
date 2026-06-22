import { useEffect, useRef, useState, useCallback } from "react";
import {
  Plus,
  Play,
  Pause,
  Trash2,
  XCircle,
  Clock,
  Calendar,
  CalendarDays,
  CalendarRange,
  TimerReset,
  Bell,
  Mail,
  Monitor,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  History,
  TrendingUp,
  Gauge,
  Settings,
  Info,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";
import PageHeader from "@/components/PageHeader";
import VersionSelector from "@/components/VersionSelector";
import type {
  ScheduledEvaluationTask,
  ScheduledExecutionRecord,
  ScheduledAlert,
  TestCase,
  Metric,
  ScheduleFrequency,
  ScheduleConfig,
  NotificationConfig,
  AlertThresholdConfig,
  NotificationType,
} from "../../shared/types";
import { useNavigate } from "react-router-dom";

const frequencyOptions: { value: ScheduleFrequency; label: string; icon: typeof Clock }[] = [
  { value: "daily", label: "每日", icon: Clock },
  { value: "weekly", label: "每周", icon: CalendarDays },
  { value: "monthly", label: "每月", icon: CalendarRange },
  { value: "cron", label: "自定义 Cron", icon: TimerReset },
];

const weekDays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

export default function ScheduledEvaluation() {
  const navigate = useNavigate();
  const { selectedVersionId, retrievalParams, setVersions, showToast } =
    useAppStore();
  const [tasks, setTasks] = useState<ScheduledEvaluationTask[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTask, setSelectedTask] = useState<ScheduledEvaluationTask | null>(null);
  const [executions, setExecutions] = useState<ScheduledExecutionRecord[]>([]);
  const [alerts, setAlerts] = useState<ScheduledAlert[]>([]);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [expandedExecutionId, setExpandedExecutionId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [taskName, setTaskName] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [testSetText, setTestSetText] = useState(
    '[\n  {"question": "如何重置密码？", "standardAnswer": "点击登录页的忘记密码，通过邮箱验证重置"},\n  {"question": "支持哪些支付方式？", "standardAnswer": "支持支付宝、微信支付和银行卡"}\n]',
  );
  const [testSetFile, setTestSetFile] = useState<File | null>(null);
  const [selectedMetricIds, setSelectedMetricIds] = useState<string[]>([]);

  const [frequency, setFrequency] = useState<ScheduleFrequency>("daily");
  const [timeOfDay, setTimeOfDay] = useState("02:00");
  const [dayOfWeek, setDayOfWeek] = useState<number>(1);
  const [dayOfMonth, setDayOfMonth] = useState<number>(1);
  const [cronExpression, setCronExpression] = useState("0 2 * * *");
  const [cronValid, setCronValid] = useState<boolean | null>(null);

  const [notifyEnabled, setNotifyEnabled] = useState(true);
  const [notifyTypes, setNotifyTypes] = useState<NotificationType[]>(["desktop"]);
  const [emailAddresses, setEmailAddresses] = useState("");
  const [notifyOnSuccess, setNotifyOnSuccess] = useState(true);
  const [notifyOnFailure, setNotifyOnFailure] = useState(true);
  const [notifyOnAlert, setNotifyOnAlert] = useState(true);

  const [accuracyThreshold, setAccuracyThreshold] = useState(0.8);
  const [wrongRateThreshold, setWrongRateThreshold] = useState(0.3);
  const [weightedScoreThreshold, setWeightedScoreThreshold] = useState<number | undefined>();
  const [consecutiveFailures, setConsecutiveFailures] = useState<number>(3);

  useEffect(() => {
    api.knowledge.listVersions().then(setVersions);
    loadTasks();
    loadMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setVersions]);

  useEffect(() => {
    if (frequency === "cron" && cronExpression) {
      const timer = setTimeout(async () => {
        try {
          const result = await api.scheduledEvaluation.validateCron(cronExpression);
          setCronValid(result.valid);
        } catch {
          setCronValid(false);
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [frequency, cronExpression]);

  const loadTasks = useCallback(async () => {
    try {
      const list = await api.scheduledEvaluation.listTasks();
      setTasks(list);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "加载失败", "error");
    }
  }, [showToast]);

  const loadMetrics = async () => {
    try {
      const list = await api.metrics.list();
      setMetrics(list);
    } catch {
      // ignore
    }
  };

  const handleSelectTask = useCallback(
    async (task: ScheduledEvaluationTask) => {
      setSelectedTask(task);
      try {
        const [execs, taskAlerts] = await Promise.all([
          api.scheduledEvaluation.listExecutions(task.id),
          api.scheduledEvaluation.listAlerts({ scheduledTaskId: task.id }),
        ]);
        setExecutions(execs);
        setAlerts(taskAlerts);
      } catch (e) {
        showToast(e instanceof Error ? e.message : "加载详情失败", "error");
      }
    },
    [showToast],
  );

  const handleCreate = async () => {
    if (!selectedVersionId) {
      showToast("请选择知识库版本", "error");
      return;
    }
    if (!taskName.trim()) {
      showToast("请输入任务名称", "error");
      return;
    }

    let testSet: TestCase[] = [];
    if (!testSetFile) {
      try {
        testSet = JSON.parse(testSetText);
      } catch {
        showToast("测试集 JSON 格式错误", "error");
        return;
      }
    }
    if (!testSetFile && (!Array.isArray(testSet) || testSet.length === 0)) {
      showToast("请提供有效的测试集", "error");
      return;
    }

    const schedule: ScheduleConfig = {
      frequency,
    };
    if (frequency === "daily" || frequency === "weekly" || frequency === "monthly") {
      schedule.timeOfDay = timeOfDay;
    }
    if (frequency === "weekly") {
      schedule.dayOfWeek = dayOfWeek;
    }
    if (frequency === "monthly") {
      schedule.dayOfMonth = dayOfMonth;
    }
    if (frequency === "cron") {
      schedule.cronExpression = cronExpression;
      if (!cronValid) {
        showToast("Cron 表达式无效", "error");
        return;
      }
    }

    const notification: NotificationConfig = {
      enabled: notifyEnabled,
      types: notifyTypes,
      emailAddresses: notifyTypes.includes("email")
        ? emailAddresses.split(",").map((e) => e.trim()).filter(Boolean)
        : undefined,
      onSuccess: notifyOnSuccess,
      onFailure: notifyOnFailure,
      onAlert: notifyOnAlert,
    };

    const alertThresholds: AlertThresholdConfig = {
      accuracyThreshold,
      wrongRateThreshold,
      weightedScoreThreshold,
      consecutiveFailures,
    };

    try {
      await api.scheduledEvaluation.createTask({
        name: taskName,
        description: taskDescription || undefined,
        testSet,
        testSetFile: testSetFile || undefined,
        versionId: selectedVersionId,
        retrievalParams,
        metricIds: selectedMetricIds,
        schedule,
        notification,
        alertThresholds,
      });
      showToast("定时评测任务已创建", "success");
      setShowCreate(false);
      resetForm();
      loadTasks();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "创建失败", "error");
    }
  };

  const resetForm = () => {
    setTaskName("");
    setTaskDescription("");
    setTestSetFile(null);
    setSelectedMetricIds([]);
    setFrequency("daily");
    setTimeOfDay("02:00");
    setDayOfWeek(1);
    setDayOfMonth(1);
    setCronExpression("0 2 * * *");
    setNotifyEnabled(true);
    setNotifyTypes(["desktop"]);
    setEmailAddresses("");
    setNotifyOnSuccess(true);
    setNotifyOnFailure(true);
    setNotifyOnAlert(true);
    setAccuracyThreshold(0.8);
    setWrongRateThreshold(0.3);
    setWeightedScoreThreshold(undefined);
    setConsecutiveFailures(3);
  };

  const handlePauseResume = async (task: ScheduledEvaluationTask) => {
    try {
      let updatedTask: ScheduledEvaluationTask | undefined;
      if (task.status === "active") {
        updatedTask = await api.scheduledEvaluation.pauseTask(task.id);
        showToast("已暂停任务", "success");
      } else {
        updatedTask = await api.scheduledEvaluation.resumeTask(task.id);
        showToast("已恢复任务", "success");
      }
      loadTasks();
      if (updatedTask && selectedTask?.id === task.id) {
        handleSelectTask(updatedTask);
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "操作失败", "error");
    }
  };

  const handleRunNow = async (id: string) => {
    setRunningId(id);
    try {
      await api.scheduledEvaluation.runTaskNow(id);
      showToast("已触发立即执行", "success");
      loadTasks();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "执行失败", "error");
    } finally {
      setRunningId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这个定时评测任务吗？")) return;
    try {
      await api.scheduledEvaluation.deleteTask(id);
      showToast("已删除", "success");
      loadTasks();
      if (selectedTask?.id === id) {
        setSelectedTask(null);
        setExecutions([]);
        setAlerts([]);
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "删除失败", "error");
    }
  };

  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      await api.scheduledEvaluation.acknowledgeAlert(alertId);
      if (selectedTask) {
        const updated = await api.scheduledEvaluation.listAlerts({
          scheduledTaskId: selectedTask.id,
        });
        setAlerts(updated);
      }
      showToast("已确认告警", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "操作失败", "error");
    }
  };

  const statusBadge = (status: ScheduledEvaluationTask["status"]) => {
    if (status === "active")
      return (
        <span className="badge bg-emerald-50 text-emerald-700">
          <CheckCircle2 className="w-3 h-3 mr-1" /> 运行中
        </span>
      );
    if (status === "paused")
      return (
        <span className="badge bg-amber-50 text-amber-700">
          <Pause className="w-3 h-3 mr-1" /> 已暂停
        </span>
      );
    return (
      <span className="badge bg-slate-100 text-slate-500">
        <XCircle className="w-3 h-3 mr-1" /> 已禁用
      </span>
    );
  };

  const alertSeverityBadge = (severity: ScheduledAlert["severity"]) => {
    if (severity === "critical")
      return (
        <span className="badge bg-red-50 text-red-700">
          <AlertTriangle className="w-3 h-3 mr-1" /> 严重
        </span>
      );
    return (
      <span className="badge bg-amber-50 text-amber-700">
        <AlertCircle className="w-3 h-3 mr-1" /> 警告
      </span>
    );
  };

  const buildScheduleLabel = (task: ScheduledEvaluationTask) => {
    const f = task.schedule.frequency;
    const t = task.schedule.timeOfDay;
    if (f === "daily") return `每天 ${t || "00:00"}`;
    if (f === "weekly") return `每${weekDays[task.schedule.dayOfWeek ?? 1]} ${t || "00:00"}`;
    if (f === "monthly") return `每月${task.schedule.dayOfMonth ?? 1}日 ${t || "00:00"}`;
    return `Cron: ${task.schedule.cronExpression}`;
  };

  return (
    <div>
      <PageHeader
        title="定时评测"
        description="创建定时任务自动评测知识库质量，支持告警通知与趋势追踪"
        actions={
          <div className="flex items-center gap-2">
            <VersionSelector />
            <button onClick={() => setShowCreate(true)} className="btn-primary">
              <Plus className="w-4 h-4" /> 新建定时任务
            </button>
          </div>
        }
      />

      {showCreate && (
        <div className="card p-5 mb-6 animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary-600" />
              <span className="font-medium text-slate-700">创建定时评测任务</span>
            </div>
            <button
              onClick={() => setShowCreate(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1">任务名称 *</label>
                <input
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  placeholder="例如：每日质量监控"
                  className="input py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">任务描述</label>
                <input
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder="可选，描述任务用途"
                  className="input py-1.5 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-500 mb-1">
                上传测试集文件（可选，JSON/CSV）
              </label>
              <input
                ref={fileRef}
                type="file"
                accept=".json,.csv,.tsv"
                className="input py-1.5 text-sm"
                onChange={(e) => setTestSetFile(e.target.files?.[0] || null)}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">或直接粘贴测试集 JSON</label>
              <textarea
                value={testSetText}
                onChange={(e) => setTestSetText(e.target.value)}
                rows={4}
                className="input font-mono text-xs resize-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs text-slate-500">
                  <Gauge className="w-3.5 h-3.5 inline mr-1" />
                  选择评测指标（可多选）
                </label>
                <span className="text-xs text-slate-400">已选 {selectedMetricIds.length} 个</span>
              </div>
              {metrics.length === 0 ? (
                <div className="p-3 border border-dashed border-slate-200 rounded-lg text-center">
                  <p className="text-xs text-slate-400">暂无自定义指标，使用默认指标</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 md:grid-cols-4 gap-2 max-h-32 overflow-y-auto p-1">
                  {metrics.map((m) => (
                    <button
                      key={m.id}
                      onClick={() =>
                        setSelectedMetricIds((prev) =>
                          prev.includes(m.id)
                            ? prev.filter((id) => id !== m.id)
                            : [...prev, m.id],
                        )
                      }
                      className={`p-2 text-left rounded-lg border transition-all text-xs ${
                        selectedMetricIds.includes(m.id)
                          ? "border-primary-400 bg-primary-50"
                          : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="font-medium text-slate-700 truncate">{m.name}</div>
                      <div className="text-[10px] text-slate-400">权重: {m.weight}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 pt-4">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-primary-600" />
                <span className="font-medium text-sm text-slate-700">调度频率</span>
              </div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                {frequencyOptions.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => setFrequency(value)}
                    className={`flex flex-col items-center gap-1 py-3 rounded-lg border transition-all text-xs ${
                      frequency === value
                        ? "border-primary-400 bg-primary-50 text-primary-700"
                        : "border-slate-200 hover:bg-slate-50 text-slate-600"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </div>

              {(frequency === "daily" || frequency === "weekly" || frequency === "monthly") && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">执行时间</label>
                    <input
                      type="time"
                      value={timeOfDay}
                      onChange={(e) => setTimeOfDay(e.target.value)}
                      className="input py-1.5 text-sm"
                    />
                  </div>
                  {frequency === "weekly" && (
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">执行星期</label>
                      <select
                        value={dayOfWeek}
                        onChange={(e) => setDayOfWeek(parseInt(e.target.value, 10))}
                        className="input py-1.5 text-sm"
                      >
                        {weekDays.map((d, i) => (
                          <option key={i} value={i}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {frequency === "monthly" && (
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">执行日期</label>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={dayOfMonth}
                        onChange={(e) => setDayOfMonth(Math.max(1, Math.min(31, parseInt(e.target.value, 10) || 1)))}
                        className="input py-1.5 text-sm"
                      />
                    </div>
                  )}
                </div>
              )}

              {frequency === "cron" && (
                <div>
                  <label className="block text-xs text-slate-500 mb-1">
                    Cron 表达式（分时日月周）
                  </label>
                  <div className="flex gap-2">
                    <input
                      value={cronExpression}
                      onChange={(e) => setCronExpression(e.target.value)}
                      placeholder="例如：0 2 * * *"
                      className={`input py-1.5 text-sm font-mono flex-1 ${
                        cronValid === false
                          ? "border-red-400 focus:ring-red-500"
                          : cronValid === true
                            ? "border-emerald-400"
                            : ""
                      }`}
                    />
                    <span
                      className={`badge self-center ${
                        cronValid === true
                          ? "bg-emerald-50 text-emerald-700"
                          : cronValid === false
                            ? "bg-red-50 text-red-700"
                            : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {cronValid === true ? "有效" : cronValid === false ? "无效" : "校验中"}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    <Info className="w-3 h-3 inline mr-1" />
                    格式：分钟(0-59) 小时(0-23) 日(1-31) 月(1-12) 周(0-6，0为周日)
                  </p>
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 pt-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-primary-600" />
                  <span className="font-medium text-sm text-slate-700">通知配置</span>
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={notifyEnabled}
                    onChange={(e) => setNotifyEnabled(e.target.checked)}
                  />
                  启用通知
                </label>
              </div>

              {notifyEnabled && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-slate-500 mb-2">通知方式</label>
                    <div className="flex gap-2">
                      {[
                        { value: "desktop" as NotificationType, label: "桌面通知", icon: Monitor },
                        { value: "email" as NotificationType, label: "邮件通知", icon: Mail },
                      ].map(({ value, label, icon: Icon }) => (
                        <button
                          key={value}
                          onClick={() =>
                            setNotifyTypes((prev) =>
                              prev.includes(value)
                                ? prev.filter((t) => t !== value)
                                : [...prev, value],
                            )
                          }
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs transition-all ${
                            notifyTypes.includes(value)
                              ? "border-primary-400 bg-primary-50 text-primary-700"
                              : "border-slate-200 hover:bg-slate-50 text-slate-600"
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {notifyTypes.includes("email") && (
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">
                        收件邮箱（多个用逗号分隔）
                      </label>
                      <input
                        value={emailAddresses}
                        onChange={(e) => setEmailAddresses(e.target.value)}
                        placeholder="admin@example.com, user@example.com"
                        className="input py-1.5 text-sm"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs text-slate-500 mb-2">通知时机</label>
                    <div className="flex flex-wrap gap-3">
                      {[
                        { label: "评测成功", value: notifyOnSuccess, setter: setNotifyOnSuccess },
                        { label: "评测失败", value: notifyOnFailure, setter: setNotifyOnFailure },
                        { label: "触发告警", value: notifyOnAlert, setter: setNotifyOnAlert },
                      ].map(({ label, value, setter }) => (
                        <label key={label} className="flex items-center gap-1.5 text-xs text-slate-600">
                          <input
                            type="checkbox"
                            checked={value}
                            onChange={(e) => setter(e.target.checked)}
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 pt-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span className="font-medium text-sm text-slate-700">告警阈值</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">
                    准确率告警阈值: <span className="font-mono text-emerald-600">{(accuracyThreshold * 100).toFixed(0)}%</span>
                  </label>
                  <input
                    type="range"
                    min={0.5}
                    max={1}
                    step={0.05}
                    value={accuracyThreshold}
                    onChange={(e) => setAccuracyThreshold(parseFloat(e.target.value))}
                    className="w-full accent-emerald-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">准确率低于此值时触发告警</p>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">
                    错误率告警阈值: <span className="font-mono text-red-600">{(wrongRateThreshold * 100).toFixed(0)}%</span>
                  </label>
                  <input
                    type="range"
                    min={0.05}
                    max={0.8}
                    step={0.05}
                    value={wrongRateThreshold}
                    onChange={(e) => setWrongRateThreshold(parseFloat(e.target.value))}
                    className="w-full accent-red-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">错误率高于此值时触发告警</p>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">
                    加权总分阈值（可选）
                    {weightedScoreThreshold !== undefined && (
                      <span className="font-mono text-primary-600 ml-1">
                        {(weightedScoreThreshold * 100).toFixed(0)}%
                      </span>
                    )}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={weightedScoreThreshold ?? 0.7}
                      disabled={weightedScoreThreshold === undefined}
                      onChange={(e) => setWeightedScoreThreshold(parseFloat(e.target.value))}
                      className="w-full accent-primary-500 disabled:opacity-40"
                    />
                    <label className="flex items-center gap-1 text-xs text-slate-500 flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={weightedScoreThreshold !== undefined}
                        onChange={(e) =>
                          setWeightedScoreThreshold(e.target.checked ? 0.7 : undefined)
                        }
                      />
                      启用
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">
                    连续告警次数: <span className="font-mono text-amber-600">{consecutiveFailures} 次</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={consecutiveFailures}
                    onChange={(e) =>
                      setConsecutiveFailures(
                        Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 1)),
                      )
                    }
                    className="input py-1.5 text-sm"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">连续告警此次数后升级为严重告警</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setShowCreate(false);
                  resetForm();
                }}
                className="btn-secondary"
              >
                取消
              </button>
              <button onClick={handleCreate} className="btn-primary">
                创建任务
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-5 gap-6">
        <div className="col-span-2">
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <span className="font-medium text-sm text-slate-700">
                定时任务（{tasks.length}）
              </span>
            </div>
            <div className="divide-y divide-slate-100 max-h-[650px] overflow-y-auto">
              {tasks.length === 0 && (
                <p className="p-8 text-center text-sm text-slate-400">暂无定时任务</p>
              )}
              {tasks.map((t) => (
                <div
                  key={t.id}
                  className={`p-4 cursor-pointer transition-colors ${
                    selectedTask?.id === t.id
                      ? "bg-primary-50 border-l-4 border-primary-500"
                      : "hover:bg-slate-50"
                  }`}
                  onClick={() => handleSelectTask(t)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm text-slate-700 truncate">
                      {t.name}
                    </span>
                    {statusBadge(t.status)}
                  </div>
                  <div className="text-xs text-slate-400 font-mono mb-1">
                    <Clock className="w-3 h-3 inline mr-0.5" />
                    {buildScheduleLabel(t)}
                  </div>
                  <div className="text-xs text-slate-400 mb-2">
                    {t.testSet.length} 条用例
                    {t.nextRunAt && (
                      <span className="ml-2">
                        · 下次运行: {new Date(t.nextRunAt).toLocaleString("zh-CN")}
                      </span>
                    )}
                  </div>
                  {t.lastRunMetrics && (
                    <div className="flex flex-wrap gap-2 text-xs mb-2">
                      <span className="text-emerald-600 font-mono">
                        准确率 {(t.lastRunMetrics.accuracy * 100).toFixed(1)}%
                      </span>
                      <span className="text-red-500 font-mono">
                        错误率 {(t.lastRunMetrics.wrongRate * 100).toFixed(1)}%
                      </span>
                    </div>
                  )}
                  {t.consecutiveAlertCount > 0 && (
                    <div className="text-xs text-amber-600 font-medium mb-2">
                      <AlertTriangle className="w-3 h-3 inline mr-0.5" />
                      连续告警 {t.consecutiveAlertCount} 次
                    </div>
                  )}
                  <div className="flex gap-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePauseResume(t);
                      }}
                      className="btn-secondary !py-1 !px-2 text-xs"
                    >
                      {t.status === "active" ? (
                        <>
                          <Pause className="w-3 h-3" /> 暂停
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3" /> 恢复
                        </>
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRunNow(t.id);
                      }}
                      disabled={runningId === t.id}
                      className="btn-success !py-1 !px-2 text-xs"
                    >
                      <Play className="w-3 h-3" />
                      {runningId === t.id ? "运行中" : "立即执行"}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/trend/${t.id}`);
                      }}
                      className="btn-secondary !py-1 !px-2 text-xs"
                    >
                      <TrendingUp className="w-3 h-3" /> 趋势
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(t.id);
                      }}
                      className="text-slate-400 hover:text-red-500 p-1"
                      title="删除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="col-span-3">
          <div className="card">
            {!selectedTask ? (
              <div className="p-16 text-center text-slate-400">
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>请选择一个定时任务查看详情</p>
              </div>
            ) : (
              <div className="max-h-[650px] overflow-y-auto">
                <div className="px-5 py-4 border-b border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="font-medium text-slate-700">{selectedTask.name}</div>
                      {selectedTask.description && (
                        <div className="text-xs text-slate-400 mt-0.5">
                          {selectedTask.description}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => navigate(`/trend/${selectedTask.id}`)}
                        className="btn-secondary !py-1.5 !px-3 text-xs"
                      >
                        <TrendingUp className="w-3.5 h-3.5 mr-1" /> 查看趋势报告
                      </button>
                      {statusBadge(selectedTask.status)}
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-3 text-xs">
                    <div className="p-2 bg-slate-50 rounded">
                      <div className="text-slate-400 mb-0.5">调度频率</div>
                      <div className="font-medium text-slate-700">
                        {buildScheduleLabel(selectedTask)}
                      </div>
                    </div>
                    <div className="p-2 bg-slate-50 rounded">
                      <div className="text-slate-400 mb-0.5">测试用例</div>
                      <div className="font-medium text-slate-700">
                        {selectedTask.testSet.length} 条
                      </div>
                    </div>
                    <div className="p-2 bg-slate-50 rounded">
                      <div className="text-slate-400 mb-0.5">通知方式</div>
                      <div className="font-medium text-slate-700 flex items-center gap-1">
                        {selectedTask.notification.enabled ? (
                          selectedTask.notification.types.map((t) =>
                            t === "desktop" ? (
                              <span key={t} title="桌面通知">
                                <Monitor className="w-3 h-3" />
                              </span>
                            ) : (
                              <span key={t} title="邮件通知">
                                <Mail className="w-3 h-3" />
                              </span>
                            ),
                          )
                        ) : (
                          <span className="text-slate-400">未启用</span>
                        )}
                      </div>
                    </div>
                    <div className="p-2 bg-slate-50 rounded">
                      <div className="text-slate-400 mb-0.5">告警阈值</div>
                      <div className="font-medium text-slate-700">
                        准确率 {(selectedTask.alertThresholds.accuracyThreshold ?? 0.8) * 100}%
                      </div>
                    </div>
                  </div>
                </div>

                {alerts.filter((a) => !a.acknowledged).length > 0 && (
                  <div className="px-5 py-3 bg-amber-50/50 border-b border-amber-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-amber-700">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="text-sm font-medium">
                          未确认告警 ({alerts.filter((a) => !a.acknowledged).length})
                        </span>
                      </div>
                      <button
                        onClick={async () => {
                          await api.scheduledEvaluation.acknowledgeAllAlerts(selectedTask.id);
                          handleSelectTask(selectedTask);
                          showToast("已全部确认", "success");
                        }}
                        className="text-xs text-amber-700 hover:text-amber-800 underline"
                      >
                        全部确认
                      </button>
                    </div>
                  </div>
                )}

                <div className="p-5 space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <History className="w-4 h-4 text-slate-500" />
                      <span className="font-medium text-sm text-slate-700">执行历史</span>
                    </div>
                    {executions.length === 0 ? (
                      <div className="p-6 text-center text-sm text-slate-400 border border-dashed border-slate-200 rounded-lg">
                        暂无执行记录
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {executions.slice(0, 10).map((e) => (
                          <div
                            key={e.id}
                            className="border border-slate-100 rounded-lg overflow-hidden"
                          >
                            <div
                              className="flex items-center justify-between px-3 py-2 bg-slate-50/50 cursor-pointer hover:bg-slate-50"
                              onClick={() =>
                                setExpandedExecutionId(
                                  expandedExecutionId === e.id ? null : e.id,
                                )
                              }
                            >
                              <div className="flex items-center gap-2">
                                {expandedExecutionId === e.id ? (
                                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                                ) : (
                                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                                )}
                                <span className="text-xs text-slate-600">
                                  {new Date(e.triggeredAt).toLocaleString("zh-CN")}
                                </span>
                                {e.status === "done" ? (
                                  <span className="badge bg-emerald-50 text-emerald-700 !py-0 !text-[10px]">
                                    成功
                                  </span>
                                ) : e.status === "failed" ? (
                                  <span className="badge bg-red-50 text-red-700 !py-0 !text-[10px]">
                                    失败
                                  </span>
                                ) : (
                                  <span className="badge bg-blue-50 text-blue-700 !py-0 !text-[10px]">
                                    运行中
                                  </span>
                                )}
                              </div>
                              {e.metrics && (
                                <div className="flex gap-3 text-[10px] font-mono">
                                  <span className="text-emerald-600">
                                    准确率 {(e.metrics.accuracy * 100).toFixed(1)}%
                                  </span>
                                  <span className="text-red-500">
                                    错误 {(e.metrics.wrongRate * 100).toFixed(1)}%
                                  </span>
                                </div>
                              )}
                            </div>
                            {expandedExecutionId === e.id && (
                              <div className="px-3 py-3 border-t border-slate-100 text-xs space-y-2">
                                {e.metrics && (
                                  <div className="grid grid-cols-4 gap-2">
                                    <div className="text-center p-2 bg-emerald-50/50 rounded">
                                      <div className="font-mono font-bold text-emerald-600 text-sm">
                                        {(e.metrics.accuracy * 100).toFixed(0)}%
                                      </div>
                                      <div className="text-[10px] text-slate-400">准确率</div>
                                    </div>
                                    <div className="text-center p-2 bg-amber-50/50 rounded">
                                      <div className="font-mono font-bold text-amber-600 text-sm">
                                        {(e.metrics.partialRate * 100).toFixed(0)}%
                                      </div>
                                      <div className="text-[10px] text-slate-400">部分正确</div>
                                    </div>
                                    <div className="text-center p-2 bg-red-50/50 rounded">
                                      <div className="font-mono font-bold text-red-500 text-sm">
                                        {(e.metrics.wrongRate * 100).toFixed(0)}%
                                      </div>
                                      <div className="text-[10px] text-slate-400">错误率</div>
                                    </div>
                                    <div className="text-center p-2 bg-primary-50/50 rounded">
                                      <div className="font-mono font-bold text-primary-600 text-sm">
                                        {(e.metrics.avgConfidence * 100).toFixed(0)}%
                                      </div>
                                      <div className="text-[10px] text-slate-400">置信度</div>
                                    </div>
                                  </div>
                                )}
                                {e.alerts && e.alerts.length > 0 && (
                                  <div className="space-y-1.5">
                                    <div className="font-medium text-slate-600">
                                      触发告警：
                                    </div>
                                    {e.alerts.map((a) => (
                                      <div
                                        key={a.id}
                                        className="flex items-start justify-between gap-2 p-2 bg-amber-50 rounded"
                                      >
                                        <div className="flex items-start gap-1.5">
                                          {alertSeverityBadge(a.severity)}
                                          <span className="text-slate-700">{a.message}</span>
                                        </div>
                                        {!a.acknowledged && (
                                          <button
                                            onClick={() => handleAcknowledgeAlert(a.id)}
                                            className="text-[10px] text-amber-700 hover:text-amber-800 underline flex-shrink-0"
                                          >
                                            确认
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {e.errorMessage && (
                                  <div className="p-2 bg-red-50 rounded text-red-600">
                                    <AlertTriangle className="w-3 h-3 inline mr-1" />
                                    {e.errorMessage}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {alerts.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Settings className="w-4 h-4 text-slate-500" />
                          <span className="font-medium text-sm text-slate-700">
                            告警记录（{alerts.length}）
                          </span>
                        </div>
                      </div>
                      <div className="space-y-1.5 max-h-60 overflow-y-auto">
                        {alerts.map((a) => (
                          <div
                            key={a.id}
                            className={`flex items-start justify-between gap-2 p-2 rounded text-xs ${
                              a.acknowledged ? "bg-slate-50 opacity-60" : "bg-amber-50"
                            }`}
                          >
                            <div className="flex items-start gap-1.5 flex-1">
                              {alertSeverityBadge(a.severity)}
                              <div>
                                <div className="text-slate-700">{a.message}</div>
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  {new Date(a.triggeredAt).toLocaleString("zh-CN")}
                                </div>
                              </div>
                            </div>
                            {!a.acknowledged && (
                              <button
                                onClick={() => handleAcknowledgeAlert(a.id)}
                                className="text-[10px] text-amber-700 hover:text-amber-800 underline flex-shrink-0"
                              >
                                确认
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
