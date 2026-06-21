import { useEffect, useRef, useState } from "react";
import {
  Plus,
  Play,
  Download,
  ClipboardCheck,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  FileText,
  ThumbsUp,
  ThumbsDown,
  Minus,
  Gauge,
  Calculator,
  Code2,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";
import PageHeader from "@/components/PageHeader";
import VersionSelector from "@/components/VersionSelector";
import type {
  EvaluationTask,
  QAResult,
  HumanJudgment,
  TestCase,
  Metric,
} from "../../shared/types";

export default function Evaluation() {
  const { versions, selectedVersionId, retrievalParams, setVersions, showToast } =
    useAppStore();
  const [tasks, setTasks] = useState<EvaluationTask[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [taskName, setTaskName] = useState("");
  const [testSetText, setTestSetText] = useState(
    '[\n  {"question": "如何重置密码？", "standardAnswer": "点击登录页的忘记密码，通过邮箱验证重置"},\n  {"question": "支持哪些支付方式？", "standardAnswer": "支持支付宝、微信支付和银行卡"}\n]',
  );
  const [selectedMetricIds, setSelectedMetricIds] = useState<string[]>([]);
  const [selectedTask, setSelectedTask] = useState<EvaluationTask | null>(null);
  const [taskResults, setTaskResults] = useState<QAResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [testSetFile, setTestSetFile] = useState<File | null>(null);

  useEffect(() => {
    api.knowledge.listVersions().then(setVersions);
    loadTasks();
    loadMetrics();
  }, [setVersions]);

  const loadTasks = async () => {
    const list = await api.evaluation.listTasks();
    setTasks(list);
  };

  const loadMetrics = async () => {
    try {
      const list = await api.metrics.list();
      setMetrics(list);
    } catch (e) {
      // 静默失败，指标为空也能正常使用
    }
  };

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
    if (testSetFile) {
      // file will be sent directly
    } else {
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
    try {
      await api.evaluation.createTask({
        name: taskName,
        testSet,
        versionId: selectedVersionId,
        retrievalParams,
        testSetFile: testSetFile || undefined,
        metricIds: selectedMetricIds,
      });
      showToast("任务已创建", "success");
      setShowCreate(false);
      setTaskName("");
      setTestSetFile(null);
      setSelectedMetricIds([]);
      loadTasks();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "创建失败", "error");
    }
  };

  const handleRun = async (id: string) => {
    setRunningId(id);
    try {
      await api.evaluation.runTask(id);
      showToast("评测已完成", "success");
      loadTasks();
      if (selectedTask?.id === id) {
        const data = await api.evaluation.getTaskResults(id);
        setSelectedTask(data.task);
        setTaskResults(data.results);
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "执行失败", "error");
    } finally {
      setRunningId(null);
    }
  };

  const handleViewResults = async (task: EvaluationTask) => {
    setSelectedTask(task);
    if (task.status === "done") {
      const data = await api.evaluation.getTaskResults(task.id);
      setTaskResults(data.results);
    } else {
      setTaskResults([]);
    }
  };

  const handleAnnotate = async (
    r: QAResult,
    judgment: HumanJudgment,
  ) => {
    try {
      const updated = await api.qa.annotate({
        resultId: r.id,
        judgment,
      });
      setTaskResults((list) =>
        list.map((x) => (x.id === r.id ? updated : x)),
      );
      loadTasks();
      showToast("已保存判定", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "保存失败", "error");
    }
  };

  const statusBadge = (s: string) => {
    if (s === "done")
      return (
        <span className="badge bg-emerald-50 text-emerald-700">
          <CheckCircle2 className="w-3 h-3 mr-1" /> 已完成
        </span>
      );
    if (s === "running")
      return (
        <span className="badge bg-blue-50 text-blue-700">
          <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> 运行中
        </span>
      );
    if (s === "failed")
      return (
        <span className="badge bg-red-50 text-red-700">
          <XCircle className="w-3 h-3 mr-1" /> 失败
        </span>
      );
    return (
      <span className="badge bg-slate-100 text-slate-500">
        <Clock className="w-3 h-3 mr-1" /> 待运行
      </span>
    );
  };

  const judgmentIcon = (j?: HumanJudgment) => {
    if (j === "correct") return <ThumbsUp className="w-3 h-3 text-emerald-500" />;
    if (j === "partial") return <Minus className="w-3 h-3 text-amber-500" />;
    if (j === "wrong") return <ThumbsDown className="w-3 h-3 text-red-500" />;
    return <span className="text-slate-300">—</span>;
  };

  return (
    <div>
      <PageHeader
        title="批量评测"
        description="导入测试集批量运行问答，计算评测指标并导出报告"
        actions={
          <div className="flex items-center gap-2">
            <VersionSelector />
            <button onClick={() => setShowCreate(true)} className="btn-primary">
              <Plus className="w-4 h-4" /> 新建评测任务
            </button>
          </div>
        }
      />

      {showCreate && (
        <div className="card p-5 mb-6 animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-primary-600" />
              <span className="font-medium text-slate-700">创建评测任务</span>
            </div>
            <button
              onClick={() => setShowCreate(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1">任务名称</label>
              <input
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                placeholder="例如：基线测试 v1"
                className="input py-1.5 text-sm"
              />
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
          </div>
          <div className="mt-4">
            <label className="block text-xs text-slate-500 mb-1">
              或直接粘贴测试集 JSON
            </label>
            <textarea
              value={testSetText}
              onChange={(e) => setTestSetText(e.target.value)}
              rows={6}
              className="input font-mono text-xs resize-none"
            />
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs text-slate-500">
                <Gauge className="w-3.5 h-3.5 inline mr-1" />
                选择评测指标（可多选，系统自动计算加权总分）
              </label>
              <span className="text-xs text-slate-400">
                已选 {selectedMetricIds.length} 个
              </span>
            </div>
            {metrics.length === 0 ? (
              <div className="p-4 border border-dashed border-slate-200 rounded-lg text-center">
                <p className="text-xs text-slate-400">
                  暂无自定义指标，使用默认指标
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-1">
                {metrics.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setSelectedMetricIds((prev) =>
                        prev.includes(m.id)
                          ? prev.filter((id) => id !== m.id)
                          : [...prev, m.id],
                      );
                    }}
                    className={`p-2 text-left rounded-lg border transition-all text-xs ${
                      selectedMetricIds.includes(m.id)
                        ? "border-primary-400 bg-primary-50"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {m.computeType === "built-in" ? (
                        <Calculator className="w-3 h-3 text-primary-500" />
                      ) : (
                        <Code2 className="w-3 h-3 text-amber-500" />
                      )}
                      <span className="font-medium text-slate-700 truncate">
                        {m.name}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      权重: {m.weight}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setShowCreate(false)} className="btn-secondary">
              取消
            </button>
            <button onClick={handleCreate} className="btn-primary">
              创建任务
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-5 gap-6">
        <div className="col-span-2">
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <span className="font-medium text-sm text-slate-700">
                评测任务（{tasks.length}）
              </span>
            </div>
            <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
              {tasks.length === 0 && (
                <p className="p-8 text-center text-sm text-slate-400">
                  暂无评测任务
                </p>
              )}
              {tasks.map((t) => (
                <div
                  key={t.id}
                  className={`p-4 cursor-pointer transition-colors ${
                    selectedTask?.id === t.id
                      ? "bg-primary-50 border-l-4 border-primary-500"
                      : "hover:bg-slate-50"
                  }`}
                  onClick={() => handleViewResults(t)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm text-slate-700 truncate">
                      {t.name}
                    </span>
                    {statusBadge(t.status)}
                  </div>
                  <div className="text-xs text-slate-400 font-mono mb-2">
                    {t.testSet.length} 条用例 ·{" "}
                    {new Date(t.createdAt).toLocaleString("zh-CN")}
                  </div>
                  {t.metrics && (
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="text-emerald-600 font-mono">
                        准确率 {(t.metrics.accuracy * 100).toFixed(1)}%
                      </span>
                      <span className="text-amber-600 font-mono">
                        部分 {(t.metrics.partialRate * 100).toFixed(1)}%
                      </span>
                      <span className="text-slate-400 font-mono">
                        置信度 {(t.metrics.avgConfidence * 100).toFixed(0)}%
                      </span>
                      {t.metrics.weightedTotalScore !== undefined &&
                        t.metricIds.length > 0 && (
                          <span className="text-primary-600 font-mono font-medium">
                            加权 {(t.metrics.weightedTotalScore * 100).toFixed(1)}%
                          </span>
                        )}
                    </div>
                  )}
                  <div className="mt-2 flex gap-1.5">
                    {t.status !== "done" && t.status !== "running" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRun(t.id);
                        }}
                        disabled={runningId === t.id}
                        className="btn-success !py-1 !px-2 text-xs"
                      >
                        <Play className="w-3 h-3" />
                        {runningId === t.id ? "运行中" : "运行"}
                      </button>
                    )}
                    {t.status === "done" && (
                      <a
                        href={api.evaluation.exportTask(t.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="btn-secondary !py-1 !px-2 text-xs"
                      >
                        <Download className="w-3 h-3" /> 导出
                      </a>
                    )}
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
                <ClipboardCheck className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>请选择一个评测任务查看详情</p>
              </div>
            ) : (
              <div>
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-700">
                      {selectedTask.name}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {selectedTask.testSet.length} 条用例 ·{" "}
                      {new Date(selectedTask.createdAt).toLocaleString("zh-CN")}
                    </div>
                  </div>
                  {selectedTask.metrics && (
                    <div>
                      <div className="flex gap-4 mb-3">
                        <div className="text-center">
                          <div className="text-2xl font-serif font-bold text-emerald-600">
                            {(selectedTask.metrics.accuracy * 100).toFixed(0)}%
                          </div>
                          <div className="text-[10px] text-slate-400">准确率</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-serif font-bold text-amber-600">
                            {(selectedTask.metrics.partialRate * 100).toFixed(0)}%
                          </div>
                          <div className="text-[10px] text-slate-400">部分正确</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-serif font-bold text-red-500">
                            {(selectedTask.metrics.wrongRate * 100).toFixed(0)}%
                          </div>
                          <div className="text-[10px] text-slate-400">错误率</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-serif font-bold text-primary-600">
                            {(selectedTask.metrics.avgConfidence * 100).toFixed(0)}%
                          </div>
                          <div className="text-[10px] text-slate-400">平均置信度</div>
                        </div>
                        {selectedTask.metrics.weightedTotalScore !== undefined &&
                          selectedTask.metricIds.length > 0 && (
                            <div className="text-center pl-3 border-l border-slate-200">
                              <div className="text-2xl font-serif font-bold text-violet-600">
                                {(selectedTask.metrics.weightedTotalScore * 100).toFixed(0)}%
                              </div>
                              <div className="text-[10px] text-slate-400">加权总分</div>
                            </div>
                          )}
                      </div>
                      {selectedTask.metrics.metricResults &&
                        selectedTask.metrics.metricResults.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                            {selectedTask.metrics.metricResults.map((mr) => (
                              <div
                                key={mr.metricId}
                                className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 rounded text-xs"
                              >
                                <span className="text-slate-600">{mr.metricName}</span>
                                <span
                                  className={`font-mono font-medium ${
                                    mr.higherIsBetter ? "text-emerald-600" : "text-red-500"
                                  }`}
                                >
                                  {(mr.value * 100).toFixed(1)}%
                                </span>
                                <span className="text-slate-400 text-[10px]">
                                  ×{mr.weight}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                    </div>
                  )}
                </div>
                <div className="max-h-[520px] overflow-y-auto divide-y divide-slate-100">
                  {taskResults.length === 0 ? (
                    <p className="p-8 text-center text-sm text-slate-400">
                      {selectedTask.status === "done"
                        ? "暂无结果"
                        : "任务尚未运行"}
                    </p>
                  ) : (
                    taskResults.map((r, i) => (
                      <div key={r.id} className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-slate-400">
                              #{i + 1}
                            </span>
                            <span className="text-sm text-slate-700 font-medium">
                              {r.question}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleAnnotate(r, "correct")}
                              className={`p-1 rounded ${
                                r.humanJudgment === "correct"
                                  ? "bg-emerald-100"
                                  : "hover:bg-slate-100"
                              }`}
                              title="正确"
                            >
                              <ThumbsUp className="w-3.5 h-3.5 text-emerald-500" />
                            </button>
                            <button
                              onClick={() => handleAnnotate(r, "partial")}
                              className={`p-1 rounded ${
                                r.humanJudgment === "partial"
                                  ? "bg-amber-100"
                                  : "hover:bg-slate-100"
                              }`}
                              title="部分正确"
                            >
                              <Minus className="w-3.5 h-3.5 text-amber-500" />
                            </button>
                            <button
                              onClick={() => handleAnnotate(r, "wrong")}
                              className={`p-1 rounded ${
                                r.humanJudgment === "wrong"
                                  ? "bg-red-100"
                                  : "hover:bg-slate-100"
                              }`}
                              title="错误"
                            >
                              <ThumbsDown className="w-3.5 h-3.5 text-red-500" />
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <div className="text-slate-400 mb-1 flex items-center gap-1">
                              <FileText className="w-3 h-3" /> 标准答案
                            </div>
                            <div className="p-2 bg-slate-50 rounded text-slate-700">
                              {r.standardAnswer || "—"}
                            </div>
                          </div>
                          <div>
                            <div className="text-slate-400 mb-1 flex items-center gap-1">
                              {judgmentIcon(r.humanJudgment)} 模型回答
                              <span className="ml-auto font-mono">
                                {(r.confidence * 100).toFixed(0)}%
                              </span>
                            </div>
                            <div
                              className={`p-2 rounded ${
                                r.humanJudgment === "correct"
                                  ? "bg-emerald-50 text-emerald-800"
                                  : r.humanJudgment === "partial"
                                    ? "bg-amber-50 text-amber-800"
                                    : r.humanJudgment === "wrong"
                                      ? "bg-red-50 text-red-800"
                                      : "bg-primary-50/30 text-slate-700"
                              }`}
                            >
                              {r.answer}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
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
