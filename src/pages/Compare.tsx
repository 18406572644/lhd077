import { useEffect, useState } from "react";
import {
  GitCompare,
  Download,
  ChevronDown,
  CheckCircle2,
  Minus,
  XCircle,
  TrendingUp,
  TrendingDown,
  Minus as MinusIcon,
  BarChart3,
} from "lucide-react";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { api } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";
import PageHeader from "@/components/PageHeader";
import type {
  EvaluationTask,
  CompareResult,
  HumanJudgment,
} from "../../shared/types";

export default function Compare() {
  const { showToast } = useAppStore();
  const [tasks, setTasks] = useState<EvaluationTask[]>([]);
  const [taskAId, setTaskAId] = useState<string>("");
  const [taskBId, setTaskBId] = useState<string>("");
  const [result, setResult] = useState<CompareResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [openA, setOpenA] = useState(false);
  const [openB, setOpenB] = useState(false);

  useEffect(() => {
    api.evaluation.listTasks().then((list) => {
      const done = list.filter((t) => t.status === "done");
      setTasks(done);
      if (done.length >= 2) {
        setTaskAId(done[0].id);
        setTaskBId(done[1].id);
      }
    });
  }, []);

  const handleCompare = async () => {
    if (!taskAId || !taskBId) {
      showToast("请选择两个评测任务", "error");
      return;
    }
    if (taskAId === taskBId) {
      showToast("请选择不同的任务进行对比", "error");
      return;
    }
    setLoading(true);
    try {
      const data = await api.compare.run([taskAId, taskBId]);
      setResult(data);
      showToast("对比完成", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "对比失败", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!taskAId || !taskBId) return;
    api.compare.export([taskAId, taskBId]);
    showToast("已导出对比报告", "success");
  };

  const judgmentBadge = (j?: HumanJudgment) => {
    if (j === "correct")
      return (
        <span className="badge bg-emerald-50 text-emerald-700">
          <CheckCircle2 className="w-3 h-3 mr-1" /> 正确
        </span>
      );
    if (j === "partial")
      return (
        <span className="badge bg-amber-50 text-amber-700">
          <Minus className="w-3 h-3 mr-1" /> 部分
        </span>
      );
    if (j === "wrong")
      return (
        <span className="badge bg-red-50 text-red-700">
          <XCircle className="w-3 h-3 mr-1" /> 错误
        </span>
      );
    return <span className="text-slate-300 text-xs">未判定</span>;
  };

  const diffIcon = (diff: number) => {
    if (diff > 0.001)
      return <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />;
    if (diff < -0.001)
      return <TrendingDown className="w-3.5 h-3.5 text-red-500" />;
    return <MinusIcon className="w-3.5 h-3.5 text-slate-400" />;
  };

  const diffColor = (diff: number, higherBetter = true) => {
    if (Math.abs(diff) < 0.001) return "text-slate-500";
    const positive = higherBetter ? diff > 0 : diff < 0;
    return positive ? "text-emerald-600" : "text-red-500";
  };

  const radarData = result
    ? [
        {
          metric: "准确率",
          A: result.taskA.metrics?.accuracy ?? 0,
          B: result.taskB.metrics?.accuracy ?? 0,
        },
        {
          metric: "部分正确率",
          A: result.taskA.metrics?.partialRate ?? 0,
          B: result.taskB.metrics?.partialRate ?? 0,
        },
        {
          metric: "平均置信度",
          A: result.taskA.metrics?.avgConfidence ?? 0,
          B: result.taskB.metrics?.avgConfidence ?? 0,
        },
        {
          metric: "1-错误率",
          A: 1 - (result.taskA.metrics?.wrongRate ?? 0),
          B: 1 - (result.taskB.metrics?.wrongRate ?? 0),
        },
      ]
    : [];

  const barData = result
    ? [
        {
          name: "准确率",
          A: ((result.taskA.metrics?.accuracy ?? 0) * 100).toFixed(1),
          B: ((result.taskB.metrics?.accuracy ?? 0) * 100).toFixed(1),
        },
        {
          name: "部分正确",
          A: ((result.taskA.metrics?.partialRate ?? 0) * 100).toFixed(1),
          B: ((result.taskB.metrics?.partialRate ?? 0) * 100).toFixed(1),
        },
        {
          name: "错误率",
          A: ((result.taskA.metrics?.wrongRate ?? 0) * 100).toFixed(1),
          B: ((result.taskB.metrics?.wrongRate ?? 0) * 100).toFixed(1),
        },
        {
          name: "置信度",
          A: ((result.taskA.metrics?.avgConfidence ?? 0) * 100).toFixed(1),
          B: ((result.taskB.metrics?.avgConfidence ?? 0) * 100).toFixed(1),
        },
      ]
    : [];

  const TaskSelect = ({
    value,
    onChange,
    open,
    setOpen,
    label,
  }: {
    value: string;
    onChange: (v: string) => void;
    open: boolean;
    setOpen: (v: boolean) => void;
    label: string;
  }) => {
    const selected = tasks.find((t) => t.id === value);
    return (
      <div className="relative">
        <label className="block text-xs text-slate-500 mb-1">{label}</label>
        <button
          onClick={() => {
            setOpen(!open);
          }}
          className="w-full input py-2 text-sm flex items-center justify-between text-left"
        >
          <span className={selected ? "text-slate-700" : "text-slate-400"}>
            {selected
              ? `${selected.name} (${(selected.metrics?.accuracy * 100).toFixed(0)}%)`
              : "选择评测任务"}
          </span>
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
        {open && (
          <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto animate-slide-up">
            {tasks.length === 0 && (
              <p className="p-4 text-xs text-slate-400 text-center">
                暂无已完成的评测任务
              </p>
            )}
            {tasks.map((t) => (
              <div
                key={t.id}
                onClick={() => {
                  onChange(t.id);
                  setOpen(false);
                }}
                className={`px-3 py-2 cursor-pointer text-sm hover:bg-slate-50 ${
                  value === t.id ? "bg-primary-50 text-primary-700" : "text-slate-700"
                }`}
              >
                <div className="font-medium">{t.name}</div>
                <div className="text-xs text-slate-400 mt-0.5 font-mono">
                  {t.testSet.length} 条 · 准确率{" "}
                  {(t.metrics?.accuracy * 100).toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <PageHeader
        title="版本对比"
        description="对比不同知识库版本或模型参数下的评测结果"
        actions={
          result && (
            <button onClick={handleExport} className="btn-secondary">
              <Download className="w-4 h-4" /> 导出对比报告
            </button>
          )
        }
      />

      <div className="card p-5 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <GitCompare className="w-4 h-4 text-primary-600" />
          <span className="font-medium text-slate-700">选择对比任务</span>
        </div>
        <div className="grid grid-cols-3 gap-4 items-end">
          <TaskSelect
            value={taskAId}
            onChange={setTaskAId}
            open={openA}
            setOpen={setOpenA}
            label="基准任务 (A)"
          />
          <div className="text-center text-slate-300 pb-2">
            <GitCompare className="w-5 h-5 mx-auto" />
          </div>
          <TaskSelect
            value={taskBId}
            onChange={setTaskBId}
            open={openB}
            setOpen={setOpenB}
            label="对比任务 (B)"
          />
        </div>
        <div className="mt-4 flex justify-end">
          <button onClick={handleCompare} disabled={loading} className="btn-primary">
            {loading ? (
              <>
                <BarChart3 className="w-4 h-4 animate-pulse" /> 对比中...
              </>
            ) : (
              <>
                <GitCompare className="w-4 h-4" /> 开始对比
              </>
            )}
          </button>
        </div>
      </div>

      {result && (
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-4 gap-4">
            {[
              { key: "accuracy", label: "准确率", higherBetter: true },
              { key: "partialRate", label: "部分正确率", higherBetter: true },
              { key: "wrongRate", label: "错误率", higherBetter: false },
              { key: "avgConfidence", label: "平均置信度", higherBetter: true },
            ].map(({ key, label, higherBetter }) => {
              const a = result.taskA.metrics?.[key as keyof typeof result.taskA.metrics] as number;
              const b = result.taskB.metrics?.[key as keyof typeof result.taskB.metrics] as number;
              const diff = (b ?? 0) - (a ?? 0);
              return (
                <div key={key} className="card p-4">
                  <div className="text-xs text-slate-400 mb-2">{label}</div>
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-xs text-slate-500 mb-0.5">A</div>
                      <div className="text-xl font-serif font-bold text-slate-700">
                        {((a ?? 0) * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-500 mb-0.5">B</div>
                      <div className="text-xl font-serif font-bold text-primary-600">
                        {((b ?? 0) * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  <div className={`mt-2 flex items-center gap-1 text-xs font-mono ${diffColor(diff, higherBetter)}`}>
                    {diffIcon(diff)}
                    <span>{diff >= 0 ? "+" : ""}{(diff * 100).toFixed(2)}%</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="card p-5">
              <div className="font-medium text-sm text-slate-700 mb-3">
                雷达图对比
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: "#64748b" }} />
                    <PolarRadiusAxis tick={{ fontSize: 9, fill: "#94a3b8" }} domain={[0, 1]} />
                    <Radar
                      name={result.taskA.name}
                      dataKey="A"
                      stroke="#3b82f6"
                      fill="#3b82f6"
                      fillOpacity={0.2}
                    />
                    <Radar
                      name={result.taskB.name}
                      dataKey="B"
                      stroke="#f59e0b"
                      fill="#f59e0b"
                      fillOpacity={0.2}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card p-5">
              <div className="font-medium text-sm text-slate-700 mb-3">
                柱状图对比
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} />
                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      formatter={(v: string) => [`${v}%`]}
                    />
                    <Bar dataKey="A" name={result.taskA.name} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="B" name={result.taskB.name} fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <span className="font-medium text-sm text-slate-700">
                逐题差异对比
              </span>
              <span className="text-xs text-slate-400 font-mono">
                共 {result.perQuestionDiff.length} 题
              </span>
            </div>
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0">
                  <tr className="text-xs text-slate-500">
                    <th className="text-left px-4 py-2 font-medium">问题</th>
                    <th className="text-center px-4 py-2 font-medium">A 判定</th>
                    <th className="text-center px-4 py-2 font-medium">B 判定</th>
                    <th className="text-right px-4 py-2 font-medium">A 置信度</th>
                    <th className="text-right px-4 py-2 font-medium">B 置信度</th>
                    <th className="text-right px-4 py-2 font-medium">差异</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.perQuestionDiff.map((row, i) => {
                    const diff = row.confidenceB - row.confidenceA;
                    return (
                      <tr key={i} className="hover:bg-slate-50/50">
                        <td className="px-4 py-2 text-slate-700 max-w-xs truncate">
                          {row.question}
                        </td>
                        <td className="px-4 py-2 text-center">{judgmentBadge(row.judgmentA)}</td>
                        <td className="px-4 py-2 text-center">{judgmentBadge(row.judgmentB)}</td>
                        <td className="px-4 py-2 text-right font-mono text-slate-600">
                          {(row.confidenceA * 100).toFixed(0)}%
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-slate-600">
                          {(row.confidenceB * 100).toFixed(0)}%
                        </td>
                        <td className={`px-4 py-2 text-right font-mono ${diffColor(diff)}`}>
                          {diff >= 0 ? "+" : ""}
                          {(diff * 100).toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {!result && (
        <div className="card p-16 text-center text-slate-400">
          <GitCompare className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>选择两个评测任务并点击「开始对比」</p>
        </div>
      )}
    </div>
  );
}
