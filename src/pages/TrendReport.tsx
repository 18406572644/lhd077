import { useEffect, useState, useCallback } from "react";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Minus as MinusIcon,
  AlertTriangle,
  CalendarRange,
  Play,
  Download,
  Gauge,
  Target,
  BarChart3,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  ReferenceLine,
} from "recharts";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";
import PageHeader from "@/components/PageHeader";
import type { TrendReport, ScheduledEvaluationTask } from "../../shared/types";

const dayOptions = [
  { value: 7, label: "近 7 天" },
  { value: 14, label: "近 14 天" },
  { value: 30, label: "近 30 天" },
  { value: 90, label: "近 90 天" },
];

export default function TrendReportPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { showToast } = useAppStore();

  const [task, setTask] = useState<ScheduledEvaluationTask | null>(null);
  const [report, setReport] = useState<TrendReport | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(
    async (taskId: string, daysCount: number) => {
      setLoading(true);
      try {
        const [t, r] = await Promise.all([
          api.scheduledEvaluation.getTask(taskId),
          api.scheduledEvaluation.getTrendReport(taskId, daysCount),
        ]);
        setTask(t);
        setReport(r);
      } catch (e) {
        showToast(e instanceof Error ? e.message : "加载失败", "error");
      } finally {
        setLoading(false);
      }
    },
    [showToast],
  );

  useEffect(() => {
    if (id) {
      loadData(id, days);
    }
  }, [id, days, loadData]);

  const handleRunNow = async () => {
    if (!id) return;
    try {
      await api.scheduledEvaluation.runTaskNow(id);
      showToast("已触发执行", "success");
      setTimeout(() => loadData(id, days), 1000);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "执行失败", "error");
    }
  };

  const handleExport = () => {
    if (!report) return;
    const json = JSON.stringify(report, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trend_report_${task?.name || report.scheduledTaskName}_${days}days.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getTrendIcon = (trend: string) => {
    if (trend === "improving")
      return <TrendingUp className="w-4 h-4 text-emerald-500" />;
    if (trend === "declining")
      return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <MinusIcon className="w-4 h-4 text-slate-400" />;
  };

  const getTrendLabel = (trend: string) => {
    if (trend === "improving") return { text: "上升趋势", color: "text-emerald-600" };
    if (trend === "declining") return { text: "下降趋势", color: "text-red-600" };
    return { text: "趋势稳定", color: "text-slate-600" };
  };

  const chartData = report?.dataPoints.map((dp) => ({
    date: dp.date,
    timestamp: dp.timestamp,
    准确率: dp.metrics.accuracy,
    部分正确率: dp.metrics.partialRate,
    错误率: dp.metrics.wrongRate,
    平均置信度: dp.metrics.avgConfidence,
    加权总分: dp.metrics.weightedTotalScore ?? null,
  }));

  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

  return (
    <div>
      <PageHeader
        title={task ? `${task.name} - 趋势报告` : "趋势报告"}
        description="查看知识库质量指标随时间的变化趋势"
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => navigate("/scheduled-evaluation")} className="btn-secondary">
              <ArrowLeft className="w-4 h-4" /> 返回
            </button>
            <select
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value, 10))}
              className="input py-1.5 text-sm !w-auto"
            >
              {dayOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              onClick={handleRunNow}
              className="btn-success"
              disabled={!task || task.status === "active" && false}
            >
              <Play className="w-4 h-4" /> 立即执行
            </button>
            <button onClick={handleExport} className="btn-secondary" disabled={!report}>
              <Download className="w-4 h-4" /> 导出报告
            </button>
          </div>
        }
      />

      {loading ? (
        <div className="card p-16 text-center text-slate-400">
          <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-40 animate-pulse" />
          <p>加载中...</p>
        </div>
      ) : !report ? (
        <div className="card p-16 text-center text-slate-400">
          <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>暂无趋势数据</p>
          <p className="text-xs mt-1">执行几次定时任务后会生成趋势报告</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-6 gap-4">
            <div className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-500">
                  <Gauge className="w-3 h-3 inline mr-1" />
                  平均准确率
                </span>
              </div>
              <div className="text-2xl font-serif font-bold text-emerald-600">
                {pct(report.overallStats.avgAccuracy)}
              </div>
              <div className="mt-1 text-[10px] text-slate-400">
                最高 {pct(report.overallStats.maxAccuracy)} · 最低 {pct(report.overallStats.minAccuracy)}
              </div>
            </div>

            <div className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-500">
                  <Target className="w-3 h-3 inline mr-1" />
                  质量趋势
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {getTrendIcon(report.overallStats.trend)}
                <span
                  className={`text-xl font-serif font-bold ${getTrendLabel(report.overallStats.trend).color}`}
                >
                  {getTrendLabel(report.overallStats.trend).text}
                </span>
              </div>
              <div className="mt-1 text-[10px] text-slate-400">
                基于最近 {Math.min(3, report.dataPoints.length)} 次数据对比
              </div>
            </div>

            <div className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-500">
                  <CalendarRange className="w-3 h-3 inline mr-1" />
                  执行次数
                </span>
              </div>
              <div className="text-2xl font-serif font-bold text-primary-600">
                {report.overallStats.totalRuns}
              </div>
              <div className="mt-1 text-[10px] text-slate-400">
                近 {days} 天
              </div>
            </div>

            <div className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-500">
                  <AlertTriangle className="w-3 h-3 inline mr-1" />
                  告警次数
                </span>
              </div>
              <div
                className={`text-2xl font-serif font-bold ${
                  report.overallStats.alertCount > 0 ? "text-amber-600" : "text-slate-400"
                }`}
              >
                {report.overallStats.alertCount}
              </div>
              <div className="mt-1 text-[10px] text-slate-400">
                {report.overallStats.alertCount === 0
                  ? "运行稳定"
                  : "请注意质量波动"}
              </div>
            </div>

            <div className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-500">最高准确率</span>
              </div>
              <div className="text-2xl font-serif font-bold text-emerald-600">
                {pct(report.overallStats.maxAccuracy)}
              </div>
            </div>

            <div className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-500">最低准确率</span>
              </div>
              <div className="text-2xl font-serif font-bold text-red-500">
                {pct(report.overallStats.minAccuracy)}
              </div>
            </div>
          </div>

          {task && task.alertThresholds.accuracyThreshold && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-medium text-slate-700 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary-600" />
                    准确率趋势
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    告警阈值: {(task.alertThresholds.accuracyThreshold * 100).toFixed(0)}%
                  </p>
                </div>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorAccuracy" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 1]}
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      tickLine={false}
                      tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                    />
                    <Tooltip
                      formatter={(value: number) => [(value * 100).toFixed(1) + "%", "准确率"]}
                      labelStyle={{ fontSize: 12, fontWeight: 600 }}
                    />
                    <ReferenceLine
                      y={task.alertThresholds.accuracyThreshold}
                      stroke="#ef4444"
                      strokeDasharray="5 5"
                      label={{
                        value: `阈值 ${(task.alertThresholds.accuracyThreshold * 100).toFixed(0)}%`,
                        position: "right",
                        fontSize: 10,
                        fill: "#ef4444",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="准确率"
                      stroke="#10b981"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorAccuracy)"
                      dot={{ r: 3, fill: "#10b981", strokeWidth: 2, stroke: "#fff" }}
                      activeDot={{ r: 5 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-6">
            <div className="card p-5">
              <h3 className="font-medium text-slate-700 mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary-600" />
                正确率 vs 错误率
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 1]}
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      tickLine={false}
                      tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                    />
                    <Tooltip
                      formatter={(value: number, name: string) => [
                        (value * 100).toFixed(1) + "%",
                        name,
                      ]}
                      labelStyle={{ fontSize: 12, fontWeight: 600 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line
                      type="monotone"
                      dataKey="准确率"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="部分正确率"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="错误率"
                      stroke="#ef4444"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card p-5">
              <h3 className="font-medium text-slate-700 mb-4 flex items-center gap-2">
                <Gauge className="w-4 h-4 text-primary-600" />
                置信度 & 加权总分
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 1]}
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      tickLine={false}
                      tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                    />
                    <Tooltip
                      formatter={(value: number | null, name: string) => [
                        value !== null ? (value * 100).toFixed(1) + "%" : "N/A",
                        name,
                      ]}
                      labelStyle={{ fontSize: 12, fontWeight: 600 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line
                      type="monotone"
                      dataKey="平均置信度"
                      stroke="#6366f1"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      activeDot={{ r: 5 }}
                    />
                    {(chartData || []).some((d) => d.加权总分 !== null) && (
                      <Line
                        type="monotone"
                        dataKey="加权总分"
                        stroke="#8b5cf6"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={{ r: 2 }}
                        activeDot={{ r: 5 }}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-medium text-slate-700 mb-4 flex items-center gap-2">
              <CalendarRange className="w-4 h-4 text-primary-600" />
              详细数据
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="table-th">日期</th>
                    <th className="table-th text-right">准确率</th>
                    <th className="table-th text-right">部分正确率</th>
                    <th className="table-th text-right">错误率</th>
                    <th className="table-th text-right">平均置信度</th>
                    {task?.metricIds && task.metricIds.length > 0 && (
                      <th className="table-th text-right">加权总分</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {report.dataPoints.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="table-td text-center text-slate-400 py-8">
                        暂无数据
                      </td>
                    </tr>
                  ) : (
                    [...report.dataPoints]
                      .sort((a, b) => b.timestamp - a.timestamp)
                      .map((dp) => {
                        const accuracyPct = dp.metrics.accuracy * 100;
                        const threshold = task?.alertThresholds.accuracyThreshold
                          ? task.alertThresholds.accuracyThreshold * 100
                          : 80;
                        return (
                          <tr key={dp.timestamp} className="border-b border-slate-50 hover:bg-slate-50">
                            <td className="table-td font-mono">{dp.date}</td>
                            <td
                              className={`table-td text-right font-mono font-medium ${
                                accuracyPct < threshold ? "text-red-600" : "text-emerald-600"
                              }`}
                            >
                              {pct(dp.metrics.accuracy)}
                              {accuracyPct < threshold && (
                                <AlertTriangle className="w-3 h-3 inline ml-1" />
                              )}
                            </td>
                            <td className="table-td text-right font-mono text-amber-600">
                              {pct(dp.metrics.partialRate)}
                            </td>
                            <td className="table-td text-right font-mono text-red-500">
                              {pct(dp.metrics.wrongRate)}
                            </td>
                            <td className="table-td text-right font-mono text-primary-600">
                              {pct(dp.metrics.avgConfidence)}
                            </td>
                            {task?.metricIds && task.metricIds.length > 0 && (
                              <td className="table-td text-right font-mono text-violet-600">
                                {dp.metrics.weightedTotalScore !== undefined
                                  ? pct(dp.metrics.weightedTotalScore)
                                  : "—"}
                              </td>
                            )}
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
